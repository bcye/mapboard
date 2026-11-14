/**
 * Site-wide strings for the page title and the SEO / social meta tags.
 * `vite.config.ts` writes these into `index.html` at build time; the app uses them at runtime.
 */
export const site = {
  /** App name: the page title, and the suffix after a board's name. */
  name: "Mapboard",
  /** Search result and link preview text. */
  description: "Plan freely with markers, arrows and post-its you can place on a world map.",
  /**
   * Public origin, e.g. "https://example.com". Needed for the canonical link and `og:url`,
   * and to make `image` absolute. Leave empty to skip those tags.
   */
  url: "https://mapboard.bruceroettgers.eu",
  /** Link preview image, a path in `public/` (e.g. "/og.png", 1200×630). Leave empty to skip. */
  image: "/og.png",
  /** Alt text for `image`. */
  imageAlt:
    "A Mapboard board of a Scottish Highlands road trip: a hand-drawn route between markers, with post-it notes around it.",
  /** X/Twitter handle, e.g. "@example". Leave empty to skip. */
  twitter: "",
  locale: "en_US",
  themeColor: "#fffbeb",
};

export function pageTitle(boardName?: string) {
  return boardName ? `${boardName} · ${site.name}` : site.name;
}
