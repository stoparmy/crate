const GOOGLE_IDENTITY_SCRIPT_ID = "google-identity-services-script";
const GOOGLE_IDENTITY_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const DEFAULT_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
  scope?: string;
  token_type?: string;
};

let identityScriptPromise: Promise<void> | null = null;
let tokenCache: {
  accessToken: string;
  expiresAt: number;
  scope: string;
} | null = null;

export const driveFileScope = DEFAULT_DRIVE_SCOPE;

export function loadGoogleIdentityServices() {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }

  if (identityScriptPromise) {
    return identityScriptPromise;
  }

  identityScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(
      GOOGLE_IDENTITY_SCRIPT_ID,
    ) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", handleLoad, { once: true });
      existingScript.addEventListener("error", handleError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_IDENTITY_SCRIPT_ID;
    script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    document.head.appendChild(script);

    function handleLoad() {
      if (window.google?.accounts?.oauth2) {
        resolve();
        return;
      }

      identityScriptPromise = null;
      reject(new Error("google_identity_services_unavailable"));
    }

    function handleError() {
      identityScriptPromise = null;
      reject(new Error("google_identity_services_failed_to_load"));
    }
  });

  return identityScriptPromise;
}

export async function requestDriveAccessToken(input: {
  clientId: string;
  scope?: string;
}) {
  const scope = input.scope || DEFAULT_DRIVE_SCOPE;
  const now = Date.now();

  if (
    tokenCache &&
    tokenCache.scope === scope &&
    tokenCache.expiresAt - 30_000 > now
  ) {
    return tokenCache.accessToken;
  }

  await loadGoogleIdentityServices();

  return new Promise<string>((resolve, reject) => {
    const tokenClient = window.google?.accounts?.oauth2?.initTokenClient({
      client_id: input.clientId,
      scope,
      callback: (response: TokenResponse) => {
        if (!response.access_token) {
          reject(
            new Error(
              response.error_description ||
                response.error ||
                "google_drive_access_token_missing",
            ),
          );
          return;
        }

        tokenCache = {
          accessToken: response.access_token,
          expiresAt:
            Date.now() + Math.max((response.expires_in || 0) - 60, 0) * 1000,
          scope,
        };
        resolve(response.access_token);
      },
      error_callback: (error) => {
        reject(new Error(error.type || "google_drive_auth_failed"));
      },
    });

    if (!tokenClient) {
      reject(new Error("google_drive_auth_unavailable"));
      return;
    }

    tokenClient.requestAccessToken({
      prompt: tokenCache ? "" : "consent",
      scope,
    });
  });
}
