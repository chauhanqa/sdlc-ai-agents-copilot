import { useEffect, useState } from "react";
import { fetchApiStatus, logoutCurrentSession } from "./api";

type SessionView = "loading" | "authenticated" | "unauthenticated" | "error";

export function App() {
  const [view, setView] = useState<SessionView>("loading");
  const [message, setMessage] = useState("Checking your session...");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    fetchApiStatus()
      .then((result) => {
        if (!active) {
          return;
        }

        if (result.status === "ready") {
          setView("authenticated");
          setMessage("Session active: the protected dashboard is ready.");
          return;
        }

        setView("error");
        setMessage(result.error ?? "The backend API is not ready.");
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        const nextMessage =
          error instanceof Error
            ? error.message
            : "The backend service is unavailable.";

        if (nextMessage === "Authentication required.") {
          setView("unauthenticated");
          setMessage("Authentication required. Sign in to continue.");
          return;
        }

        setView("error");
        setMessage(nextMessage);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    setBusy(true);

    try {
      await logoutCurrentSession();
      window.location.assign("/login");
    } catch (error) {
      setView("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to log out of the current session.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 960 }}>
      <h1>Sports_Paradise</h1>
      <p>
        Authenticated application shell for the Sports_Paradise web experience.
      </p>

      <section
        aria-live="polite"
        style={{
          border: "1px solid #d1d5db",
          borderRadius: 10,
          padding: "1.25rem 1.5rem",
          marginTop: "1.5rem",
          background:
            view === "authenticated"
              ? "#ecfdf5"
              : view === "unauthenticated"
                ? "#f8fafc"
                : view === "error"
                  ? "#fef2f2"
                  : "#f8fafc",
        }}
      >
        <strong>Session status:</strong> {message}
      </section>

      {view === "authenticated" ? (
        <section
          style={{
            border: "1px solid #d1d5db",
            borderRadius: 10,
            padding: "1.5rem",
            marginTop: "1.5rem",
            background: "#ffffff",
          }}
        >
          <h2>Dashboard</h2>
          <p>
            Your session is active and the protected application is available.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            disabled={busy}
            style={{
              background: "#1f2937",
              color: "#ffffff",
              border: "none",
              borderRadius: 8,
              padding: "0.7rem 1rem",
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Logging out..." : "Logout"}
          </button>
        </section>
      ) : null}

      {view === "unauthenticated" ? (
        <section
          style={{
            marginTop: "1.5rem",
            display: "flex",
            gap: "1rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <a
            href="/login"
            style={{
              display: "inline-block",
              padding: "0.75rem 1rem",
              borderRadius: 8,
              background: "#2563eb",
              color: "#ffffff",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Go to login
          </a>
          <a href="/signup" style={{ color: "#2563eb" }}>
            Create an account
          </a>
        </section>
      ) : null}

      {view === "error" ? (
        <section style={{ marginTop: "1.5rem" }}>
          <p style={{ color: "#7f1d1d" }}>{message}</p>
        </section>
      ) : null}

    </main>
  );
}
