import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, tables, type DbOrTx } from "@/db";
import { getConfig } from "@/lib/config";
import { sendMail } from "@/lib/mail";
import { recordAudit } from "@/lib/audit";
import {
  emitEvent,
  type OutboxDeliveryScheduler,
} from "@/lib/outbox";
import type { Viewer } from "@/lib/authz";
import { ok, err, type ActionResult } from "@/lib/contracts/result";

// Registration, consent, visibility, application evidence, and credential
// recovery (AUTH-01..03, AUTH-05/07/08). Orchestrator-owned: UI lanes call
// these, never touch users/consent tables directly.

const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(10, "Use at least 10 characters."),
});

export async function registerWithEmail(
  input: z.infer<typeof registerSchema>,
): Promise<ActionResult<{ userId: string }>> {
  if (!(await getConfig("auth.emailFallbackEnabled")))
    return err("forbidden", "Email registration is not available.");
  if (!(await getCurrentNotice()))
    return err(
      "forbidden",
      "Member registration is unavailable until MCAC publishes its privacy notice.",
    );

  const parsed = registerSchema.safeParse(input);
  if (!parsed.success)
    return err(
      "validation",
      "Check the highlighted fields.",
      parsed.error.flatten().fieldErrors,
    );
  const { name, email, password } = parsed.data;

  const existing = await db.query.users.findFirst({
    where: eq(tables.users.email, email),
  });
  if (existing)
    return err("conflict", "An account already exists for this email.", {
      email: ["An account already exists for this email. Sign in instead."],
    });

  const passwordHash = await bcrypt.hash(password, 10);
  const [phone, emailVis, linkedin] = await Promise.all([
    getConfig("contact.defaults.phone"),
    getConfig("contact.defaults.email"),
    getConfig("contact.defaults.linkedin"),
  ]);

  const userId = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(tables.users)
      .values({ name, email, passwordHash, status: "pending" })
      .returning();
    await tx.insert(tables.profiles).values({
      userId: user.id,
      phoneVisibility: phone,
      emailVisibility: emailVis,
      linkedinVisibility: linkedin,
    });
    return user.id;
  });

  return ok({ userId });
}

// ---------------------------------------------------------------------------
// Privacy consent (AUTH-02): affirmative, versioned, insert-only
// ---------------------------------------------------------------------------

export async function getCurrentNotice() {
  return db.query.privacyNotices.findFirst({
    where: eq(tables.privacyNotices.isCurrent, true),
  });
}

export async function hasCurrentConsent(userId: string): Promise<boolean> {
  const notice = await getCurrentNotice();
  if (!notice) return false;
  const record = await db.query.consentRecords.findFirst({
    where: and(
      eq(tables.consentRecords.userId, userId),
      eq(tables.consentRecords.noticeVersion, notice.version),
    ),
  });
  return Boolean(record);
}

export async function acceptCurrentNotice(
  viewer: Viewer | null,
  acceptedVersion: number,
  optionalChoices?: { communications: boolean },
): Promise<ActionResult> {
  if (!viewer) return err("unauthorized", "Sign in to continue.");
  const notice = await getCurrentNotice();
  if (!notice) return err("internal", "No privacy notice is published.");
  if (notice.version !== acceptedVersion)
    return err(
      "conflict",
      "The privacy notice changed while you were reading. Review the current version.",
    );
  // One transaction: the notice puts the optional communications consent on
  // the same screen as the mandatory one, and a half-written pair would leave
  // an applicant past the gate with the choice they made silently dropped.
  let conflicted = false;
  await db.transaction(async (tx) => {
    // Re-read inside the transaction: a version published between the check
    // above and this write would otherwise be accepted as the stale one, and
    // the applicant would land past a gate they never actually passed.
    const current = await tx.query.privacyNotices.findFirst({
      where: eq(tables.privacyNotices.isCurrent, true),
    });
    if (!current || current.version !== acceptedVersion) {
      conflicted = true;
      return;
    }
    const existing = await tx.query.consentRecords.findFirst({
      where: and(
        eq(tables.consentRecords.userId, viewer.id),
        eq(tables.consentRecords.noticeVersion, notice.version),
      ),
    });
    if (!existing) {
      await tx.insert(tables.consentRecords).values({
        userId: viewer.id,
        noticeVersion: notice.version,
      });
    }
    if (optionalChoices) {
      await writeCommunicationsDecision(
        viewer.id,
        optionalChoices.communications,
        notice.version,
        tx,
      );
    }
  });
  if (conflicted)
    return err(
      "conflict",
      "The privacy notice changed while you were reading. Review the current version.",
    );
  return ok(undefined);
}

// ---------------------------------------------------------------------------
// Contact visibility (AUTH-03): separate per-field decision, never bundled
// ---------------------------------------------------------------------------

const visibilityChoice = z.enum(["visible", "hidden", "admin_only"]);
const visibilitySchema = z.object({
  phone: visibilityChoice,
  email: visibilityChoice,
  linkedin: visibilityChoice,
});

export async function updateContactVisibility(
  viewer: Viewer | null,
  input: z.infer<typeof visibilitySchema>,
): Promise<ActionResult> {
  if (!viewer) return err("unauthorized", "Sign in to continue.");
  const parsed = visibilitySchema.safeParse(input);
  if (!parsed.success)
    return err("validation", "Choose a visibility for each field.");
  await db
    .update(tables.profiles)
    .set({
      phoneVisibility: parsed.data.phone,
      emailVisibility: parsed.data.email,
      linkedinVisibility: parsed.data.linkedin,
      contactChoicesAt: new Date(),
    })
    .where(eq(tables.profiles.userId, viewer.id));
  return ok(undefined);
}

/**
 * Write one communications decision. The profile row carries the current
 * answer; audit_log carries the history, which is what lets MCAC show when a
 * member opted in, when they withdrew, and against which notice version.
 */
async function writeCommunicationsDecision(
  userId: string,
  optIn: boolean,
  noticeVersion: number | null,
  dbOrTx: DbOrTx = db,
): Promise<void> {
  await dbOrTx
    .update(tables.profiles)
    .set({ communicationsOptIn: optIn, communicationsDecidedAt: new Date() })
    .where(eq(tables.profiles.userId, userId));
  await recordAudit(
    {
      actorId: userId,
      action: "account.communications_consent",
      subjectType: "user",
      subjectId: userId,
      detail: { optIn, noticeVersion },
    },
    dbOrTx,
  );
}

/**
 * Optional communications consent (AUTH-02). The notice offers it beside the
 * mandatory processing consent, and it gates nothing: opting out changes
 * nothing about the account. Section 10 promises withdrawal through a
 * comparable mechanism, so this stays callable for every signed-in account,
 * not only approved members.
 */
export async function setCommunicationsOptIn(
  viewer: Viewer | null,
  optIn: boolean,
): Promise<ActionResult> {
  if (!viewer) return err("unauthorized", "Sign in to continue.");
  const notice = await getCurrentNotice();
  await writeCommunicationsDecision(viewer.id, optIn, notice?.version ?? null);
  return ok(undefined);
}

/**
 * Current optional communications choice for the owner (AUTH-02, HOME-04).
 * Directory visibility is no longer optional: every approved member appears
 * in People. Historical directory fields remain stored for audit/rollback but
 * are deliberately absent from this runtime contract.
 */
export async function getOptionalConsents(viewer: Viewer): Promise<{
  communications: boolean;
}> {
  const profile = await db.query.profiles.findFirst({
    where: eq(tables.profiles.userId, viewer.id),
    columns: {
      communicationsOptIn: true,
    },
  });
  return {
    communications: profile?.communicationsOptIn ?? false,
  };
}

/** Current per-field visibility settings for the owner (AUTH-03, HOME-04). */
export async function getOwnContactSettings(viewer: Viewer) {
  const profile = await db.query.profiles.findFirst({
    where: eq(tables.profiles.userId, viewer.id),
  });
  return {
    phone: profile?.phoneVisibility ?? "hidden",
    email: profile?.emailVisibility ?? "admin_only",
    linkedin: profile?.linkedinVisibility ?? "visible",
    chosenAt: profile?.contactChoicesAt ?? null,
  };
}

// ---------------------------------------------------------------------------
// Application evidence (AUTH-07): collected BEFORE approval per the client
// decision of 2026-07-30. Required: full name, WhatsApp phone, city, company
// or practice, title, >=1 expertise area. LinkedIn URL is optional (client
// direction 2026-07-30); when filled it must still be a linkedin.com URL.
// Bio stays optional.
// needs_changes applicants edit here; submitting also resubmits to pending.
// ---------------------------------------------------------------------------

export const evidenceSchema = z.object({
  name: z.string().trim().min(1, "Enter your full name.").max(80),
  city: z.string().trim().min(1, "Enter your city.").max(80),
  phone: z.string().trim().min(8, "Enter a WhatsApp phone number.").max(20),
  tagIds: z.array(z.string()).min(1, "Choose at least one expertise area."),
  company: z.string().trim().min(1, "Enter your company or practice.").max(120),
  title: z.string().trim().min(1, "Enter your title.").max(120),
  bio: z.string().trim().max(1000).optional().default(""),
  linkedinUrl: z
    .string()
    .trim()
    .max(200)
    .refine(
      (u) => u === "" || /(^https?:\/\/)([a-z0-9-]+\.)*linkedin\.com\//i.test(u),
      "Enter your LinkedIn profile URL.",
    )
    .optional()
    .default(""),
});

export type EvidenceInput = z.infer<typeof evidenceSchema>;

const MISSING_LABELS: [label: string, empty: (u: { name: string }, p: { phone: string; city: string; company: string; title: string; linkedinUrl: string }, tagCount: number) => boolean][] = [
  ["full name", (u) => !u.name.trim()],
  ["phone", (_u, p) => !p.phone.trim()],
  ["city", (_u, p) => !p.city.trim()],
  ["company or practice", (_u, p) => !p.company.trim()],
  ["title", (_u, p) => !p.title.trim()],
  ["expertise area", (_u, _p, tagCount) => tagCount === 0],
];

/** Which approval-blocking evidence fields are still empty for this account. */
export async function getEvidenceStatus(
  userId: string,
): Promise<{ complete: boolean; missing: string[] }> {
  const [user, profile, tags] = await Promise.all([
    db.query.users.findFirst({
      where: eq(tables.users.id, userId),
      columns: { name: true },
    }),
    db.query.profiles.findFirst({
      where: eq(tables.profiles.userId, userId),
    }),
    db.query.memberTags.findMany({
      where: eq(tables.memberTags.userId, userId),
    }),
  ]);
  const u = { name: user?.name ?? "" };
  const p = {
    phone: profile?.phone ?? "",
    city: profile?.city ?? "",
    company: profile?.company ?? "",
    title: profile?.title ?? "",
    linkedinUrl: profile?.linkedinUrl ?? "",
  };
  const missing = MISSING_LABELS.filter(([, empty]) =>
    empty(u, p, tags.length),
  ).map(([label]) => label);
  return { complete: missing.length === 0, missing };
}

export async function submitApplicationEvidence(
  viewer: Viewer | null,
  input: EvidenceInput,
  scheduleDelivery?: OutboxDeliveryScheduler,
): Promise<ActionResult<{ resubmitted: boolean }>> {
  if (!viewer) return err("unauthorized", "Sign in to continue.");
  if (!["pending", "needs_changes", "approved"].includes(viewer.status))
    return err("forbidden", "This account cannot submit application details.");

  // Evidence is step three of the lifecycle (consent -> contact visibility ->
  // evidence). Enforce the order here, not just in the UI: a request that
  // skips ahead - however it was made - must not persist evidence data.
  const [consented, profileForGate] = await Promise.all([
    hasCurrentConsent(viewer.id),
    db.query.profiles.findFirst({
      where: eq(tables.profiles.userId, viewer.id),
      columns: { contactChoicesAt: true },
    }),
  ]);
  if (!consented || !profileForGate?.contactChoicesAt)
    return err(
      "forbidden",
      "Finish the registration steps before submitting your application.",
    );

  const parsed = evidenceSchema.safeParse(input);
  if (!parsed.success)
    return err(
      "validation",
      "Check the highlighted fields.",
      parsed.error.flatten().fieldErrors,
    );

  const tags = await db.query.expertiseTags.findMany({
    where: inArray(tables.expertiseTags.id, parsed.data.tagIds),
  });
  if (tags.length !== parsed.data.tagIds.length)
    return err("validation", "Choose expertise areas from the list.", {
      tagIds: ["Choose expertise areas from the list."],
    });

  const resubmitted = viewer.status === "needs_changes";
  const sortedNewTagIds = [...parsed.data.tagIds].sort();
  const eventIds: number[] = [];

  await db.transaction(async (tx) => {
    // onboardingCompletedAt is the "submitted" date the admin evidence card
    // shows. Stamp it on first submission (or a needs_changes resubmit) only
    // - an already-approved member editing their own evidence from /me must
    // not move that date, since it isn't a new application. Read the
    // pre-write row (name, evidence fields, tags) inside this transaction so
    // the no-op comparison below reflects exactly what is about to be
    // overwritten.
    const [currentUser] = await tx
      .select({ name: tables.users.name })
      .from(tables.users)
      .where(eq(tables.users.id, viewer.id));
    const [currentProfile] = await tx
      .select({
        city: tables.profiles.city,
        phone: tables.profiles.phone,
        company: tables.profiles.company,
        title: tables.profiles.title,
        bio: tables.profiles.bio,
        linkedinUrl: tables.profiles.linkedinUrl,
        onboardingCompletedAt: tables.profiles.onboardingCompletedAt,
      })
      .from(tables.profiles)
      .where(eq(tables.profiles.userId, viewer.id));
    const currentTagRows = await tx
      .select({ tagId: tables.memberTags.tagId })
      .from(tables.memberTags)
      .where(eq(tables.memberTags.userId, viewer.id));
    const currentTagIds = currentTagRows.map((t) => t.tagId).sort();

    // Repeat-submit notification spam mitigation (controller decision,
    // 2026-07-30): the evidence page is deliberately re-openable, and
    // pressing Save with no real edits must not re-notify every admin again.
    // Skip the fan-out only when every evidence field matches what is
    // already stored AND a prior submission exists (onboardingCompletedAt is
    // already set) - a genuine first submission always notifies even if it
    // happens to match defaults, and any real edit on a needs_changes
    // resubmit always notifies.
    const isNoOpResubmit =
      Boolean(currentProfile?.onboardingCompletedAt) &&
      currentUser?.name === parsed.data.name &&
      currentProfile?.city === parsed.data.city &&
      currentProfile?.phone === parsed.data.phone &&
      currentProfile?.company === parsed.data.company &&
      currentProfile?.title === parsed.data.title &&
      currentProfile?.bio === parsed.data.bio &&
      currentProfile?.linkedinUrl === parsed.data.linkedinUrl &&
      currentTagIds.length === sortedNewTagIds.length &&
      currentTagIds.every((id, i) => id === sortedNewTagIds[i]);

    // onboardingCompletedAt renders to admins as "(submitted <date>)" on the
    // application detail screen, so it must track the applicant's most
    // recent REAL submission, not every keystroke of Save. Stamp on a
    // pending/needs_changes applicant's first submission (no prior stamp) or
    // on a materially-changed resubmit; never restamp a no-op save (that
    // would make an applicant idly re-saving look like they just reapplied).
    // An approved member editing their own evidence from /me is not a new
    // application at all - never restamp them, matching the fan-out gate
    // above.
    const shouldStampOnboarding =
      (viewer.status === "pending" || viewer.status === "needs_changes") &&
      (!currentProfile?.onboardingCompletedAt || !isNoOpResubmit);

    await tx
      .update(tables.users)
      .set({
        name: parsed.data.name,
        ...(resubmitted
          ? { status: "pending" as const, statusReason: null, statusChangedAt: new Date() }
          : {}),
      })
      .where(eq(tables.users.id, viewer.id));
    await tx
      .update(tables.profiles)
      .set({
        city: parsed.data.city,
        phone: parsed.data.phone,
        company: parsed.data.company,
        title: parsed.data.title,
        bio: parsed.data.bio,
        linkedinUrl: parsed.data.linkedinUrl,
        ...(shouldStampOnboarding ? { onboardingCompletedAt: new Date() } : {}),
      })
      .where(eq(tables.profiles.userId, viewer.id));
    await tx
      .delete(tables.memberTags)
      .where(eq(tables.memberTags.userId, viewer.id));
    await tx
      .insert(tables.memberTags)
      .values(parsed.data.tagIds.map((tagId) => ({ userId: viewer.id, tagId })));

    // Admins get notified for every real application (first submit or
    // resubmit) - NOT for an already-approved member editing their own
    // evidence from /me, which is not a new application (client feedback,
    // 2026-07-30), and NOT for a repeat submit that changed nothing (client
    // feedback, 2026-07-30 - the evidence page is re-openable, so pressing
    // Save repeatedly must not spam every admin). One notification row + one
    // outbox event per approved admin, per the sections_changed fan-out
    // precedent (src/lib/admin/mutations.ts adminSetConfig): the recipient id
    // is embedded in the outbox payload (adminId) because a single event here
    // fans out to a set of admins that can change over time, so the worker
    // cannot otherwise tell which admin an event is for.
    if (viewer.status !== "approved" && !isNoOpResubmit) {
      const admins = await tx
        .select({ id: tables.users.id })
        .from(tables.users)
        .where(
          and(
            inArray(tables.users.role, ["admin", "superadmin"]),
            eq(tables.users.status, "approved"),
          ),
        );
      const recipients = admins.filter((a) => a.id !== viewer.id);
      if (recipients.length) {
        await tx.insert(tables.notifications).values(
          recipients.map((a) => ({
            userId: a.id,
            type: "application_submitted",
            payload: {
              applicantId: viewer.id,
              applicantName: parsed.data.name,
              resubmitted,
            },
          })),
        );
        for (const a of recipients) {
          eventIds.push(
            await emitEvent(tx, "account.application_submitted", {
              adminId: a.id,
              applicantId: viewer.id,
              applicantName: parsed.data.name,
              resubmitted,
            }),
          );
        }
      }
    }

    if (resubmitted)
      await recordAudit(
        {
          actorId: viewer.id,
          action: "account.resubmit",
          subjectType: "user",
          subjectId: viewer.id,
        },
        tx,
      );
  });
  scheduleDelivery?.(eventIds);
  return ok({ resubmitted });
}

// ---------------------------------------------------------------------------
// Credential recovery (AUTH-08). Responses never reveal account existence.
// ---------------------------------------------------------------------------

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function requestPasswordReset(
  emailInput: string,
): Promise<ActionResult> {
  const email = emailInput.trim().toLowerCase();
  if (!email) return err("validation", "Enter your email address.");

  const user = await db.query.users.findFirst({
    where: eq(tables.users.email, email),
  });
  if (user?.passwordHash) {
    const raw = randomBytes(32).toString("hex");
    await db
      .delete(tables.verificationTokens)
      .where(eq(tables.verificationTokens.identifier, `reset:${email}`));
    await db.insert(tables.verificationTokens).values({
      identifier: `reset:${email}`,
      token: hashToken(raw),
      expires: new Date(Date.now() + 60 * 60 * 1000),
    });
    const base = process.env.AUTH_URL ?? "http://localhost:3000";
    await sendMail({
      to: email,
      subject: "Reset your MCAC portal password",
      text: `A password reset was requested for this address.\n\nReset link (valid for 1 hour):\n${base}/reset-password?email=${encodeURIComponent(email)}&token=${raw}\n\nIf you did not request this, ignore this email.`,
    });
  }
  // Same response either way.
  return ok(undefined);
}

export async function resetPassword(input: {
  email: string;
  token: string;
  password: string;
}): Promise<ActionResult> {
  const email = input.email.trim().toLowerCase();
  if (input.password.length < 10)
    return err("validation", "Use at least 10 characters.", {
      password: ["Use at least 10 characters."],
    });

  const record = await db.query.verificationTokens.findFirst({
    where: and(
      eq(tables.verificationTokens.identifier, `reset:${email}`),
      eq(tables.verificationTokens.token, hashToken(input.token)),
    ),
  });
  if (!record || record.expires < new Date())
    return err("conflict", "This reset link is invalid or has expired. Request a new one.");

  const passwordHash = await bcrypt.hash(input.password, 10);
  await db.transaction(async (tx) => {
    await tx
      .update(tables.users)
      .set({ passwordHash, credentialsChangedAt: new Date() })
      .where(eq(tables.users.email, email));
    await tx
      .delete(tables.verificationTokens)
      .where(eq(tables.verificationTokens.identifier, `reset:${email}`));
  });
  const user = await db.query.users.findFirst({
    where: eq(tables.users.email, email),
  });
  if (user)
    await recordAudit({
      actorId: user.id,
      action: "account.password_reset",
      subjectType: "user",
      subjectId: user.id,
    });
  return ok(undefined);
}

// ---------------------------------------------------------------------------
// Application snapshot for the lifecycle screens (AUTH-05/06)
// ---------------------------------------------------------------------------

export async function getApplicationState(viewer: Viewer) {
  const [consented, latestConsent, evidence] = await Promise.all([
    hasCurrentConsent(viewer.id),
    db.query.consentRecords.findFirst({
      where: eq(tables.consentRecords.userId, viewer.id),
      orderBy: desc(tables.consentRecords.acceptedAt),
    }),
    getEvidenceStatus(viewer.id),
  ]);
  const user = await db.query.users.findFirst({
    where: eq(tables.users.id, viewer.id),
    columns: { status: true, statusReason: true, statusChangedAt: true },
  });
  return {
    status: user?.status ?? viewer.status,
    statusReason: user?.statusReason ?? null,
    statusChangedAt: user?.statusChangedAt ?? null,
    consented,
    latestConsentAt: latestConsent?.acceptedAt ?? null,
    evidenceComplete: evidence.complete,
  };
}
