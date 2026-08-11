import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://mcac.org.in",
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
