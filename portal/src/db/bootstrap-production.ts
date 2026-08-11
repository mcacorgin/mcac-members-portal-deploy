/**
 * Add the current privacy disclosure and reference data to a real database.
 * This command is idempotent and does not delete or rewrite member data.
 */
import { readFile } from "node:fs/promises";
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

  const noticeBody = (await readFile(noticePath, "utf8")).trim();
  if (noticeBody.length < 100) {
    throw new Error("The privacy disclosure must have at least 100 characters.");
  }
  if (/DRAFT|PENDING LEGAL REVIEW|\[[^\]]*CONFIRM[^\]]*\]/i.test(noticeBody)) {
    throw new Error(
      "The privacy notice contains draft or unconfirmed placeholder text.",
    );
  }

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

    });

    console.log(
      `Production reference data ready: notice v${noticeVersion} and ${EXPERTISE_TAGS.length} expertise labels. No user was created.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
