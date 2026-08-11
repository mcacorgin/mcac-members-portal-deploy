/**
 * Promote exactly two already-registered LinkedIn applicants.
 * Dry-run by default. This script never creates or links an identity.
 */
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as tables from "./schema";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name}.`);
  return value;
}

async function main() {
  const emails = required("INITIAL_SUPERADMIN_EMAILS")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length !== 2 || new Set(emails).size !== 2) {
    throw new Error(
      "INITIAL_SUPERADMIN_EMAILS must contain exactly two unique emails.",
    );
  }

  const client = postgres(required("DATABASE_URL"), { max: 1 });
  const db = drizzle(client, { schema: tables });
  try {
    const currentNotice = await db.query.privacyNotices.findFirst({
      where: eq(tables.privacyNotices.isCurrent, true),
      columns: { version: true },
    });
    if (!currentNotice) throw new Error("No current privacy notice exists.");

    const users = await db.query.users.findMany({
      where: inArray(tables.users.email, emails),
      columns: { id: true, email: true, role: true, status: true },
    });
    if (
      users.length !== 2 ||
      users.some((user) => !emails.includes(user.email.toLowerCase()))
    ) {
      throw new Error("Both exact applicants must register before promotion.");
    }

    for (const user of users) {
      const [linkedin, profile, consent, tags] = await Promise.all([
        db.query.accounts.findFirst({
          where: and(
            eq(tables.accounts.userId, user.id),
            eq(tables.accounts.provider, "linkedin"),
          ),
          columns: { userId: true },
        }),
        db.query.profiles.findFirst({
          where: eq(tables.profiles.userId, user.id),
          columns: { onboardingCompletedAt: true, contactChoicesAt: true },
        }),
        db.query.consentRecords.findFirst({
          where: and(
            eq(tables.consentRecords.userId, user.id),
            eq(tables.consentRecords.noticeVersion, currentNotice.version),
          ),
          columns: { id: true },
        }),
        db.query.memberTags.findMany({
          where: eq(tables.memberTags.userId, user.id),
          columns: { tagId: true },
        }),
      ]);
      if (
        !linkedin ||
        !profile?.contactChoicesAt ||
        !profile.onboardingCompletedAt ||
        !consent ||
        tags.length === 0
      ) {
        throw new Error(
          `${user.email} has not completed LinkedIn registration, consent, and application evidence.`,
        );
      }
    }

    if (process.env.PROMOTE_INITIAL_SUPERADMINS !== "apply") {
      console.log(
        `Dry run passed for: ${users.map((user) => user.email).sort().join(", ")}.`,
      );
      console.log(
        "Set PROMOTE_INITIAL_SUPERADMINS=apply to approve and promote both accounts.",
      );
      return;
    }

    await db.transaction(async (tx) => {
      for (const user of users) {
        await tx
          .update(tables.users)
          .set({
            role: "superadmin",
            status: "approved",
            statusReason: null,
            statusChangedAt: new Date(),
          })
          .where(eq(tables.users.id, user.id));
        await tx.insert(tables.auditLog).values({
          actorId: null,
          action: "account.initial_superadmin_promotion",
          subjectType: "user",
          subjectId: user.id,
          detail: { fromRole: user.role, fromStatus: user.status },
        });
      }
    });
    console.log(
      `Approved and promoted exactly: ${users.map((user) => user.email).sort().join(", ")}.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
