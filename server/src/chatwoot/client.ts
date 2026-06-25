import { HttpError } from "../errors";
import { chatwootAppToken, dashboardHeaderNames, normalizedBaseUrl } from "./config";
import type { DashboardAuthBundle } from "../types";

export async function chatwootFetchJson(path: string, auth: DashboardAuthBundle, init: RequestInit = {}) {
  const response = await chatwootFetch(path, auth, init);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new HttpError(502, "chatwoot_request_failed", "Chatwoot did not return JSON", { path });
  }

  return response.json();
}

export async function chatwootFetch(path: string, auth: DashboardAuthBundle, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  for (const headerName of dashboardHeaderNames) {
    headers.set(headerName, auth[headerName]);
  }

  const response = await fetch(`${normalizedBaseUrl}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new HttpError(
      response.status,
      response.status === 401 ? "chatwoot_auth_rejected" : "chatwoot_request_failed",
      "Chatwoot request failed",
      { path, body }
    );
  }

  return response;
}

export async function chatwootFetchWithAppToken(path: string, init: RequestInit = {}) {
  if (!chatwootAppToken) {
    throw new HttpError(500, "chatwoot_app_token_missing");
  }

  const headers = new Headers(init.headers || {});
  headers.set("api_access_token", chatwootAppToken);

  const response = await fetch(`${normalizedBaseUrl}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new HttpError(
      response.status,
      response.status === 401 ? "chatwoot_auth_rejected" : "chatwoot_request_failed",
      "Chatwoot request failed",
      { path, body }
    );
  }

  return response;
}

export async function chatwootFetchJsonWithAppToken(path: string, init: RequestInit = {}) {
  const response = await chatwootFetchWithAppToken(path, init);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new HttpError(502, "chatwoot_request_failed", "Chatwoot did not return JSON", { path });
  }

  return response.json();
}
