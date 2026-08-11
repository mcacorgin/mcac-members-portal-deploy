import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/api/",
        "/application/",
        "/forgot-password",
        "/home",
        "/me",
        "/notifications",
        "/people",
        "/posts/",
        "/register",
        "/reset-password",
        "/saved",
        "/share",
        "/sign-in",
      ],
    },
    sitemap: "https://mcac.org.in/sitemap.xml",
  };
}
