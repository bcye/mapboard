import type { HtmlTagDescriptor, Plugin } from "vite-plus";
import { site } from "../src/site.ts";

/** Writes the title and SEO / social meta tags from `src/site.ts` into `index.html`. */
export function siteMeta(): Plugin {
  const origin = site.url.replace(/\/+$/, "");
  const absolute = (path: string) => (/^https?:\/\//.test(path) || !origin ? path : origin + path);
  const meta: Record<string, string>[] = [
    { name: "description", content: site.description },
    { name: "theme-color", content: site.themeColor },
    { name: "application-name", content: site.name },
    { name: "apple-mobile-web-app-title", content: site.name },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: site.name },
    { property: "og:title", content: site.name },
    { property: "og:description", content: site.shareDescription },
    { property: "og:locale", content: site.locale },
    { name: "twitter:card", content: site.image ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: site.name },
    { name: "twitter:description", content: site.shareDescription },
  ];
  if (origin) meta.push({ property: "og:url", content: `${origin}/` });
  if (site.image) {
    meta.push(
      { property: "og:image", content: absolute(site.image) },
      { name: "twitter:image", content: absolute(site.image) },
    );
    if (site.imageAlt) {
      meta.push(
        { property: "og:image:alt", content: site.imageAlt },
        { name: "twitter:image:alt", content: site.imageAlt },
      );
    }
  }
  if (site.twitter) meta.push({ name: "twitter:site", content: site.twitter });

  const tags: HtmlTagDescriptor[] = [
    { tag: "title", children: site.title },
    ...meta.map((attrs) => ({ tag: "meta", attrs })),
  ];
  if (origin) tags.push({ tag: "link", attrs: { rel: "canonical", href: `${origin}/` } });

  return {
    name: "site-meta",
    transformIndexHtml: () => tags.map((t) => ({ ...t, injectTo: "head" as const })),
  };
}
