import { z } from "zod";
import { eq, inArray, and } from "drizzle-orm";
import { db, tables } from "@/db";
import {
  adminAccessError,
  sectionEnabledFor,
  type Section,
  type Viewer,
} from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import {
  emitEvent,
  type OutboxDeliveryScheduler,
} from "@/lib/outbox";
import {
  getConfig,
  setConfig,
  type ConfigKey,
  type ConfigValue,
} from "@/lib/config";
import { ok, err, type ActionResult } from "@/lib/contracts/result";

// Admin writes (MEMB-04, CONT-04, ADMIN-03/04). Account-status changes live
// in lib/account/lifecycle.ts; post moderation lives in the posts kernel.

const adminProfileSchema = z.object({
  name: z.string().trim().min(1).max(80),
  city: z.string().trim().max(80),
  phone: z.string().trim().max(20),
  company: z.string().trim().max(120),
  title: z.string().trim().max(120),
  bio: z.string().trim().max(1000),
  linkedinUrl: z.string().trim().url().max(200).or(z.literal("")),
  phoneVisibility: z.enum(["visible", "hidden", "admin_only"]),
  emailVisibility: z.enum(["visible", "hidden", "admin_only"]),
  linkedinVisibility: z.enum(["visible", "hidden", "admin_only"]),
  tagIds: z
    .array(z.string())
    .min(1, "Choose at least one expertise area.")
    .max(10),
});

const assignableRoleSchema = z.enum(["member", "admin"]);

/** Superadmins may grant or revoke ordinary administrator access. */
export async function setMemberRole(
  actor: Viewer | null,
  userId: string,
  role: z.infer<typeof assignableRoleSchema>,
): Promise<ActionResult> {
  const denied = adminAccessError(actor);
  if (denied || !actor || actor.role !== "superadmin") {
    return err(
      denied ?? "forbidden",
      "Super administrator access is required.",
    );
  }
  const parsed = assignableRoleSchema.safeParse(role);
  if (!parsed.success) return err("validation", "Choose a valid role.");

  const target = await db.query.users.findFirst({
    where: eq(tables.users.id, userId),
    columns: { id: true, role: true },
  });
  if (!target) return err("not_found", "Account not found.");
  if (target.role === "superadmin") {
    return err(
      "forbidden",
      "Super administrator accounts cannot be changed here.",
    );
  }
  if (target.role === parsed.data) return ok(undefined);

  await db.transaction(async (tx) => {
    await tx
      .update(tables.users)
      .set({ role: parsed.data })
      .where(eq(tables.users.id, userId));
    await recordAudit(
      {
        actorId: actor.id,
        action: "member.role_change",
        subjectType: "user",
        subjectId: userId,
        detail: { from: target.role, to: parsed.data },
      },
      tx,
    );
  });
  return ok(undefined);
}

export async function adminUpdateMemberProfile(
  admin: Viewer | null,
  userId: string,
  input: z.infer<typeof adminProfileSchema>,
): Promise<ActionResult> {
  const denied = adminAccessError(admin);
  if (denied) return err(denied, "Administrator access is required.");

  const parsed = adminProfileSchema.safeParse(input);
  if (!parsed.success)
    return err(
      "validation",
      "Check the highlighted fields.",
      parsed.error.flatten().fieldErrors,
    );

  const user = await db.query.users.findFirst({
    where: eq(tables.users.id, userId),
  });
  if (!user) return err("not_found", "Account not found.");

  if (parsed.data.tagIds.length) {
    const tags = await db.query.expertiseTags.findMany({
      where: inArray(tables.expertiseTags.id, parsed.data.tagIds),
    });
    if (tags.length !== parsed.data.tagIds.length)
      return err("validation", "Choose expertise areas from the list.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(tables.users)
      .set({ name: parsed.data.name })
      .where(eq(tables.users.id, userId));
    await tx
      .update(tables.profiles)
      .set({
        city: parsed.data.city,
        phone: parsed.data.phone,
        company: parsed.data.company,
        title: parsed.data.title,
        bio: parsed.data.bio,
        linkedinUrl: parsed.data.linkedinUrl,
        phoneVisibility: parsed.data.phoneVisibility,
        emailVisibility: parsed.data.emailVisibility,
        linkedinVisibility: parsed.data.linkedinVisibility,
      })
      .where(eq(tables.profiles.userId, userId));
    await tx
      .delete(tables.memberTags)
      .where(eq(tables.memberTags.userId, userId));
    if (parsed.data.tagIds.length)
      await tx
        .insert(tables.memberTags)
        .values(parsed.data.tagIds.map((tagId) => ({ userId, tagId })));
  });

  await recordAudit({
    actorId: admin!.id,
    action: "member.profile_update",
    subjectType: "user",
    subjectId: userId,
  });
  return ok(undefined);
}

export async function setMemberSectionOverride(
  admin: Viewer | null,
  userId: string,
  section: Section,
  enabled: boolean | null, // null clears the override (inherit global)
  scheduleDelivery?: OutboxDeliveryScheduler,
): Promise<ActionResult> {
  const denied = adminAccessError(admin);
  if (denied) return err(denied, "Administrator access is required.");

  const target = await db.query.users.findFirst({
    where: eq(tables.users.id, userId),
    columns: { id: true, status: true },
  });
  if (!target) return err("not_found", "Account not found.");

  const eventIds: number[] = [];
  await db.transaction(async (tx) => {
    const before = await sectionEnabledFor(section, userId, tx);
    if (enabled === null) {
      await tx
        .delete(tables.memberSectionOverrides)
        .where(
          and(
            eq(tables.memberSectionOverrides.userId, userId),
            eq(tables.memberSectionOverrides.section, section),
          ),
        );
    } else {
      await tx
        .insert(tables.memberSectionOverrides)
        .values({ userId, section, enabled })
        .onConflictDoUpdate({
          target: [
            tables.memberSectionOverrides.userId,
            tables.memberSectionOverrides.section,
          ],
          set: { enabled },
        });
    }
    const after = await sectionEnabledFor(section, userId, tx);

    if (after !== before && target.status === "approved") {
      await tx.insert(tables.notifications).values({
        userId,
        type: "account_sections",
        payload: { section, enabled: after },
      });
      eventIds.push(
        await emitEvent(tx, "account.sections_changed", {
          userId,
          section,
          enabled: after,
        }),
      );
    }

    await recordAudit(
      {
        actorId: admin!.id,
        action: "member.section_override",
        subjectType: "user",
        subjectId: userId,
        detail: { section, enabled },
      },
      tx,
    );
  });
  scheduleDelivery?.(eventIds);
  return ok(undefined);
}

export async function adminSetConfig<K extends ConfigKey>(
  admin: Viewer | null,
  key: K,
  value: ConfigValue<K>,
  scheduleDelivery?: OutboxDeliveryScheduler,
): Promise<ActionResult> {
  const denied = adminAccessError(admin);
  if (denied) return err(denied, "Administrator access is required.");

  // Global section toggles fan out to every approved member whose EFFECTIVE
  // access flips (CONT-04). Every other config key keeps today's behavior.
  const sectionKeyMatch = /^sections\.(opportunity|job|knowledge|event)$/.exec(
    key,
  );
  if (sectionKeyMatch) {
    const section = sectionKeyMatch[1] as Section;
    const next = Boolean(value);
    const eventIds: number[] = [];
    try {
      await db.transaction(async (tx) => {
        const prev = await getConfig(key, tx);
        if (prev === next) {
          await setConfig(key, value, admin!.id, tx);
          return; // no-op: no fan-out
        }
        // Members whose EFFECTIVE access flips: approved users whose override
        // does not already force the new effective value.
        const overrides = await tx
          .select()
          .from(tables.memberSectionOverrides)
          .where(eq(tables.memberSectionOverrides.section, section));
        const overrideByUser = new Map(
          overrides.map((o) => [o.userId, o.enabled]),
        );
        const approvedMembers = await tx
          .select({ id: tables.users.id })
          .from(tables.users)
          .where(eq(tables.users.status, "approved"));
        const affected = approvedMembers.filter((m) => {
          const ov = overrideByUser.get(m.id);
          const effBefore = prev && (ov ?? true);
          const effAfter = next && (ov ?? true);
          return effBefore !== effAfter;
        });
        await setConfig(key, value, admin!.id, tx);
        if (affected.length) {
          await tx.insert(tables.notifications).values(
            affected.map((m) => ({
              userId: m.id,
              type: "account_sections",
              payload: { section, enabled: next },
            })),
          );
          for (const m of affected) {
            eventIds.push(
              await emitEvent(tx, "account.sections_changed", {
                userId: m.id,
                section,
                enabled: next,
              }),
            );
          }
        }
        await recordAudit(
          {
            actorId: admin!.id,
            action: "config.set",
            subjectType: "config",
            subjectId: key,
            detail: { value, notified: affected.length },
          },
          tx,
        );
      });
    } catch (e) {
      console.error(`[admin] section toggle fan-out failed for ${key}`, e);
      return err("internal", "That setting could not be saved.");
    }
    scheduleDelivery?.(eventIds);
    return ok(undefined);
  }

  try {
    await setConfig(key, value, admin!.id);
  } catch {
    return err("validation", "That value is not valid for this setting.");
  }
  await recordAudit({
    actorId: admin!.id,
    action: "config.set",
    subjectType: "config",
    subjectId: key,
    detail: { value },
  });
  return ok(undefined);
}

export async function adminCreateExpertiseTag(
  admin: Viewer | null,
  label: string,
): Promise<ActionResult<{ id: string }>> {
  const denied = adminAccessError(admin);
  if (denied) return err(denied, "Administrator access is required.");
  const trimmed = label.trim();
  if (!trimmed || trimmed.length > 40)
    return err("validation", "Tag labels are 1 to 40 characters.");
  const [row] = await db
    .insert(tables.expertiseTags)
    .values({ label: trimmed })
    .onConflictDoNothing()
    .returning();
  if (!row) return err("conflict", "That tag already exists.");
  await recordAudit({
    actorId: admin!.id,
    action: "tag.create",
    subjectType: "expertise_tag",
    subjectId: row.id,
    detail: { label: trimmed },
  });
  return ok({ id: row.id });
}
