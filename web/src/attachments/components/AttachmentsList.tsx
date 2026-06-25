import { SquareArrowOutUpRight, User } from "lucide-react";
import {
  formatBytes,
  formatTimeOnly,
  renderAttachmentVisual,
  shouldShowAgentSender,
} from "../utils";
import type { AttachmentGroup, DashboardContext } from "../types";

export function AttachmentsList(props: {
  buildContentUrl: (
    attachmentId: number,
    disposition?: "inline" | "attachment",
  ) => string;
  contactName: DashboardContext["contactName"] | null | undefined;
  groups: AttachmentGroup[];
}) {
  return (
    <div className="grid -mx-4 -mb-4 px-4">
      {props.groups.map((group) => (
        <section key={group.key}>
          <div className="px-4 text-sm font-medium text-muted-foreground">
            {group.label}
          </div>
          <div className="overflow-hidden">
            {group.items.map((attachment, index) => (
              <article
                key={attachment.id}
                className={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 p-4 ${
                  index === 0 ? "" : "border-t border-border/70"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
                    {renderAttachmentVisual(attachment)}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <a
                      href={props.buildContentUrl(attachment.id, "inline")}
                      target="_blank"
                      rel="noreferrer"
                      className="group/file inline-flex min-w-0 items-center gap-1 text-sm font-medium text-foreground focus:outline-none"
                    >
                      <span className="truncate transition group-hover/file:underline group-focus-visible/file:underline">
                        {attachment.fileName}
                      </span>
                      <SquareArrowOutUpRight className="size-3.5 shrink-0 opacity-0 group-hover/file:opacity-100 group-focus-visible/file:opacity-100" />
                    </a>
                    {shouldShowAgentSender(
                      attachment.senderName,
                      props.contactName,
                    ) ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
                        <User className="size-3.5" />
                        <span>{attachment.senderName}</span>
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-sm text-muted-foreground">
                    <span className="truncate">
                      {attachment.messageCreatedAt
                        ? formatTimeOnly(attachment.messageCreatedAt)
                        : "Время неизвестно"}
                    </span>
                    <span className="shrink-0">•</span>
                    <span className="shrink-0">
                      {attachment.sizeBytes
                        ? formatBytes(attachment.sizeBytes)
                        : "Размер неизвестен"}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
