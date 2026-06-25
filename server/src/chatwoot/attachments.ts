import path from "path";
import { HttpError } from "../errors";
import type { ChatwootAttachmentItem, DashboardAuthBundle } from "../types";
import { chatwootFetch, chatwootFetchJson } from "./client";
import { normalizedBaseOrigin, normalizedBaseUrl } from "./config";

type RecordLike = Record<string, unknown>;
const CHATWOOT_MESSAGES_PAGE_SIZE = 100;

export async function listConversationAttachments(input: {
  accountId: number;
  conversationId: number;
  auth: DashboardAuthBundle;
}) {
  const messages = await fetchConversationMessages(input);
  const attachments = messages.flatMap((message) => extractAttachmentsFromMessage(message));
  const unique = dedupeById(attachments);

  return unique.sort((left, right) => {
    const leftTime = left.messageCreatedAt ? new Date(left.messageCreatedAt).getTime() : 0;
    const rightTime = right.messageCreatedAt ? new Date(right.messageCreatedAt).getTime() : 0;
    return rightTime - leftTime;
  });
}

export function paginateAttachments(
  attachments: ChatwootAttachmentItem[],
  options?: { page?: number; pageSize?: number },
) {
  const total = attachments.length;
  const pageSize = Math.min(Math.max(options?.pageSize ?? 20, 1), 50);
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  const page = Math.min(Math.max(options?.page ?? 1, 1), pageCount);
  const offset = (page - 1) * pageSize;

  return {
    attachments: attachments.slice(offset, offset + pageSize),
    meta: {
      total,
      page,
      pageSize,
    },
  };
}

export async function resolveConversationAttachments(input: {
  accountId: number;
  conversationId: number;
  auth: DashboardAuthBundle;
  attachmentIds?: number[];
}) {
  const attachments = await listConversationAttachments(input);

  if (!input.attachmentIds || input.attachmentIds.length === 0) {
    return attachments;
  }

  const requestedIds = new Set(input.attachmentIds);
  const filtered = attachments.filter((attachment) => requestedIds.has(attachment.id));
  if (filtered.length !== requestedIds.size) {
    throw new HttpError(404, "attachment_not_found");
  }

  return filtered;
}

export async function fetchAttachmentContent(
  attachment: ChatwootAttachmentItem,
  auth: DashboardAuthBundle
) {
  const targetUrl = new URL(attachment.downloadUrl, normalizedBaseUrl);
  if (targetUrl.origin !== normalizedBaseOrigin) {
    throw new HttpError(502, "attachment_origin_rejected", "Attachment origin is not allowed", {
      origin: targetUrl.origin,
    });
  }

  const response = await chatwootFetch(targetUrl.pathname + targetUrl.search, auth);
  return {
    response,
    contentType: response.headers.get("content-type") || attachment.contentType || "application/octet-stream",
    contentLength: response.headers.get("content-length"),
  };
}

async function fetchConversationMessages(input: {
  accountId: number;
  conversationId: number;
  auth: DashboardAuthBundle;
}) {
  // Chatwoot's /messages endpoint ignores `page`/`per_page` and always returns
  // the newest 20 messages. It does, however, support cursor-based pagination
  // via `before=<message_id>`, which returns the 20 messages older than the
  // given id. We walk backwards from the newest message until a page returns
  // no new messages.
  const seenMessageIds = new Set<number>();
  const collected: RecordLike[] = [];
  let before: number | null = null;

  for (;;) {
    const query = before
      ? `?before=${before}`
      : "";
    const resolvedPayload = await chatwootFetchJson(
      `/api/v1/accounts/${input.accountId}/conversations/${input.conversationId}/messages${query}`,
      input.auth
    );
    const messages = extractMessages(resolvedPayload);

    if (messages.length === 0) {
      break;
    }

    let addedThisPage = 0;
    let oldestIdThisPage = Number.POSITIVE_INFINITY;
    for (const message of messages) {
      const messageId = toPositiveInt(message.id);
      if (messageId && seenMessageIds.has(messageId)) {
        continue;
      }

      if (messageId) {
        seenMessageIds.add(messageId);
        if (messageId < oldestIdThisPage) {
          oldestIdThisPage = messageId;
        }
      }

      collected.push(message);
      addedThisPage += 1;
    }

    if (addedThisPage === 0) {
      break;
    }

    // No usable id to advance the cursor -> stop to avoid an infinite loop.
    if (!Number.isFinite(oldestIdThisPage)) {
      break;
    }

    // If the cursor didn't move, we've reached the beginning of the conversation.
    if (before === oldestIdThisPage) {
      break;
    }

    before = oldestIdThisPage;
  }

  return collected;
}

function extractMessages(payload: unknown): RecordLike[] {
  if (Array.isArray(payload)) {
    return payload.map(asRecord).filter((value): value is RecordLike => value !== null);
  }

  const record = asRecord(payload);
  if (!record) {
    return [];
  }

  const payloadArray = Array.isArray(record.payload) ? record.payload : null;
  if (payloadArray) {
    return payloadArray.map(asRecord).filter((value): value is RecordLike => value !== null);
  }

  const dataArray = Array.isArray(record.data) ? record.data : null;
  if (dataArray) {
    return dataArray.map(asRecord).filter((value): value is RecordLike => value !== null);
  }

  return [];
}

function extractAttachmentsFromMessage(message: RecordLike): ChatwootAttachmentItem[] {
  const rawAttachments = Array.isArray(message.attachments) ? message.attachments : [];
  return rawAttachments
    .map((attachment) => normalizeAttachment(asRecord(attachment), message))
    .filter((value): value is ChatwootAttachmentItem => value !== null);
}

function normalizeAttachment(attachment: RecordLike | null, message: RecordLike): ChatwootAttachmentItem | null {
  if (!attachment) {
    return null;
  }

  const id = toPositiveInt(attachment.id);
  const downloadUrl =
    pickString(attachment.data_url) ||
    pickString(attachment.download_url) ||
    pickString(attachment.file_url) ||
    pickString(attachment.url);

  if (!id || !downloadUrl) {
    return null;
  }

  const contentType =
    pickString(attachment.file_type) ||
    pickString(attachment.content_type) ||
    pickString(attachment.contentType);
  const extension = pickString(attachment.extension) || extensionFromName(downloadUrl);
  const fileName =
    pickString(attachment.file_name) ||
    pickString(attachment.filename) ||
    decodeFileNameFromUrl(downloadUrl) ||
    `attachment-${id}${extension ? `.${extension}` : ""}`;
  const previewKind = resolvePreviewKind(contentType, extension);
  const sender = asRecord(message.sender);

  return {
    id,
    messageId: toPositiveInt(message.id),
    messageType: pickString(message.message_type) || null,
    messageCreatedAt: normalizeDateValue(message.created_at ?? message.createdAt),
    fileName,
    extension,
    contentType,
    sizeBytes: toPositiveInt(attachment.file_size) ?? toPositiveInt(attachment.fileSize),
    previewable: previewKind !== "other",
    previewKind,
    downloadUrl: absolutizeUrl(downloadUrl),
    thumbUrl: absolutizeOptionalUrl(pickString(attachment.thumb_url) || pickString(attachment.thumbnail_url)),
    senderName: pickString(sender?.name) || pickString(sender?.available_name) || null,
  };
}

function dedupeById(items: ChatwootAttachmentItem[]) {
  const byId = new Map<number, ChatwootAttachmentItem>();
  for (const item of items) {
    if (!byId.has(item.id)) {
      byId.set(item.id, item);
    }
  }
  return Array.from(byId.values());
}

function resolvePreviewKind(contentType: string | null, extension: string | null) {
  const normalizedType = contentType?.toLowerCase() || "";
  const normalizedExtension = extension?.toLowerCase() || "";

  if (
    normalizedType.startsWith("image/") ||
    normalizedType === "image" ||
    ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "avif"].includes(normalizedExtension)
  ) {
    return "image";
  }
  if (
    normalizedType.startsWith("video/") ||
    normalizedType === "video" ||
    ["mp4", "mov", "avi", "mkv", "webm", "m4v"].includes(normalizedExtension)
  ) {
    return "video";
  }
  if (
    normalizedType.startsWith("audio/") ||
    normalizedType === "audio" ||
    ["mp3", "wav", "ogg", "m4a", "aac", "flac"].includes(normalizedExtension)
  ) {
    return "audio";
  }
  if (normalizedType === "application/pdf" || normalizedType === "pdf" || normalizedExtension === "pdf") return "pdf";
  if (
    normalizedType.startsWith("text/") ||
    normalizedType === "text" ||
    ["txt", "md", "json", "csv", "log"].includes(normalizedExtension)
  ) {
    return "text";
  }
  return "other";
}

function normalizeDateValue(value: unknown) {
  if (typeof value === "string" && value.trim().length > 0) {
    const trimmed = value.trim();
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      return normalizeEpochNumber(Number(trimmed));
    }
    return trimmed;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return normalizeEpochNumber(value);
  }

  return null;
}

function normalizeEpochNumber(value: number) {
  const normalized = value < 1e12 ? value * 1000 : value;
  const date = new Date(normalized);
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString();
  }

  return null;
}

function decodeFileNameFromUrl(urlString: string) {
  try {
    const url = new URL(urlString, normalizedBaseUrl);
    const parsed = path.basename(url.pathname);
    return parsed ? decodeURIComponent(parsed) : null;
  } catch {
    return null;
  }
}

function extensionFromName(value: string) {
  const ext = path.extname(value).replace(/^\./, "").trim();
  return ext.length > 0 ? ext : null;
}

function absolutizeUrl(value: string) {
  return new URL(value, normalizedBaseUrl).toString();
}

function absolutizeOptionalUrl(value: string | null) {
  return value ? absolutizeUrl(value) : null;
}

function asRecord(value: unknown): RecordLike | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RecordLike) : null;
}

function pickString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toPositiveInt(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}
