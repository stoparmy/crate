/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PUBLIC_BASE_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __CRATE_RUNTIME_CONFIG__?: {
    googleDriveSaveAllEnabled?: boolean;
    googleDriveClientId?: string | null;
    googleDriveFolderPrefix?: string | null;
  };
  google?: {
    accounts?: {
      oauth2?: {
        initTokenClient: (config: {
          client_id: string;
          scope: string;
          callback: (response: {
            access_token?: string;
            expires_in?: number;
            error?: string;
            error_description?: string;
            scope?: string;
            token_type?: string;
          }) => void;
          error_callback?: (error: { type: string }) => void;
          prompt?: string;
        }) => {
          requestAccessToken: (overrideConfig?: {
            prompt?: string;
            scope?: string;
          }) => void;
        };
      };
    };
  };
}
