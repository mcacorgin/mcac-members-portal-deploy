import type { NextRequest } from "next/server";
import { requireViewerFromRequest } from "@/lib/auth";
import { memberAccessError } from "@/lib/authz";
import { getPostDetail } from "@/lib/posts/queries";
import {
  buildIcs,
  calendarEventForPost,
  icsFilename,
  siteOrigin,
} from "@/lib/posts/calendar";

// HOME-02 add to calendar: GET /posts/[id]/calendar returns an event post as
// an .ics file for Apple Calendar and Outlook. The gate is the post page's:
// a signed-in approved member for whom getPostDetail succeeds. Every refusal
// is the same bare 404, so the route never says whether a post exists.

function notFound(): Response {
  return new Response("Not found", {
    status: 404,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  const viewer = await requireViewerFromRequest(request);
  if (memberAccessError(viewer)) return notFound();

  const result = await getPostDetail(viewer, id);
  if (!result.ok || result.data.type !== "event") return notFound();

  const origin = siteOrigin(process.env.AUTH_URL) ?? request.nextUrl.origin;
  const event = calendarEventForPost(result.data, origin);
  if (!event) return notFound();

  return new Response(buildIcs(event), {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${icsFilename(event.title)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
