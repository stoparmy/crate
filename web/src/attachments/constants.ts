import type { PagedMeta } from "./types";

export const defaultMeta: PagedMeta = {
  total: 0,
  page: 1,
  pageSize: 20,
};

export const embeddedApiBase = new URL("./api/embedded", getMountedAppUrl()).pathname;
export const driveFolderSaveConfig = {
  enabled:
    parseBooleanEnv(import.meta.env.VITE_GOOGLE_DRIVE_SAVE_ALL_ENABLED) &&
    Boolean(normalizeNonEmpty(import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID)),
  clientId: normalizeNonEmpty(import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID),
  folderPrefix:
    normalizeNonEmpty(import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_PREFIX) ||
    "Crate",
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

function parseBooleanEnv(value: string | undefined) {
  if (!value) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function normalizeNonEmpty(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
