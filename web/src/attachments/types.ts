import type {
  ConversationAttachment as BaseConversationAttachment,
  DashboardContext as BaseDashboardContext,
  PagedMeta as BasePagedMeta,
} from "@/types";

export type ConversationAttachment = BaseConversationAttachment;
export type DashboardContext = BaseDashboardContext;
export type PagedMeta = BasePagedMeta;

export interface AttachmentGroup {
  key: string;
  label: string;
  items: ConversationAttachment[];
}
