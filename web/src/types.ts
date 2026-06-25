export interface DashboardContext {
  accountId: number;
  inboxId: number;
  conversationId: number;
  contactId: number;
  contactName: string;
  contactEmail: string;
  currentAgentName: string;
}

export interface PagedMeta {
  total: number;
  page: number;
  pageSize: number;
}

export interface ConversationAttachment {
  id: number;
  messageCreatedAt: string | null;
  fileName: string;
  sizeBytes: number | null;
  previewKind: "image" | "video" | "audio" | "pdf" | "text" | "other";
  thumbUrl: string | null;
  senderName: string | null;
}
