import type { DashboardContext } from "../types";

const headerKeys = ["access-token", "token-type", "client", "expiry", "uid"] as const;

type RawRecord = Record<string, unknown>;
export type EmbeddedTheme = "light" | "dark";

export function isEmbeddedMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get("mode") === "dashboard" || window.self !== window.top;
}

export function getChatwootAuthHeaders() {
  const sessionCookie = readCookie("cw_d_session_info");
  if (!sessionCookie) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(sessionCookie)) as Record<string, string>;
    const headers = headerKeys.reduce<Record<string, string>>((accumulator, key) => {
      const value = parsed[key];
      if (typeof value === "string" && value.length > 0) {
        accumulator[key] = value;
      }
      return accumulator;
    }, {});
    return headerKeys.every((key) => headers[key]) ? headers : null;
  } catch {
    return null;
  }
}

export function subscribeToDashboardContext(onContext: (context: DashboardContext) => void) {
  const expectedOrigin = getExpectedParentOrigin();
  const handleMessage = (event: MessageEvent) => {
    if (window.parent && event.source !== window.parent) {
      return;
    }

    if (event.origin !== expectedOrigin) {
      return;
    }

    const context = extractDashboardContext(event.data);
    if (context) {
      onContext(context);
    }
  };

  window.addEventListener("message", handleMessage);
  requestDashboardContext();

  return () => {
    window.removeEventListener("message", handleMessage);
  };
}

export function requestDashboardContext() {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(
      "chatwoot-dashboard-app:fetch-info",
      getExpectedParentOrigin(),
    );
  }
}

export function getEmbeddedTheme(): EmbeddedTheme | null {
  const parentDocument = getParentDocument();
  return parentDocument ? readThemeFromDocument(parentDocument) : null;
}

export function subscribeToEmbeddedTheme(onTheme: (theme: EmbeddedTheme) => void) {
  const parentDocument = getParentDocument();
  if (!parentDocument) {
    return () => {};
  }

  const emitTheme = () => {
    onTheme(readThemeFromDocument(parentDocument));
  };

  emitTheme();

  const observer = new MutationObserver(() => {
    emitTheme();
  });

  observer.observe(parentDocument.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme"],
  });

  if (parentDocument.body) {
    observer.observe(parentDocument.body, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
  }

  return () => {
    observer.disconnect();
  };
}

function extractDashboardContext(input: unknown): DashboardContext | null {
  const raw = unwrapContext(input);
  const conversation = toRecord(raw.conversation);
  const contact =
    toRecord(raw.contact) ||
    toRecord(conversation?.meta && toRecord(conversation.meta)?.sender) ||
    toRecord(conversation?.contact);
  const currentAgent = toRecord(raw.currentAgent) || toRecord(raw.agent);

  const accountId = toPositiveInt(conversation?.account_id ?? raw.account_id ?? raw.accountId);
  const inboxId = toPositiveInt(conversation?.inbox_id ?? raw.inbox_id ?? raw.inboxId);
  const conversationId = toPositiveInt(conversation?.id ?? raw.conversationId);
  const contactId = toPositiveInt(contact?.id ?? raw.contact_id ?? raw.contactId);

  if (!accountId || !inboxId || !conversationId || !contactId) {
    return null;
  }

  return {
    accountId,
    inboxId,
    conversationId,
    contactId,
    contactName: pickString(contact?.name) ?? pickString(contact?.identifier) ?? `#${contactId}`,
    contactEmail: pickString(contact?.email) ?? "",
    currentAgentName:
      pickString(currentAgent?.name) ??
      pickString(currentAgent?.available_name) ??
      pickString(currentAgent?.email) ??
      "Агент Chatwoot",
  };
}

function unwrapContext(input: unknown): RawRecord {
  const record = toRecord(parseJsonRecord(input));
  if (!record) {
    return {};
  }

  const dataRecord = toRecord(parseJsonRecord(record.data));
  const nested =
    toRecord(parseJsonRecord(record.appContext)) ||
    toRecord(parseJsonRecord(dataRecord?.appContext)) ||
    dataRecord ||
    record;
  return nested || {};
}

function readCookie(name: string) {
  const cookies = document.cookie.split(";").map((part) => part.trim());
  const match = cookies.find((part) => part.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

function getParentDocument() {
  if (!isEmbeddedMode() || !window.parent || window.parent === window) {
    return null;
  }

  try {
    return window.parent.document;
  } catch {
    return null;
  }
}

function getExpectedParentOrigin() {
  return window.location.origin;
}

function readThemeFromDocument(documentToRead: Document): EmbeddedTheme {
  const rootTheme = documentToRead.documentElement.getAttribute("data-theme");
  const bodyTheme = documentToRead.body?.getAttribute("data-theme");

  if (rootTheme === "dark" || bodyTheme === "dark") {
    return "dark";
  }

  if (documentToRead.documentElement.classList.contains("dark") || documentToRead.body?.classList.contains("dark")) {
    return "dark";
  }

  return "light";
}

function toRecord(value: unknown) {
  return value && typeof value === "object" ? (value as RawRecord) : null;
}

function parseJsonRecord(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
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
