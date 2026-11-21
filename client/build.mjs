import { cpSync, mkdirSync, existsSync, readdirSync, readFileSync, renameSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "client", "dist");

mkdirSync(dist, { recursive: true });

// Remove previously hashed bundles so stale files don't pile up.
for (const f of readdirSync(dist)) {
  if (/^main\.[0-9a-f]{8}\.(js|css)$/.test(f)) rmSync(join(dist, f));
}

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

// Cache-bust the bundle: content-hashed filenames so phones with the app
// saved to the home screen never serve a stale copy after a deploy. The shell
// (index.html) is served no-cache, so it always points at the current files.
const hashed = {};
for (const name of ["main.js", "main.css"]) {
  const p = join(dist, name);
  if (!existsSync(p)) continue;
  const hash = createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 8);
  const hashedName = name.replace(".", `.${hash}.`);
  renameSync(p, join(dist, hashedName));
  hashed[name] = hashedName;
}

for (const f of ["index.html", "manifest.json", "icon.svg", "icon-192.png", "icon-512.png", "og-image.png", "about.html"]) {
  const src = join(root, "client", "public", f);
  if (f === "index.html") {
    cpSync(join(root, "client", "index.html"), join(dist, "index.html"));
    continue;
  }
  if (existsSync(src)) cpSync(src, join(dist, f));
}

// Point the shell at the hashed bundle files.
const htmlPath = join(dist, "index.html");
let html = readFileSync(htmlPath, "utf-8");
for (const [name, hashedName] of Object.entries(hashed)) {
  html = html.replace(`"/${name}"`, `"/${hashedName}"`);
}
writeFileSync(htmlPath, html);
console.log("Client built to", dist, "bundles:", JSON.stringify(hashed));
