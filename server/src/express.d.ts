import type { DashboardActor, DashboardAuthBundle } from "./types";

declare global {
  namespace Express {
    interface Request {
      crateActor?: DashboardActor;
      crateDashboardAuth?: DashboardAuthBundle;
    }
  }
}

export {};
