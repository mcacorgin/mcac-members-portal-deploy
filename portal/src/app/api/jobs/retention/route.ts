import { NextResponse } from "next/server";
import { runAttachmentRetention } from "@/lib/attachments/retention";

function hasBearerSecret(request: Request, secret: string | undefined) {
  return Boolean(secret) &&
    request.headers.get("authorization") === `Bearer ${secret}`;
}

async function run() {
  const retention = await runAttachmentRetention();
  return NextResponse.json({ retention });
}

export async function GET(request: Request) {
  if (!hasBearerSecret(request, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return run();
}

export async function POST(request: Request) {
  if (!hasBearerSecret(request, process.env.JOBS_SECRET)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return run();
}
