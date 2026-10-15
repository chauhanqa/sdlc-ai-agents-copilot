import { defineConfig, type Connect, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const denyStandalonePageRequests: Connect.NextHandleFunction = (
  request,
  response,
  next,
) => {
  const method = request.method?.toUpperCase();
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
  const finalPathSegment = pathname.slice(pathname.lastIndexOf("/") + 1);
  const isPageRequest =
    pathname === "/" ||
    pathname.toLowerCase().endsWith(".html") ||
    finalPathSegment === "" ||
    !finalPathSegment.includes(".");

  if ((method !== "GET" && method !== "HEAD") || !isPageRequest) {
    next();
    return;
  }

  response.statusCode = 403;
  response.setHeader("cache-control", "no-store");
  response.setHeader("content-type", "text/plain; charset=utf-8");
  response.end(
    "Standalone Vite page serving is disabled. Use the Fastify application entry.",
  );
};

const standalonePageGuard: Plugin = {
  name: "sports-paradise-standalone-page-guard",
  configureServer(server) {
    // Fastify embeds Vite in middleware mode only after its authorization
    // boundary. Keep that supported path intact; block direct Vite servers.
    if (!server.config.server.middlewareMode) {
      server.middlewares.use(denyStandalonePageRequests);
    }
  },
  configurePreviewServer(server) {
    server.middlewares.use(denyStandalonePageRequests);
  },
};

export default defineConfig({
  plugins: [standalonePageGuard, react()],
});
