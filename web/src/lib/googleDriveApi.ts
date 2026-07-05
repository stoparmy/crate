export async function createDriveFolder(input: {
  accessToken: string;
  name: string;
}) {
  const response = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: input.name,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  return parseDriveResponse<{
    id: string;
    name: string;
    webViewLink?: string;
  }>(response, "google_drive_folder_create_failed");
}

export async function uploadDriveFile(input: {
  accessToken: string;
  blob: Blob;
  name: string;
  parentId: string;
}) {
  const startResponse = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type":
          input.blob.type || "application/octet-stream",
      },
      body: JSON.stringify({
        name: input.name,
        parents: [input.parentId],
      }),
    },
  );

  if (!startResponse.ok) {
    await throwDriveError(startResponse, "google_drive_upload_session_failed");
  }

  const uploadUrl = startResponse.headers.get("location");
  if (!uploadUrl) {
    throw new Error("google_drive_upload_location_missing");
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": input.blob.type || "application/octet-stream",
    },
    body: input.blob,
  });

  return parseDriveResponse<{
    id: string;
    name: string;
    webViewLink?: string;
  }>(uploadResponse, "google_drive_upload_failed");
}

async function parseDriveResponse<T>(response: Response, fallbackCode: string) {
  if (!response.ok) {
    await throwDriveError(response, fallbackCode);
  }

  return (await response.json()) as T;
}

async function throwDriveError(response: Response, fallbackCode: string): Promise<never> {
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  const googleMessage =
    typeof payload === "object" &&
    payload &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
      ? payload.error.message
      : null;

  throw new Error(googleMessage || fallbackCode);
}
