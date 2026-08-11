import { requireViewer } from "@/lib/auth";
import { getAttachmentForDownload } from "@/lib/attachments";
import type { ErrorCode } from "@/lib/contracts/result";

// FILE-01 authorized attachment download (docs/build/attachments.md).
// Streams local files or 302s to a short-lived signed URL. Object keys are
// never exposed; error responses use the ActionResult envelope.

const HTTP_STATUS: Record<ErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  pending_approval: 403,
  account_restricted: 403,
  section_disabled: 403,
  validation: 400,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  internal: 500,
};

/** RFC 6266/5987 Content-Disposition with the original filename. */
function contentDisposition(filename: string): string {
  const fallback =
    filename
      // Keep printable ASCII only; quotes and backslashes would break the header.
      .replace(/[^\x20-\x7e]/g, "_")
      .replace(/["\\]/g, "_") || "attachment";
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const viewer = await requireViewer();

  const result = await getAttachmentForDownload(viewer, id);
  if (!result.ok) {
    return Response.json(
      { ok: false, code: result.code, message: result.message },
      { status: HTTP_STATUS[result.code] ?? 500 },
    );
  }

  const { attachment, stream, signedUrl } = result.data;

  if (signedUrl) {
    return Response.redirect(signedUrl, 302);
  }
  if (!stream) {
    return Response.json(
      { ok: false, code: "internal", message: "File delivery is unavailable." },
      { status: 500 },
    );
  }

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": attachment.mime,
      "Content-Length": String(attachment.sizeBytes),
      "Content-Disposition": contentDisposition(attachment.filename),
      "Cache-Control": "private, no-store",
      // Uploads are member-supplied; never let the browser sniff a different
      // content type than the validated stored mime.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
