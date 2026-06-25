import {
  FileText,
  ImageIcon,
  Music,
  Video,
  type LucideProps,
} from "lucide-react";
import { ApiError } from "@/lib/api";
import type { AttachmentGroup, ConversationAttachment } from "./types";

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "chatwoot_auth_missing":
        return "Отсутствуют заголовки авторизации Chatwoot.";
      case "chatwoot_auth_rejected":
        return "Chatwoot отклонил текущую сессию.";
      case "chatwoot_request_failed":
        return "Chatwoot не вернул запрошенные данные вложений.";
      default:
        return "Не удалось загрузить вложения для этого диалога.";
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Непредвиденная ошибка";
}

export function formatBytes(bytes: number) {
  return (
    new Intl.NumberFormat("ru", {
      maximumFractionDigits: 1,
    }).format(bytes / unitFor(bytes).size) + ` ${unitFor(bytes).label}`
  );
}

export function formatTimeOnly(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Время неизвестно";
  }

  return new Intl.DateTimeFormat("ru", {
    timeStyle: "short",
  }).format(date);
}

export function formatAttachmentsTitle(count: number) {
  return `${count} ${pluralizeRu(count, ["файл", "файла", "файлов"])}`;
}

export function groupAttachmentsByDate(
  attachments: ConversationAttachment[],
): AttachmentGroup[] {
  const groups = new Map<string, ConversationAttachment[]>();

  for (const attachment of attachments) {
    const key = getDateGroupKey(attachment.messageCreatedAt);
    const current = groups.get(key) || [];
    current.push(attachment);
    groups.set(key, current);
  }

  return Array.from(groups.entries()).map(([key, items]) => ({
    key,
    label: formatDateGroupLabel(key),
    items,
  }));
}

export function shouldShowAgentSender(
  senderName: string | null,
  contactName: string | null | undefined,
) {
  if (!senderName) {
    return false;
  }

  if (!contactName) {
    return true;
  }

  return senderName.trim().toLowerCase() !== contactName.trim().toLowerCase();
}

export function renderAttachmentVisual(attachment: ConversationAttachment) {
  if (attachment.previewKind === "image" && attachment.thumbUrl) {
    return (
      <img
        alt=""
        className="size-full object-cover"
        loading="lazy"
        src={attachment.thumbUrl}
      />
    );
  }

  return renderAttachmentIcon(attachment.previewKind);
}

function renderAttachmentIcon(
  kind: ConversationAttachment["previewKind"],
  props?: LucideProps,
) {
  switch (kind) {
    case "image":
      return <ImageIcon className="size-4" {...props} />;
    case "video":
      return <Video className="size-4" {...props} />;
    case "audio":
      return <Music className="size-4" {...props} />;
    default:
      return <FileText className="size-4" {...props} />;
  }
}

function unitFor(bytes: number) {
  if (bytes >= 1024 ** 3) return { size: 1024 ** 3, label: "ГБ" };
  if (bytes >= 1024 ** 2) return { size: 1024 ** 2, label: "МБ" };
  if (bytes >= 1024) return { size: 1024, label: "КБ" };
  return { size: 1, label: "Б" };
}

function getDateGroupKey(value: string | null) {
  if (!value) {
    return "unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateGroupLabel(key: string) {
  if (key === "unknown") {
    return "Дата неизвестна";
  }

  const date = new Date(`${key}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return "Дата неизвестна";
  }

  return new Intl.DateTimeFormat("ru", {
    dateStyle: "medium",
  }).format(date);
}

function pluralizeRu(count: number, forms: [string, string, string]) {
  const absoluteCount = Math.abs(count);
  const lastTwoDigits = absoluteCount % 100;
  const lastDigit = absoluteCount % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return forms[2];
  }

  if (lastDigit === 1) {
    return forms[0];
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return forms[1];
  }

  return forms[2];
}
