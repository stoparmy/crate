import type { PagedMeta } from "./types";
import { getRuntimeConfig } from "@/lib/runtimeConfig";

export const defaultMeta: PagedMeta = {
  total: 0,
  page: 1,
  pageSize: 20,
};

export const embeddedApiBase = new URL("./api/embedded", getMountedAppUrl()).pathname;
const runtimeConfig = getRuntimeConfig();
export const driveFolderSaveConfig = {
  enabled: runtimeConfig.googleDriveSaveAllEnabled,
  clientId: runtimeConfig.googleDriveClientId,
  folderPrefix: runtimeConfig.googleDriveFolderPrefix,
};

function getMountedAppUrl() {
  const url = new URL(window.location.href);

  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname}/`;
  }

  url.search = "";
  url.hash = "";
  return url;
}
