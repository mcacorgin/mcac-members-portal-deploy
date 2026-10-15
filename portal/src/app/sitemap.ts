import type { MetadataRoute } from "next";

// Only the pages anyone can read without signing in. Everything else sits
// behind sign-in and is disallowed in robots.ts.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://mcac.org.in",
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: "https://mcac.org.in/privacy",
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
