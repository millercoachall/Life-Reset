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
};

function ext(path: string): string {
  const i = path.lastIndexOf(".");
  return i >= 0 ? path.slice(i) : "";
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "life-reset" });
    }

    if (url.pathname === "/actions" && req.method === "POST") {
      try {
        const body = (await req.json()) as { action?: string; args?: Record<string, unknown> };
        if (!body || typeof body.action !== "string") {
          return Response.json({ ok: false, error: "Missing action." }, { status: 400 });
        }
        const data = await handleAction(body.action, body.args ?? {});
        return Response.json({ ok: true, data });
      } catch (e: any) {
        const message =
          e?.issues?.[0]?.message ||
          (typeof e?.message === "string" ? e.message : "Something went wrong.");
        const status = message.includes("sign in") ? 401 : 400;
        return Response.json({ ok: false, error: message }, { status });
      }
    }

    // Static client (SPA fallback to index.html).
    let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    let file = Bun.file(join(DIST, filePath));
    if (!(await file.exists())) {
      filePath = "/index.html";
      file = Bun.file(join(DIST, filePath));
    }
    if (!(await file.exists())) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(file, {
      headers: { "Content-Type": MIME[ext(filePath)] || "application/octet-stream" },
    });
  },
});

console.log(`Life Reset server listening on http://localhost:${server.port}`);
