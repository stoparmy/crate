import type { DashboardHeaderName } from "../types";

const baseUrl = requiredEnv("CHATWOOT_BASE_URL");
const appToken = optionalEnv("CHATWOOT_APP_TOKEN");

export const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
export const normalizedBaseOrigin = new URL(normalizedBaseUrl).origin;
export const chatwootAppToken = appToken;
export const dashboardHeaderNames: DashboardHeaderName[] = [
  "access-token",
  "token-type",
  "client",
  "expiry",
  "uid",
];

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function optionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}
