import { useEffect, useMemo, useState } from "react";
import { CloudUpload, Download, RefreshCw } from "lucide-react";
import { PaginationControls } from "@/components/PaginationControls";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch, withQuery } from "@/lib/api";
import { createDriveFolder, uploadDriveFile } from "@/lib/googleDriveApi";
import { driveFileScope, requestDriveAccessToken } from "@/lib/googleIdentity";
import {
  getChatwootAuthHeaders,
  requestDashboardContext,
  subscribeToDashboardContext,
} from "@/lib/chatwoot";
import {
  defaultMeta,
  driveFolderSaveConfig,
  embeddedApiBase,
} from "./constants";
import { AttachmentsEmptyState } from "./components/AttachmentsEmptyState";
import { AttachmentsError } from "./components/AttachmentsError";
import { AttachmentsList } from "./components/AttachmentsList";
import { AttachmentsLoading } from "./components/AttachmentsLoading";
import {
  formatAttachmentsTitle,
  getErrorMessage,
  groupAttachmentsByDate,
} from "./utils";
import type { ConversationAttachment, PagedMeta } from "./types";

type SaveAllToDriveState =
  | { status: "idle" }
  | { status: "authorizing" | "preparing"; message: string }
  | {
      status: "uploading";
      folderName: string;
      total: number;
      uploaded: number;
    }
  | {
      status: "success";
      folderName: string;
      folderUrl: string | null;
      total: number;
    }
  | { status: "error"; message: string };

export function AttachmentsDashboard() {
  const authHeaders = useMemo(() => getChatwootAuthHeaders(), []);
  const [context, setContext] = useState<DashboardContext | null>(null);
  const [attachments, setAttachments] = useState<ConversationAttachment[]>([]);
  const [meta, setMeta] = useState<PagedMeta>(defaultMeta);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveAllToDriveState, setSaveAllToDriveState] =
    useState<SaveAllToDriveState>({ status: "idle" });

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
    const downloadUrl = buildArchiveDownloadUrl(ids);
    if (!downloadUrl) {
      return;
    }

    window.open(downloadUrl, "_blank", "noopener,noreferrer");
  }

  function buildArchiveDownloadUrl(ids?: number[]) {
    if (!context) {
      return "";
    }

    const params = new URLSearchParams({
      conversationId: String(context.conversationId),
    });
    if (ids && ids.length > 0) {
      params.set("attachmentIds", ids.join(","));
    }

    return `${embeddedApiBase}/attachments/download?${params.toString()}`;
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

  async function fetchAllAttachments() {
    if (!context || !authHeaders) {
      return [];
    }

    const pageSize = 50;
    const items: ConversationAttachment[] = [];

    for (let page = 1; ; page += 1) {
      const payload = await apiFetch<{
        attachments: ConversationAttachment[];
        meta: PagedMeta;
      }>(
        withQuery(`${embeddedApiBase}/attachments`, {
          conversationId: context.conversationId,
          page,
          pageSize,
        }),
        {},
        authHeaders,
      );

      items.push(...payload.attachments);

      if (
        payload.attachments.length === 0 ||
        items.length >= payload.meta.total
      ) {
        break;
      }
    }

    return items;
  }

  async function fetchAttachmentBlob(attachment: ConversationAttachment) {
    const response = await fetch(buildContentUrl(attachment.id, "attachment"), {
      credentials: "include",
      headers: authHeaders || undefined,
    });

    if (!response.ok) {
      throw new Error(`attachment_download_failed:${attachment.fileName}`);
    }

    return response.blob();
  }

  function buildDriveFolderName(total: number) {
    const prefix = driveFolderSaveConfig.folderPrefix;
    const conversationId = context?.conversationId ?? "unknown";
    const dateStamp = new Date()
      .toISOString()
      .replace(/[:]/g, "-")
      .replace(/\..+$/, "");

    return `${prefix} conversation ${conversationId} attachments (${total}) ${dateStamp}`;
  }

  async function saveAllToDriveFolder() {
    if (
      !driveFolderSaveConfig.enabled ||
      !driveFolderSaveConfig.clientId ||
      !context ||
      !authHeaders
    ) {
      return;
    }

    try {
      setSaveAllToDriveState({
        status: "authorizing",
        message: "Запрашиваю доступ к Google Drive…",
      });
      const accessToken = await requestDriveAccessToken({
        clientId: driveFolderSaveConfig.clientId,
        scope: driveFileScope,
      });

      setSaveAllToDriveState({
        status: "preparing",
        message: "Получаю список вложений…",
      });
      const allAttachments = await fetchAllAttachments();
      if (allAttachments.length === 0) {
        throw new Error("Вложения не найдены.");
      }

      const folderName = buildDriveFolderName(allAttachments.length);
      const folder = await createDriveFolder({
        accessToken,
        name: folderName,
      });

      setSaveAllToDriveState({
        status: "uploading",
        folderName,
        total: allAttachments.length,
        uploaded: 0,
      });

      for (let index = 0; index < allAttachments.length; index += 1) {
        const attachment = allAttachments[index];
        const blob = await fetchAttachmentBlob(attachment);
        await uploadDriveFile({
          accessToken,
          blob,
          name: attachment.fileName,
          parentId: folder.id,
        });

        setSaveAllToDriveState({
          status: "uploading",
          folderName,
          total: allAttachments.length,
          uploaded: index + 1,
        });
      }

      setSaveAllToDriveState({
        status: "success",
        folderName,
        folderUrl: folder.webViewLink || null,
        total: allAttachments.length,
      });
    } catch (error) {
      setSaveAllToDriveState({
        status: "error",
        message: getErrorMessage(error),
      });
    }
  }

  const isSavingAllToDrive =
    saveAllToDriveState.status === "authorizing" ||
    saveAllToDriveState.status === "preparing" ||
    saveAllToDriveState.status === "uploading";

  if (isLoading && !context) {
    return <AttachmentsLoading />;
  }

  return (
    <main className="radar-shell radar-shell-compact">
      <section className="radar-flow">
        {errorMessage ? (
          <AttachmentsError title="Ошибка" message={errorMessage} />
        ) : null}
        {saveAllToDriveState.status === "error" ? (
          <AttachmentsError
            title="Google Drive"
            message={saveAllToDriveState.message}
          />
        ) : null}
        {saveAllToDriveState.status === "success" ? (
          <Alert className="border-border/70">
            <AlertTitle>Google Drive</AlertTitle>
            <AlertDescription>
              {saveAllToDriveState.folderUrl ? (
                <span>
                  Сохранено {saveAllToDriveState.total} файл(ов) в папку{" "}
                  <a
                    href={saveAllToDriveState.folderUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    {saveAllToDriveState.folderName}
                  </a>
                  .
                </span>
              ) : (
                `Сохранено ${saveAllToDriveState.total} файл(ов) в папку ${saveAllToDriveState.folderName}.`
              )}
            </AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>
                {isLoading
                  ? "Файлы"
                  : formatAttachmentsTitle(attachments.length)}
              </span>
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
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={attachments.length === 0}
                  onClick={() => downloadAttachmentIds()}
                >
                  <Download className="size-4" />
                  Скачать
                </Button>
                {driveFolderSaveConfig.enabled ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={attachments.length === 0 || isSavingAllToDrive}
                    onClick={() => void saveAllToDriveFolder()}
                  >
                    {isSavingAllToDrive ? (
                      <Spinner className="size-4" />
                    ) : (
                      <CloudUpload className="size-4" />
                    )}
                    {saveAllToDriveState.status === "uploading"
                      ? `Сохраняю ${saveAllToDriveState.uploaded}/${saveAllToDriveState.total}`
                      : "Загрузить на Диск"}
                  </Button>
                ) : null}
              </div>
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
