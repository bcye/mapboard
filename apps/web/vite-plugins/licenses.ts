import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite-plus";

export const LICENSES_FILE = "third-party-licenses.txt";

interface LicensedPackage {
  name: string;
  versions: string[];
  paths: string[];
  license: string;
  homepage?: string;
}

const LICENSE_FILE = /^(licen[cs]e|copying)/i;

/** Plain-text notices for the production dependencies of this app, via `pnpm licenses`. */
function licensesText(): string {
  const json = execFileSync(
    "vp",
    ["pm", "licenses", "list", "--json", "--", "--prod", "--filter", "web..."],
    {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  const byLicense = JSON.parse(json) as Record<string, LicensedPackage[]>;
  const packages = Object.values(byLicense)
    .flat()
    .sort((a, b) => a.name.localeCompare(b.name));

  const sections = packages.map((pkg) => {
    const header = `${pkg.name} ${pkg.versions.join(", ")}\nLicense: ${pkg.license}`;
    const dir = pkg.paths[0];
    const file = dir && readdirSync(dir).find((name) => LICENSE_FILE.test(name));
    const text = file
      ? readFileSync(join(dir, file), "utf8").trim()
      : `(No license file in the package.${pkg.homepage ? ` See ${pkg.homepage}` : ""})`;
    return `${header}\n\n${text}`;
  });

  const intro = [
    "Third-party software used by this site",
    "",
    "Map data © OpenStreetMap contributors (https://www.openstreetmap.org/copyright),",
    "tiles by Protomaps (https://protomaps.com).",
  ].join("\n");
  return [intro, ...sections].join(`\n\n${"-".repeat(80)}\n\n`) + "\n";
}

/** Serves `third-party-licenses.txt` in dev and emits it into the build. */
export function thirdPartyLicenses(): Plugin {
  let text: string | undefined;
  const get = () => (text ??= licensesText());
  return {
    name: "third-party-licenses",
    configureServer(server) {
      server.middlewares.use(`/${LICENSES_FILE}`, (_req, res) => {
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end(get());
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: LICENSES_FILE, source: get() });
    },
  };
}
