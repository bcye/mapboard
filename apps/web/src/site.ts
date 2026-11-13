/**
 * Site-wide strings for the page title and the SEO / social meta tags.
 * `vite.config.ts` writes these into `index.html` at build time; the app uses them at runtime.
 */
export const site = {
  /** App name: the page title, and the suffix after a board's name. */
  name: "Map board",
  /** Search result and link preview text. */
  description: "Sketch routes, drop markers and stick post-its on a real map.",
  /**
   * Public origin, e.g. "https://example.com". Needed for the canonical link and `og:url`,
   * and to make `image` absolute. Leave empty to skip those tags.
   */
  url: "",
  /** Link preview image, a path in `public/` (e.g. "/og.png", 1200×630). Leave empty to skip. */
  image: "",
  /** Alt text for `image`. */
  imageAlt: "",
  /** X/Twitter handle, e.g. "@example". Leave empty to skip. */
  twitter: "",
  locale: "en_US",
  themeColor: "#fffbeb",
};

export function pageTitle(boardName?: string) {
  return boardName ? `${boardName} · ${site.name}` : site.name;
}
