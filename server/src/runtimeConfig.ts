function parseBooleanEnv(value: string | undefined) {
  if (!value) {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function normalizeNonEmpty(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function getPublicRuntimeConfig() {
  return {
    googleDriveSaveAllEnabled:
      parseBooleanEnv(process.env.CRATE_GOOGLE_DRIVE_SAVE_ALL_ENABLED) &&
      Boolean(normalizeNonEmpty(process.env.CRATE_GOOGLE_DRIVE_CLIENT_ID)),
    googleDriveClientId: normalizeNonEmpty(process.env.CRATE_GOOGLE_DRIVE_CLIENT_ID),
    googleDriveFolderPrefix: normalizeNonEmpty(process.env.CRATE_GOOGLE_DRIVE_FOLDER_PREFIX) || "Crate",
  };
}

export function buildRuntimeConfigScript() {
  const payload = JSON.stringify(getPublicRuntimeConfig()).replace(/</g, "\\u003c");
  return `<script>window.__CRATE_RUNTIME_CONFIG__=${payload};</script>`;
}
