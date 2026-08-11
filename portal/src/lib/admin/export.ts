import { asc, eq } from "drizzle-orm";
import { db, tables } from "@/db";
import { adminAccessError, type Viewer } from "@/lib/authz";
import { recordAudit } from "@/lib/audit";
import { ok, err, type ActionResult } from "@/lib/contracts/result";

// Member dataset export (MEMB-05, ADMIN-04). Exports are an admin surface,
// so admin-visible fields are included; every cell is sanitized against
// spreadsheet formula injection before it reaches CSV or Excel.

const HEADERS = [
  "Name",
  "Email",
  "Status",
  "City",
  "Company",
  "Title",
  "Phone",
  "LinkedIn",
  "Expertise",
  "Phone visibility",
  "Email visibility",
  "LinkedIn visibility",
  "Joined",
] as const;

function sanitizeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

async function exportRows(): Promise<string[][]> {
  const rows = await db
    .select({
      id: tables.users.id,
      name: tables.users.name,
      email: tables.users.email,
      status: tables.users.status,
      createdAt: tables.users.createdAt,
      city: tables.profiles.city,
      company: tables.profiles.company,
      title: tables.profiles.title,
      phone: tables.profiles.phone,
      linkedinUrl: tables.profiles.linkedinUrl,
      phoneVisibility: tables.profiles.phoneVisibility,
      emailVisibility: tables.profiles.emailVisibility,
      linkedinVisibility: tables.profiles.linkedinVisibility,
    })
    .from(tables.users)
    .leftJoin(tables.profiles, eq(tables.profiles.userId, tables.users.id))
    .where(eq(tables.users.status, "approved"))
    .orderBy(asc(tables.users.name));

  const tagRows = await db
    .select({
      userId: tables.memberTags.userId,
      label: tables.expertiseTags.label,
    })
    .from(tables.memberTags)
    .innerJoin(
      tables.expertiseTags,
      eq(tables.expertiseTags.id, tables.memberTags.tagId),
    );
  const tagsByUser = new Map<string, string[]>();
  for (const t of tagRows)
    tagsByUser.set(t.userId, [...(tagsByUser.get(t.userId) ?? []), t.label]);

  return rows.map((r) =>
    [
      r.name,
      r.email,
      r.status,
      r.city ?? "",
      r.company ?? "",
      r.title ?? "",
      r.phone ?? "",
      r.linkedinUrl ?? "",
      (tagsByUser.get(r.id) ?? []).join("; "),
      r.phoneVisibility ?? "",
      r.emailVisibility ?? "",
      r.linkedinVisibility ?? "",
      r.createdAt.toISOString().slice(0, 10),
    ].map(sanitizeCell),
  );
}

export async function exportMembersCsv(
  admin: Viewer | null,
): Promise<ActionResult<{ filename: string; content: string }>> {
  const denied = adminAccessError(admin);
  if (denied) return err(denied, "Administrator access is required.");
  const rows = await exportRows();
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const content = [
    HEADERS.map(escape).join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ].join("\r\n");
  await recordAudit({
    actorId: admin!.id,
    action: "members.export",
    subjectType: "export",
    subjectId: "csv",
    detail: { rows: rows.length },
  });
  return ok({ filename: "mcac-members.csv", content });
}

export async function exportMembersXlsx(
  admin: Viewer | null,
): Promise<ActionResult<{ filename: string; buffer: Buffer }>> {
  const denied = adminAccessError(admin);
  if (denied) return err(denied, "Administrator access is required.");
  const rows = await exportRows();
  // ExcelJS pulls in Node-only ZIP adapters. Load it only after authorization
  // and only for an Excel request so CSV and signed-out requests cannot fail
  // while evaluating the route module in a serverless runtime.
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Members");
  sheet.addRow([...HEADERS]);
  sheet.getRow(1).font = { bold: true };
  for (const r of rows) sheet.addRow(r);
  sheet.columns.forEach((col) => {
    col.width = 18;
  });
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  await recordAudit({
    actorId: admin!.id,
    action: "members.export",
    subjectType: "export",
    subjectId: "xlsx",
    detail: { rows: rows.length },
  });
  return ok({ filename: "mcac-members.xlsx", buffer });
}
