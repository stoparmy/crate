import type { NextFunction, Request, Response } from "express";
import { HttpError } from "./errors";
import { extractDashboardAuth } from "./chatwoot/dashboardAuth";
import { chatwootFetchJson } from "./chatwoot/client";
import type { DashboardActor } from "./types";

export async function requireDashboardActor(req: Request, _res: Response, next: NextFunction) {
  try {
    const auth = extractDashboardAuth(req);
    if (!auth) {
      throw new HttpError(401, "chatwoot_auth_missing");
    }

    await chatwootFetchJson("/auth/validate_token", auth);
    const profile = await chatwootFetchJson("/api/v1/profile", auth);
    const actor = parseDashboardActor(profile);

    req.crateDashboardAuth = auth;
    req.crateActor = actor;
    next();
  } catch (error) {
    next(error);
  }
}

export function getDashboardActor(req: Request) {
  if (!req.crateActor) {
    throw new HttpError(500, "missing_actor");
  }
  return req.crateActor;
}

export function getDashboardAuth(req: Request) {
  if (!req.crateDashboardAuth) {
    throw new HttpError(500, "chatwoot_auth_missing");
  }
  return req.crateDashboardAuth;
}

function parseDashboardActor(payload: unknown): DashboardActor {
  const record = asRecord(payload);
  const account = asRecord(record?.account);

  const id = toPositiveInt(record?.id);
  const accountId = toPositiveInt(account?.id ?? record?.account_id);
  const email = pickString(record?.email);
  const name = pickString(record?.name) || email;
  const role = pickString(record?.role);
  const isAdmin = role === "administrator" || role === "admin";

  if (!id || !accountId || !email || !name || !role) {
    throw new HttpError(401, "chatwoot_auth_rejected", "Incomplete Chatwoot profile payload");
  }

  return {
    source: "dashboard",
    role: isAdmin ? "admin" : "agent",
    isAdmin,
    id,
    accountId,
    email,
    name,
  };
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function pickString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toPositiveInt(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}
