import { createHash, randomBytes } from "crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, tables } from "@/db";
import { recordAudit } from "@/lib/audit";
import { consumeRateLimit } from "@/lib/auth-rate-limit";
import { err, ok, type ActionResult } from "@/lib/contracts/result";
import { sendMail, type Mail } from "@/lib/mail";
import type { Viewer } from "@/lib/authz";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(254, "Enter an email address with 254 characters or fewer.");
const TOKEN_TTL_MS = 60 * 60 * 1000;
const USER_REQUEST_LIMIT = 3;
const USER_REQUEST_WINDOW_MS = 60 * 60 * 1000;
const TARGET_REQUEST_LIMIT = 5;
const TARGET_REQUEST_WINDOW_MS = 24 * 60 * 60 * 1000;
const ALLOWED_STATUSES = new Set(["pending", "approved"]);

type Mailer = (mail: Mail) => Promise<{ delivered: boolean }>;

export type PreferredContactEmailState = {
  identityEmail: string;
  effectiveEmail: string;
  preferredEmail: string | null;
  pendingEmail: string | null;
};

export function communicationEmail(user: {
  email: string;
  preferredContactEmail: string | null;
  preferredContactEmailVerifiedAt: Date | null;
}): string {
  return user.preferredContactEmail && user.preferredContactEmailVerifiedAt
    ? user.preferredContactEmail
    : user.email;
}

export async function getPreferredContactEmailState(
  userId: string,
): Promise<PreferredContactEmailState | null> {
  const [user, verification] = await Promise.all([
    db.query.users.findFirst({
      where: eq(tables.users.id, userId),
      columns: {
        email: true,
        preferredContactEmail: true,
        preferredContactEmailVerifiedAt: true,
      },
    }),
    db.query.preferredContactEmailVerifications.findFirst({
      where: eq(tables.preferredContactEmailVerifications.userId, userId),
      columns: { pendingEmail: true, expiresAt: true },
    }),
  ]);
  if (!user) return null;
  return {
    identityEmail: user.email,
    effectiveEmail: communicationEmail(user),
    preferredEmail:
      user.preferredContactEmail && user.preferredContactEmailVerifiedAt
        ? user.preferredContactEmail
        : null,
    pendingEmail:
      verification && verification.expiresAt.getTime() > Date.now()
        ? verification.pendingEmail
        : null,
  };
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function verificationBaseUrl(override?: string): string | null {
  const raw = override ?? process.env.AUTH_URL;
  if (!raw) return process.env.NODE_ENV === "production" ? null : "http://localhost:3000";
  try {
    const url = new URL(raw);
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export async function requestPreferredContactEmail(
  viewer: Viewer | null,
  emailInput: string,
  options: { mailer?: Mailer; baseUrl?: string; now?: Date } = {},
): Promise<ActionResult<{ pendingEmail: string }>> {
  if (!viewer) return err("unauthorized", "Sign in to continue.");

  const parsed = emailSchema.safeParse(emailInput);
  if (!parsed.success) {
    return err("validation", "Enter a valid email address.", {
      email: parsed.error.flatten().formErrors,
    });
  }
  const email = parsed.data;
  const user = await db.query.users.findFirst({
    where: eq(tables.users.id, viewer.id),
    columns: {
      email: true,
      status: true,
      preferredContactEmail: true,
      preferredContactEmailVerifiedAt: true,
    },
  });
  if (!user || !ALLOWED_STATUSES.has(user.status))
    return err("forbidden", "This account cannot change its communication email.");
  if (email === user.email.trim().toLowerCase())
    return err("validation", "That is already your account email.", {
      email: ["That is already your account email."],
    });
  if (
    user.preferredContactEmailVerifiedAt &&
    email === user.preferredContactEmail
  )
    return err("validation", "That is already your verified communication email.", {
      email: ["That is already your verified communication email."],
    });

  const targetKey = hash(email);
  const withinUserLimit = await consumeRateLimit(
    `preferred-contact-email:user:${viewer.id}`,
    USER_REQUEST_LIMIT,
    USER_REQUEST_WINDOW_MS,
  );
  if (!withinUserLimit)
    return err(
      "rate_limited",
      "Too many verification emails were requested. Try again later.",
    );
  const withinTargetLimit = await consumeRateLimit(
    `preferred-contact-email:target:${targetKey}`,
    TARGET_REQUEST_LIMIT,
    TARGET_REQUEST_WINDOW_MS,
  );
  if (!withinTargetLimit)
    return err(
      "rate_limited",
      "Too many verification emails were requested. Try again later.",
    );

  const base = verificationBaseUrl(options.baseUrl);
  if (!base)
    return err("internal", "Email verification is temporarily unavailable.");

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hash(rawToken);
  const now = options.now ?? new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS);
  const intentCreated = await db.transaction(async (tx) => {
    const [currentUser] = await tx
      .select({
        email: tables.users.email,
        status: tables.users.status,
        preferredContactEmail: tables.users.preferredContactEmail,
        preferredContactEmailVerifiedAt:
          tables.users.preferredContactEmailVerifiedAt,
      })
      .from(tables.users)
      .where(eq(tables.users.id, viewer.id))
      .for("update");
    if (!currentUser || !ALLOWED_STATUSES.has(currentUser.status)) return false;
    if (email === currentUser.email.trim().toLowerCase()) return false;
    if (
      currentUser.preferredContactEmailVerifiedAt &&
      email === currentUser.preferredContactEmail
    )
      return false;

    await tx
      .insert(tables.preferredContactEmailVerifications)
      .values({ userId: viewer.id, pendingEmail: email, tokenHash, createdAt: now, expiresAt })
      .onConflictDoUpdate({
        target: tables.preferredContactEmailVerifications.userId,
        set: { pendingEmail: email, tokenHash, createdAt: now, expiresAt },
      });
    await recordAudit(
      {
        actorId: viewer.id,
        action: "account.preferred_contact_email.request",
        subjectType: "user",
        subjectId: viewer.id,
        detail: { targetHash: targetKey },
      },
      tx,
    );
    return true;
  });
  if (!intentCreated)
    return err("forbidden", "This account cannot change its communication email.");

  const link = `${base}/verify-contact-email?token=${encodeURIComponent(rawToken)}`;
  const mailer = options.mailer ?? sendMail;
  const delivery = await mailer({
    to: email,
    subject: "Verify your MCAC communication email",
    text: `Verify this address for MCAC portal updates. This link is valid for 1 hour:
${link}

This does not change how you sign in. If you did not request this, ignore this email.`,
  });
  if (!delivery.delivered) {
    await db
      .delete(tables.preferredContactEmailVerifications)
      .where(
        and(
          eq(tables.preferredContactEmailVerifications.userId, viewer.id),
          eq(tables.preferredContactEmailVerifications.tokenHash, tokenHash),
        ),
      );
    return err("internal", "We could not send the verification email. Try again.");
  }

  return ok({ pendingEmail: email });
}

export async function verifyPreferredContactEmail(
  viewer: Viewer | null,
  rawToken: string,
  options: { mailer?: Mailer; now?: Date } = {},
): Promise<ActionResult<{ email: string }>> {
  if (!viewer)
    return err(
      "unauthorized",
      "Sign in with the same MCAC account, then reopen this verification link.",
    );
  if (!/^[0-9a-f]{64}$/.test(rawToken))
    return err("not_found", "This verification link is invalid or expired.");

  const tokenHash = hash(rawToken);
  const now = options.now ?? new Date();
  const discoveredIntent =
    await db.query.preferredContactEmailVerifications.findFirst({
      where: eq(tables.preferredContactEmailVerifications.tokenHash, tokenHash),
      columns: { userId: true },
    });
  if (!discoveredIntent)
    return err("not_found", "This verification link is invalid or expired.");
  if (discoveredIntent.userId !== viewer.id)
    return err(
      "forbidden",
      "Sign in with the same MCAC account that requested this change.",
    );

  const result = await db.transaction(async (tx) => {
    const [user] = await tx
      .select({
        email: tables.users.email,
        status: tables.users.status,
      })
      .from(tables.users)
      .where(eq(tables.users.id, viewer.id))
      .for("update");
    if (!user || !ALLOWED_STATUSES.has(user.status)) return "forbidden" as const;

    const [intent] = await tx
      .select()
      .from(tables.preferredContactEmailVerifications)
      .where(eq(tables.preferredContactEmailVerifications.tokenHash, tokenHash))
      .for("update");
    if (
      !intent ||
      intent.userId !== viewer.id ||
      intent.expiresAt.getTime() <= now.getTime()
    )
      return null;

    await tx
      .update(tables.users)
      .set({
        preferredContactEmail: intent.pendingEmail,
        preferredContactEmailVerifiedAt: now,
      })
      .where(eq(tables.users.id, viewer.id));
    await tx
      .delete(tables.preferredContactEmailVerifications)
      .where(eq(tables.preferredContactEmailVerifications.userId, viewer.id));
    await recordAudit(
      {
        actorId: viewer.id,
        action: "account.preferred_contact_email.verify",
        subjectType: "user",
        subjectId: viewer.id,
      },
      tx,
    );
    return { email: intent.pendingEmail, identityEmail: user.email };
  });

  if (!result)
    return err("not_found", "This verification link is invalid or expired.");
  if (result === "forbidden")
    return err("forbidden", "This account cannot change its communication email.");

  const mailer = options.mailer ?? sendMail;
  const notice = await mailer({
    to: result.identityEmail,
    subject: "Your MCAC communication email changed",
    text: "Your verified email for MCAC portal notifications was changed. This did not change how you sign in. If you did not make this change, contact the MCAC office immediately.",
  });
  if (!notice.delivered)
    console.error("[preferred-contact-email] verification security notice failed");
  return ok({ email: result.email });
}

export async function clearPreferredContactEmail(
  viewer: Viewer | null,
  options: { mailer?: Mailer } = {},
): Promise<ActionResult> {
  if (!viewer) return err("unauthorized", "Sign in to continue.");
  const result = await db.transaction(async (tx) => {
    const [user] = await tx
      .select({
        email: tables.users.email,
        status: tables.users.status,
        preferredContactEmail: tables.users.preferredContactEmail,
      })
      .from(tables.users)
      .where(eq(tables.users.id, viewer.id))
      .for("update");
    if (!user || !ALLOWED_STATUSES.has(user.status)) return null;

    await tx
      .update(tables.users)
      .set({ preferredContactEmail: null, preferredContactEmailVerifiedAt: null })
      .where(eq(tables.users.id, viewer.id));
    await tx
      .delete(tables.preferredContactEmailVerifications)
      .where(eq(tables.preferredContactEmailVerifications.userId, viewer.id));
    await recordAudit(
      {
        actorId: viewer.id,
        action: "account.preferred_contact_email.clear",
        subjectType: "user",
        subjectId: viewer.id,
      },
      tx,
    );
    return user;
  });
  if (!result)
    return err("forbidden", "This account cannot change its communication email.");

  if (result.preferredContactEmail) {
    const mailer = options.mailer ?? sendMail;
    const notice = await mailer({
      to: result.email,
      subject: "Your MCAC communication email changed",
      text: "MCAC portal notifications will now use your account email again. If you did not make this change, contact the MCAC office immediately.",
    });
    if (!notice.delivered)
      console.error("[preferred-contact-email] clear security notice failed");
  }
  return ok(undefined);
}
