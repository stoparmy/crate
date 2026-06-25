import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { PaginationControls } from "@/components/PaginationControls";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, withQuery } from "@/lib/api";
import {
  getChatwootAuthHeaders,
  requestDashboardContext,
  subscribeToDashboardContext,
} from "@/lib/chatwoot";
import { defaultMeta, embeddedApiBase } from "./constants";
import { AttachmentsEmptyState } from "./components/AttachmentsEmptyState";
import { AttachmentsError } from "./components/AttachmentsError";
import { AttachmentsList } from "./components/AttachmentsList";
import { AttachmentsLoading } from "./components/AttachmentsLoading";
import {
  formatAttachmentsTitle,
  getErrorMessage,
  groupAttachmentsByDate,
} from "./utils";
import type { ConversationAttachment, DashboardContext, PagedMeta } from "./types";

export function AttachmentsDashboard() {
  const authHeaders = useMemo(() => getChatwootAuthHeaders(), []);
  const [context, setContext] = useState<DashboardContext | null>(null);
  const [attachments, setAttachments] = useState<ConversationAttachment[]>([]);
  const [meta, setMeta] = useState<PagedMeta>(defaultMeta);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToDashboardContext((nextContext) => {
      setContext(nextContext);
      setMeta((current) => ({ ...current, page: 1 }));
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!authHeaders) {
      setErrorMessage(
        "Невозможно получить авторизацию Chatwoot из текущей сессии.",
      );
      setIsLoading(false);
      return;
    }

    void bootstrap();
  }, [authHeaders]);

  useEffect(() => {
    if (!context || !authHeaders) {
      return;
    }

    void refreshAttachments({ showLoading: true });
  }, [context, authHeaders, meta.page]);

  const attachmentGroups = useMemo(
    () => groupAttachmentsByDate(attachments),
    [attachments],
  );
  const hasMultiplePages = Math.ceil(meta.total / meta.pageSize) > 1;

  async function bootstrap() {
    try {
      await apiFetch(`${embeddedApiBase}/me`, {}, authHeaders || undefined);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshAttachments(options: { showLoading: boolean }) {
    if (!context || !authHeaders) {
      return;
    }

    if (options.showLoading) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const payload = await apiFetch<{
        attachments: ConversationAttachment[];
        meta: PagedMeta;
      }>(
        withQuery(`${embeddedApiBase}/attachments`, {
          conversationId: context.conversationId,
          page: meta.page,
          pageSize: meta.pageSize,
        }),
        {},
        authHeaders,
      );
      setAttachments(payload.attachments);
      setMeta(payload.meta);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  function downloadAttachmentIds(ids?: number[]) {
    if (!context) {
      return;
    }

    const params = new URLSearchParams({
      conversationId: String(context.conversationId),
    });
    if (ids && ids.length > 0) {
      params.set("attachmentIds", ids.join(","));
    }

    window.open(
      `${embeddedApiBase}/attachments/download?${params.toString()}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function buildContentUrl(
    attachmentId: number,
    disposition: "inline" | "attachment" = "inline",
  ) {
    if (!context) {
      return "";
    }

    const params = new URLSearchParams({
      conversationId: String(context.conversationId),
      attachmentId: String(attachmentId),
      disposition,
    });
    return `${embeddedApiBase}/attachments/content?${params.toString()}`;
  }

  if (isLoading && !context) {
    return <AttachmentsLoading />;
  }

  return (
    <main className="radar-shell radar-shell-compact">
      <section className="radar-flow">
        {errorMessage ? (
          <AttachmentsError title="Ошибка" message={errorMessage} />
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>{isLoading ? "Файлы" : formatAttachmentsTitle(attachments.length)}</span>
              {attachments.length > 0 && !isLoading ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Обновить вложения"
                  title="Обновить вложения"
                  disabled={!context || isRefreshing}
                  onClick={() =>
                    void refreshAttachments({ showLoading: false })
                  }
                >
                  <RefreshCw
                    className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
                  />
                </Button>
              ) : null}
            </CardTitle>
            <CardAction>
              <Button
                type="button"
                variant="secondary"
                disabled={attachments.length === 0}
                onClick={() => downloadAttachmentIds()}
              >
                <Download className="size-4" />
                Скачать все
              </Button>
            </CardAction>
          </CardHeader>

          {isLoading ? (
            <AttachmentsLoading inline />
          ) : attachments.length > 0 ? (
            <>
              <AttachmentsList
                buildContentUrl={buildContentUrl}
                contactName={context?.contactName}
                groups={attachmentGroups}
              />
              {hasMultiplePages ? (
                <div className="border-t border-border/70 px-4 py-4">
                  <PaginationControls
                    page={meta.page}
                    pageSize={meta.pageSize}
                    total={meta.total}
                    onPageChange={(page) =>
                      setMeta((current) => ({ ...current, page }))
                    }
                  />
                </div>
              ) : null}
            </>
          ) : (
            <AttachmentsEmptyState onRefresh={requestDashboardContext} />
          )}
        </Card>
      </section>
    </main>
  );
}
