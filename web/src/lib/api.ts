export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, details?: unknown) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, extraHeaders?: Record<string, string>) {
  const headers = new Headers(init.headers || {});
  if (extraHeaders) {
    Object.entries(extraHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "include",
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const errorCode =
      typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : "request_failed";
    const details = typeof payload === "object" && payload && "details" in payload ? payload.details : payload;
    throw new ApiError(response.status, errorCode, details);
  }

  return payload as T;
}

export function withQuery(path: string, params: Record<string, string | number | undefined>) {
  const url = new URL(path, window.location.href);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  const query = url.searchParams.toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
}
