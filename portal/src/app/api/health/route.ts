import { and, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, tables } from "@/db";
import { productionConfigErrors } from "@/lib/production-readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);

    const configErrors = productionConfigErrors(process.env);
    if (configErrors.length) {
      console.error("[health] production configuration invalid", configErrors);
      return unavailable("connected", "invalid", "unknown");
    }

    if (process.env.NODE_ENV === "production") {
      const [notice, admin, expertise] = await Promise.all([
        db.query.privacyNotices.findFirst({
          where: eq(tables.privacyNotices.isCurrent, true),
          columns: { body: true },
        }),
        db.query.users.findFirst({
          where: and(
            inArray(tables.users.role, ["admin", "superadmin"]),
            eq(tables.users.status, "approved"),
          ),
          columns: { id: true },
        }),
        db.query.expertiseTags.findFirst({ columns: { id: true } }),
      ]);
      const referenceDataReady = Boolean(
        notice &&
          admin &&
          expertise &&
          !/INTERIM PRIVACY DISCLOSURE|DRAFT|PENDING LEGAL REVIEW|\[[^\]]*CONFIRM[^\]]*\]/i.test(
            notice.body,
          ),
      );
      if (!referenceDataReady) {
        return unavailable("connected", "valid", "incomplete");
      }
    }

    return NextResponse.json(
      {
        status: "ok",
        database: "connected",
        configuration: "valid",
        referenceData: "ready",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return unavailable("unavailable", "unknown", "unknown");
  }
}

function unavailable(
  database: "connected" | "unavailable",
  configuration: "valid" | "invalid" | "unknown",
  referenceData: "incomplete" | "unknown",
) {
  return NextResponse.json(
    {
      status: "error",
      database,
      configuration,
      referenceData,
    },
    {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
