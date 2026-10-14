export interface ApiHealthStatus {
  status: string;
  service: string;
  database?: string;
  error?: string;
}

export async function fetchApiStatus(): Promise<ApiHealthStatus> {
  const response = await fetch("/ready", {
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  const payload = (await response.json().catch(() => ({}))) as ApiHealthStatus;

  if (response.status === 401) {
    throw new Error(payload.error ?? "Authentication required.");
  }

  if (!response.ok) {
    throw new Error(
      payload.error ??
        "The backend service is unavailable. Verify the API is running and reachable.",
    );
  }

  return payload;
}

export async function logoutCurrentSession(): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (response.status === 204 || response.ok) {
    return;
  }

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  throw new Error(payload.error ?? "Unable to log out of the current session.");
}
