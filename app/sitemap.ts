import type { MetadataRoute } from "next";

const BASE_URL = "https://reitbeteiligung.app";

// R1 sitemap: only stable public entry points are exposed.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE_URL + "/", changeFrequency: "weekly", priority: 1 },
    { url: BASE_URL + "/suchen", changeFrequency: "daily", priority: 0.9 },
    { url: BASE_URL + "/login", changeFrequency: "monthly", priority: 0.5 },
    { url: BASE_URL + "/signup", changeFrequency: "monthly", priority: 0.6 },
    { url: BASE_URL + "/faq", changeFrequency: "monthly", priority: 0.4 },
    { url: BASE_URL + "/passwort-vergessen", changeFrequency: "yearly", priority: 0.3 }
  ];
}
