import { requireViewerFromRequest } from "@/lib/auth";
import type { NextRequest } from "next/server";
import { exportMembersCsv, exportMembersXlsx } from "@/lib/admin/export";

// ADMIN-04 export endpoint: GET /admin/members/export?format=csv|xlsx.
// Authorization happens inside the export functions (adminAccessError);
// any denial becomes a 403 JSON response and no data is streamed.

export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "csv";
  if (format !== "csv" && format !== "xlsx") {
    return Response.json(
      { ok: false, code: "validation", message: "format must be csv or xlsx" },
      { status: 400 },
    );
  }

  const viewer = await requireViewerFromRequest(request);

  if (format === "csv") {
    const result = await exportMembersCsv(viewer);
    if (!result.ok) {
      return Response.json(
        { ok: false, code: result.code, message: result.message },
        { status: 403 },
      );
    }
    return new Response(result.data.content, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.data.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const result = await exportMembersXlsx(viewer);
  if (!result.ok) {
    return Response.json(
      { ok: false, code: result.code, message: result.message },
      { status: 403 },
    );
  }
  return new Response(new Uint8Array(result.data.buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${result.data.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
