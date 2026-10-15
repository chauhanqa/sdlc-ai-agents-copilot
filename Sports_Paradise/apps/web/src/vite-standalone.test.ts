import { afterEach, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { fileURLToPath } from "node:url";

describe("standalone Vite development server", () => {
  let server: ViteDevServer | undefined;

  afterEach(async () => {
    if (server) {
      await server.close();
      server = undefined;
    }
  });

  it("does not serve the protected dashboard SPA document directly", async () => {
    server = await createServer({
      configFile: fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
      root: fileURLToPath(new URL("..", import.meta.url)),
      server: {
        host: "127.0.0.1",
        port: 0,
        strictPort: false,
      },
    });
    await server.listen();

    const address = server.httpServer?.address();
    if (!address || typeof address === "string") {
      throw new Error("Standalone Vite server did not bind a TCP port.");
    }
    const baseUrl = `http://127.0.0.1:${address.port}`;

    for (const accept of ["text/html", "*/*"]) {
      const response = await fetch(`${baseUrl}/dashboard`, {
        headers: { accept },
      });

      expect(response.status).toBe(403);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.text()).not.toContain("/src/main.tsx");
    }
  });
});
