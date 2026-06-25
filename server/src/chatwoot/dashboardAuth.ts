import { parse as parseCookie } from "cookie";
import type { Request } from "express";
import { dashboardHeaderNames } from "./config";
import type { DashboardAuthBundle } from "../types";

export function extractDashboardAuth(req: Request): DashboardAuthBundle | null {
  const fromHeaders = dashboardHeaderNames.reduce<Partial<DashboardAuthBundle>>((bundle, headerName) => {
    const value = req.header(headerName);
    if (typeof value === "string" && value.length > 0) {
      bundle[headerName] = value;
    }
    return bundle;
  }, {});

  if (hasDashboardBundle(fromHeaders)) {
    return fromHeaders;
  }

  const cookieHeader = typeof req.headers.cookie === "string" ? req.headers.cookie : "";
  if (!cookieHeader) {
    return null;
  }

  const cookies = parseCookie(cookieHeader);
  const sessionInfo = cookies.cw_d_session_info;
  if (!sessionInfo) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(sessionInfo)) as Record<string, string>;
    return hasDashboardBundle(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function hasDashboardBundle(bundle: Partial<DashboardAuthBundle> | Record<string, string>): bundle is DashboardAuthBundle {
  return dashboardHeaderNames.every((name) => typeof bundle[name] === "string" && bundle[name].length > 0);
}
