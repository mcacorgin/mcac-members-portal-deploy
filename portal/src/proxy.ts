import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function equal(value: string, expected: string): boolean {
  const left = Buffer.from(value);
  const right = Buffer.from(expected);

  return left.length === right.length && timingSafeEqual(left, right);
}

function credentials(request: NextRequest): [string, string] | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return null;

  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return [decoded.slice(0, separator), decoded.slice(separator + 1)];
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const username = process.env.DEV_ACCESS_USERNAME;
  const password = process.env.DEV_ACCESS_PASSWORD;

  // Production does not set these variables, so this gate is dev-only.
  if (!username || !password) return NextResponse.next();

  // Scheduled jobs already use their own rotating bearer secret. Basic auth
  // would overwrite that Authorization header and break the free scheduler.
  if (request.nextUrl.pathname.startsWith("/api/jobs/")) {
    return NextResponse.next();
  }

  // LinkedIn validates its registered callback from outside the browser. The
  // callback itself remains protected by Auth.js OAuth state validation and
  // exposes no application page or member data.
  if (request.nextUrl.pathname === "/api/auth/callback/linkedin") {
    return NextResponse.next();
  }

  const supplied = credentials(request);
  if (
    supplied &&
    equal(supplied[0], username) &&
    equal(supplied[1], password)
  ) {
    return NextResponse.next();
  }

  return new Response("MCAC development environment. Authorization required.", {
    status: 401,
    headers: {
      "Cache-Control": "no-store",
      "WWW-Authenticate": 'Basic realm="MCAC Development", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: "/:path*",
};
