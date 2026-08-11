import { NextResponse } from "next/server";
import { runExpirySweep } from "@/lib/posts/mutations";
import { processOutbox } from "@/lib/notifications/worker";
import { requireViewer } from "@/lib/auth";
import { adminAccessError } from "@/lib/authz";

// Background jobs entry point: opportunity expiry (OPPS-04) and outbox email
// delivery (NOTF-02). Vercel Cron calls GET with CRON_SECRET. Other schedulers
// call POST with JOBS_SECRET. Administrators can also call POST.

async function runJobs() {
  const expired = await runExpirySweep();
  const outbox = await processOutbox();
  return NextResponse.json({ expired, ...outbox });
}

function hasBearerSecret(request: Request, secret: string | undefined) {
  const header = request.headers.get("authorization");
  return Boolean(secret) && header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!hasBearerSecret(request, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return runJobs();
}

export async function POST(request: Request) {
  if (!hasBearerSecret(request, process.env.JOBS_SECRET)) {
    const viewer = await requireViewer();
    if (adminAccessError(viewer))
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  return runJobs();
}
