import { Router } from "express";
import { getDashboardActor, getDashboardAuth } from "../auth";
import {
  fetchAttachmentContent,
  listConversationAttachments,
  paginateAttachments,
  resolveConversationAttachments,
} from "../chatwoot/attachments";
import { HttpError, route } from "../errors";
import { streamBody, streamZip, withDownload } from "../downloads";

export const embeddedRouter = Router();

embeddedRouter.get(
  "/me",
  route(async (req, res) => {
    res.json({ actor: getDashboardActor(req) });
  })
);

embeddedRouter.get(
  "/attachments",
  route(async (req, res) => {
    const actor = getDashboardActor(req);
    const auth = getDashboardAuth(req);
    const conversationId = parseRequiredInt(req.query.conversationId, "conversation_id_required");
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = Math.min(parsePositiveInt(req.query.pageSize, 20), 50);
    const attachments = await listConversationAttachments({
      accountId: actor.accountId,
      conversationId,
      auth,
    });
    const paged = paginateAttachments(attachments, { page, pageSize });

    res.json(paged);
  })
);

embeddedRouter.get(
  "/attachments/content",
  route(async (req, res) => {
    const actor = getDashboardActor(req);
    const auth = getDashboardAuth(req);
    const conversationId = parseRequiredInt(req.query.conversationId, "conversation_id_required");
    const attachmentId = parseRequiredInt(req.query.attachmentId, "attachment_id_required");
    const disposition = req.query.disposition === "inline" ? "inline" : "attachment";

    const [attachment] = await resolveConversationAttachments({
      accountId: actor.accountId,
      conversationId,
      auth,
      attachmentIds: [attachmentId],
    });

    await withDownload(res, async (signal) => {
      const { response, contentType, contentLength } = await fetchAttachmentContent(attachment, auth, signal);
      const body = response.body;
      if (!body) {
        throw new HttpError(502, "attachment_download_failed");
      }

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", formatContentDisposition(disposition, attachment.fileName));
      if (contentLength) {
        res.setHeader("Content-Length", contentLength);
      }

      await streamBody(body, res, signal);
    });
  })
);

embeddedRouter.get(
  "/attachments/download",
  route(async (req, res) => {
    const actor = getDashboardActor(req);
    const auth = getDashboardAuth(req);
    const conversationId = parseRequiredInt(req.query.conversationId, "conversation_id_required");
    const attachmentIds = parseAttachmentIds(req.query.attachmentIds);
    const attachments = await resolveConversationAttachments({
      accountId: actor.accountId,
      conversationId,
      auth,
      attachmentIds,
    });

    if (attachments.length === 0) {
      throw new HttpError(404, "attachment_not_found");
    }

    if (attachments.length === 1) {
      const [attachment] = attachments;
      await withDownload(res, async (signal) => {
        const { response, contentType, contentLength } = await fetchAttachmentContent(attachment, auth, signal);
        const body = response.body;
        if (!body) {
          throw new HttpError(502, "attachment_download_failed");
        }

        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Disposition", formatContentDisposition("attachment", attachment.fileName));
        if (contentLength) {
          res.setHeader("Content-Length", contentLength);
        }

        await streamBody(body, res, signal);
      });
      return;
    }

    const archiveName = `conversation-${conversationId}-attachments.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", formatContentDisposition("attachment", archiveName));

    await withDownload(res, async (signal) => {
      async function* entries() {
        const usedNames = new Set<string>();
        for (const attachment of attachments) {
          signal.throwIfAborted();
          const { response } = await fetchAttachmentContent(attachment, auth, signal);
          if (!response.body) {
            throw new HttpError(502, "attachment_download_failed");
          }
          yield {
            name: makeUniqueFileName(usedNames, attachment.fileName),
            body: response.body,
          };
        }
      }
      await streamZip(entries(), res, signal);
    });
  })
);

function parseRequiredInt(value: unknown, errorCode: string) {
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  throw new HttpError(400, errorCode);
}

function parsePositiveInt(value: unknown, fallback: number) {
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return fallback;
}

function parseAttachmentIds(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const ids = value
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((part) => Number.isInteger(part) && part > 0);

  return ids.length > 0 ? ids : undefined;
}

function formatContentDisposition(disposition: "inline" | "attachment", fileName: string) {
  const fallback = fileName.replace(/[^\x20-\x7E]+/g, "_").replace(/"/g, "");
  const encoded = encodeURIComponent(fileName);
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

function makeUniqueFileName(usedNames: Set<string>, originalName: string) {
  if (!usedNames.has(originalName)) {
    usedNames.add(originalName);
    return originalName;
  }

  const dotIndex = originalName.lastIndexOf(".");
  const baseName = dotIndex > 0 ? originalName.slice(0, dotIndex) : originalName;
  const extension = dotIndex > 0 ? originalName.slice(dotIndex) : "";

  let suffix = 2;
  while (usedNames.has(`${baseName} (${suffix})${extension}`)) {
    suffix += 1;
  }

  const nextName = `${baseName} (${suffix})${extension}`;
  usedNames.add(nextName);
  return nextName;
}
