import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    host: "https://reitbeteiligung.app",
    rules: {
      allow: "/",
      userAgent: "*"
    },
    sitemap: "https://reitbeteiligung.app/sitemap.xml"
  };
}
