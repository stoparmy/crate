type CrateRuntimeConfig = {
  googleDriveSaveAllEnabled?: boolean;
  googleDriveClientId?: string | null;
  googleDriveFolderPrefix?: string | null;
};

function normalizeNonEmpty(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function getRuntimeConfig() {
  const config: CrateRuntimeConfig = window.__CRATE_RUNTIME_CONFIG__ || {};

  const googleDriveClientId = normalizeNonEmpty(config.googleDriveClientId);
  const googleDriveSaveAllEnabled =
    config.googleDriveSaveAllEnabled === true && Boolean(googleDriveClientId);

  return {
    googleDriveSaveAllEnabled,
    googleDriveClientId,
    googleDriveFolderPrefix:
      normalizeNonEmpty(config.googleDriveFolderPrefix) || "Crate",
  };
}
