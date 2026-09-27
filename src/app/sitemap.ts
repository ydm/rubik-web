import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

// Generated once at build time: required by the static export (output: "export").
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: absoluteUrl("/"), changeFrequency: "monthly", priority: 1 }];
}
