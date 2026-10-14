import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { fetchApiStatus, logoutCurrentSession } from "./api";

describe("App", () => {
  it("renders the authenticated dashboard shell", () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain("Sports_Paradise");
    expect(markup).toContain("Authenticated application shell");
    expect(markup).toContain("Session status");
  });

  it("reads the readiness response from the backend API with same-origin credentials", async () => {
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            status: "ready",
            service: "sports-paradise-api",
            database: "connected",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
    );

    globalThis.fetch = fetchSpy;

    try {
      await expect(
        fetchApiStatus(),
      ).resolves.toMatchObject({
        status: "ready",
        database: "connected",
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        "/ready",
        expect.objectContaining({
          credentials: "same-origin",
          cache: "no-store",
        }),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("surfaces backend readiness failures to the caller", async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          status: "not_ready",
          service: "sports-paradise-api",
          database: "unavailable",
          error: "Database is not available.",
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      );

    try {
      await expect(fetchApiStatus()).rejects.toThrow(
        "Database is not available.",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("surfaces network failures without converting them into success", async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () => {
      throw new Error("Backend is unreachable.");
    };

    try {
      await expect(fetchApiStatus()).rejects.toThrow(
        "Backend is unreachable.",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("posts the logout action to the protected current-session endpoint", async () => {
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn(async () => new Response(null, { status: 204 }));
    const assignSpy = vi.fn();

    globalThis.fetch = fetchSpy;
    Object.defineProperty(globalThis, "location", {
      value: { assign: assignSpy },
      configurable: true,
      writable: true,
    });

    try {
      await expect(
        logoutCurrentSession(),
      ).resolves.toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/auth/logout",
        expect.objectContaining({
          method: "POST",
          credentials: "same-origin",
        }),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
