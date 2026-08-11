/**
 * Add the minimum reference data and first administrator to a real database.
 * This command is idempotent and does not delete or rewrite member data.
 */
import { readFile } from "node:fs/promises";
import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import * as tables from "./schema";
import { EXPERTISE_TAGS } from "./reference-data";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name} before production bootstrap.`);
  return value;
}

function positiveInteger(name: string): number {
  const value = Number(required(name));
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

async function main() {
  const databaseUrl = required("DATABASE_URL");
  const noticePath = required("PRIVACY_NOTICE_PATH");
  const noticeVersion = positiveInteger("PRIVACY_NOTICE_VERSION");
  const adminEmail = required("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
  const adminName = required("BOOTSTRAP_ADMIN_NAME");
  const adminPassword = required("BOOTSTRAP_ADMIN_PASSWORD");
  if (adminPassword.length < 12) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must have at least 12 characters.");
  }

  const noticeBody = (await readFile(noticePath, "utf8")).trim();
  if (noticeBody.length < 100) {
    throw new Error("The approved privacy notice must have at least 100 characters.");
  }
  if (/DRAFT|PENDING LEGAL REVIEW|\[[^\]]*CONFIRM[^\]]*\]/i.test(noticeBody)) {
    throw new Error(
      "The privacy notice contains draft or unconfirmed placeholder text.",
    );
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client, { schema: tables });

  try {
    await db.transaction(async (tx) => {
      const [existingNotice] = await tx
        .select()
        .from(tables.privacyNotices)
        .where(eq(tables.privacyNotices.version, noticeVersion))
        .limit(1);

      if (existingNotice && existingNotice.body !== noticeBody) {
        throw new Error(
          `Privacy notice version ${noticeVersion} already exists with different text.`,
        );
      }
      if (!existingNotice) {
        await tx
          .update(tables.privacyNotices)
          .set({ isCurrent: false })
          .where(eq(tables.privacyNotices.isCurrent, true));
        await tx.insert(tables.privacyNotices).values({
          version: noticeVersion,
          body: noticeBody,
          isCurrent: true,
        });
      }

      await tx
        .insert(tables.expertiseTags)
        .values(EXPERTISE_TAGS.map((label) => ({ label })))
        .onConflictDoNothing({ target: tables.expertiseTags.label });

      const [existingAdmin] = await tx
        .select()
        .from(tables.users)
        .where(eq(tables.users.email, adminEmail))
        .limit(1);

      if (existingAdmin) {
        if (
          existingAdmin.role !== "admin" ||
          existingAdmin.status !== "approved"
        ) {
          throw new Error(
            `${adminEmail} exists but is not an approved administrator.`,
          );
        }
        return;
      }

      const [otherAdmin] = await tx
        .select({ email: tables.users.email })
        .from(tables.users)
        .where(eq(tables.users.role, "admin"))
        .limit(1);
      if (otherAdmin) {
        throw new Error(
          `An administrator already exists (${otherAdmin.email}). Refusing to add another during bootstrap.`,
        );
      }

      const [admin] = await tx
        .insert(tables.users)
        .values({
          email: adminEmail,
          name: adminName,
          passwordHash,
          emailVerified: new Date(),
          role: "admin",
          status: "approved",
        })
        .returning({ id: tables.users.id });

      await tx.insert(tables.profiles).values({
        userId: admin.id,
        contactChoicesAt: new Date(),
        onboardingCompletedAt: new Date(),
      });
    });

    console.log(
      `Production bootstrap ready: notice v${noticeVersion}, ${EXPERTISE_TAGS.length} expertise labels, administrator ${adminEmail}.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
