import { cpSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "client", "dist");

mkdirSync(dist, { recursive: true });

const result = await Bun.build({
  entrypoints: [join(root, "client", "src", "main.tsx")],
  outdir: dist,
  target: "browser",
  minify: true,
  sourcemap: "none",
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

for (const f of ["index.html", "manifest.json", "icon.svg", "icon-192.png", "icon-512.png", "og-image.png", "about.html"]) {
  const src = join(root, "client", "public", f);
  if (f === "index.html") {
    cpSync(join(root, "client", "index.html"), join(dist, "index.html"));
    continue;
  }
  if (existsSync(src)) cpSync(src, join(dist, f));
}
console.log("Client built to", dist);
