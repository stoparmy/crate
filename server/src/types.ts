export type DashboardHeaderName = "access-token" | "token-type" | "client" | "expiry" | "uid";

export type DashboardAuthBundle = Record<DashboardHeaderName, string>;

export interface DashboardActor {
  source: "dashboard";
  role: "admin" | "agent";
  isAdmin: boolean;
  id: number;
  accountId: number;
  email: string;
  name: string;
}

export interface ChatwootAttachmentItem {
  id: number;
  messageId: number | null;
  messageType: string | null;
  messageCreatedAt: string | null;
  fileName: string;
  extension: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  previewable: boolean;
  previewKind: "image" | "video" | "audio" | "pdf" | "text" | "other";
  downloadUrl: string;
  thumbUrl: string | null;
  senderName: string | null;
}
