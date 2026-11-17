import { NextResponse } from "next/server";
import { runExpirySweep } from "@/lib/posts/mutations";
import { processOutbox } from "@/lib/notifications/worker";
import { requireViewer } from "@/lib/auth";
import { adminAccessError } from "@/lib/authz";
import { runAttachmentRetention } from "@/lib/attachments/retention";
import { queueNeedsChangesReminders } from "@/lib/account/needs-changes-reminder";
import { getConfig } from "@/lib/config";

// Background jobs entry point: post expiry, attachment retention, the
// one-time reminder to applicants sent back for changes, and outbox email
// delivery. Vercel Cron calls GET with CRON_SECRET. Other schedulers
// call POST with JOBS_SECRET. Administrators can also call POST.

async function runJobs() {
  const expired = await runExpirySweep();
  const retention = await runAttachmentRetention();
  const remindersQueued = (await getConfig(
    "applications.needsChangesReminderEnabled",
  ))
    ? await queueNeedsChangesReminders()
    : 0;
  const outbox = await processOutbox();
  return NextResponse.json({ expired, retention, remindersQueued, ...outbox });
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
