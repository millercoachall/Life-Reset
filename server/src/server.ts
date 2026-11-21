import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "./db";
import { handleAction } from "./actions";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, "..", "..", "client", "dist");

// Initialize DB (migrations + seed) on boot.
getDb();

const PORT = Number(process.env.PORT || 3000);

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function ext(path: string): string {
  const i = path.lastIndexOf(".");
  return i >= 0 ? path.slice(i) : "";
}

// Security headers on every response. The Content-Security-Policy allows the
// HeyCatch SDK's helper host (in.heycatch.ai) for scripts and connections,
// and Google Fonts for styles/fonts — everything else is 'self'.
const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' https://in.heycatch.ai",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self' https://in.heycatch.ai",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
};

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return { ...SECURITY_HEADERS, ...extra };
}

function notFound(): Response {
  return new Response("Not found", {
    status: 404,
    headers: headers({ "Content-Type": "text/plain; charset=utf-8" }),
  });
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "life-reset" }, { headers: headers() });
    }

    // HeyCatch short links: a single-character path is a channel link
    // (e.g. /i for Instagram). Forward it to / with the attribution query
    // so analytics records which platform the visitor came from.
    const shortLink = url.pathname.match(/^\/([a-z0-9])$/);
    if (shortLink) {
      return new Response(null, {
        status: 302,
        headers: headers({
          Location: new URL(`/?utm_source=heycatch&utm_campaign=${shortLink[1]}`, url).toString(),
        }),
      });
    }

    if (url.pathname === "/robots.txt") {
      return new Response(
        "User-agent: *\nAllow: /\nSitemap: https://life-reset-lm2x.onrender.com/sitemap.xml\n",
        { headers: headers({ "Content-Type": "text/plain; charset=utf-8" }) },
      );
    }

    if (url.pathname === "/sitemap.xml") {
      const xml =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        `  <url>\n` +
        `    <loc>https://life-reset-lm2x.onrender.com/</loc>\n` +
        `    <lastmod>2026-11-21</lastmod>\n` +
        `  </url>\n` +
        `</urlset>\n`;
      return new Response(xml, {
        headers: headers({ "Content-Type": "application/xml; charset=utf-8" }),
      });
    }

    if (url.pathname === "/actions" && req.method === "POST") {
      try {
        const body = (await req.json()) as { action?: string; args?: Record<string, unknown> };
        if (!body || typeof body.action !== "string") {
          return Response.json({ ok: false, error: "Missing action." }, { status: 400, headers: headers() });
        }
        const data = await handleAction(body.action, body.args ?? {});
        return Response.json({ ok: true, data }, { headers: headers() });
      } catch (e: any) {
        const message =
          e?.issues?.[0]?.message ||
          (typeof e?.message === "string" ? e.message : "Something went wrong.");
        const status = message.includes("sign in") ? 401 : 400;
        return Response.json({ ok: false, error: message }, { status, headers: headers() });
      }
    }

    // Static client. "/" serves the app shell and "/about" serves the About
    // page; anything else must be a real file in dist, or it is a genuine 404
    // (no SPA fallback — unknown paths must not return the shell).
    let filePath: string;
    if (url.pathname === "/") filePath = "/index.html";
    else if (url.pathname === "/about") filePath = "/about.html";
    else filePath = url.pathname;
    const resolved = join(DIST, filePath);
    if (resolved !== DIST && !resolved.startsWith(DIST + "/")) {
      return notFound();
    }
    const file = Bun.file(resolved);
    if (!(await file.exists())) {
      return notFound();
    }
    // Cache policy: the shell is always fresh so it points at the current
    // hashed bundle; hashed bundles are immutable and cacheable forever.
    // Without this, phones with the app saved to the home screen keep
    // serving the old bundle after a deploy.
    const cacheControl =
      filePath === "/index.html" || filePath === "/about.html"
        ? "no-cache"
        : /^\/main\.[0-9a-f]{8}\.(js|css)$/.test(filePath)
          ? "public, max-age=31536000, immutable"
          : undefined;
    return new Response(file, {
      headers: headers({
        "Content-Type": MIME[ext(resolved)] || "application/octet-stream",
        ...(cacheControl ? { "Cache-Control": cacheControl } : {}),
      }),
    });
  },
});

console.log(`Life Reset server listening on http://localhost:${server.port}`);
