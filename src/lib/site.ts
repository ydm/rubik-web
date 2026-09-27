/** Names and the public address shared by the page metadata, manifest,
 *  robots.txt and sitemap. */

export const SITE_NAME = "Кубът на Рубик";
export const SITE_SHORT_NAME = "Рубик";
export const SITE_DESCRIPTION =
  "Оцвети своя куб и виж как да го подредиш стъпка по стъпка.";

/** The app's header and tab bar colour (zinc-950), used for the browser UI. */
export const THEME_COLOR = "#09090b";

/**
 * Where the site is served, including any sub-path — e.g.
 * `https://user.github.io/repo`. Share previews and the sitemap need absolute
 * links, and the page is prerendered, so set `SITE_URL` when building for
 * production. On Vercel the production domain is picked up without it.
 */
export const SITE_URL = new URL(
  process.env.SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000"),
);

/** The sub-path the site is served from (`""` at a domain's root), from
 *  `BASE_PATH` via next.config.ts. */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** A root-relative path (`/icons/x.png`) as the browser must request it. */
export function withBasePath(path: string): string {
  return `${BASE_PATH}${path}`;
}

/** An absolute URL for a site path, keeping `SITE_URL`'s own sub-path
 *  (`new URL("/x", SITE_URL)` would drop it). */
export function absoluteUrl(path: string): string {
  const base = SITE_URL.href.endsWith("/") ? SITE_URL.href : `${SITE_URL.href}/`;
  return new URL(path.replace(/^\/+/, ""), base).toString();
}
