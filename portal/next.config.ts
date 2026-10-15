import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "connect-src 'self'",
      "font-src 'self' data:",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data: blob: https://*.licdn.com https://*.licdn-ei.com",
      "object-src 'none'",
      `script-src 'self' 'unsafe-inline'${
        process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""
      }`,
      "style-src 'self' 'unsafe-inline'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  },
] as const;

// Addresses people guess for the two entry pages. Temporary (307) redirects,
// so browsers never cache them and the targets stay free to change. They run
// before src/proxy.ts, so on the dev site the gate still guards the target.
const entryRedirects = [
  { to: "/sign-in", from: ["/login", "/log-in", "/signin"] },
  { to: "/register", from: ["/signup", "/sign-up", "/apply", "/join"] },
];

const nextConfig: NextConfig = {
  // The floating dev-tools badge overlaps the 390px bottom tab bar and
  // intercepts taps during mobile review; dev-overlay errors still surface.
  devIndicators: false,
  async headers() {
    return [{ source: "/(.*)", headers: [...securityHeaders] }];
  },
  async redirects() {
    return entryRedirects.flatMap(({ to, from }) =>
      from.map((source) => ({ source, destination: to, permanent: false })),
    );
  },
};

export default nextConfig;
