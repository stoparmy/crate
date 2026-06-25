import { FileArchive } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AttachmentsEmptyState(props: { onRefresh: () => void }) {
  return (
    <div className="px-5 py-8 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-background text-muted-foreground shadow-sm">
        <FileArchive className="size-5" />
      </div>
      <h2 className="mt-4 text-base font-medium text-foreground">
        Вложения не найдены
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Попробуйте обновить страницу, если недавно добавленные вложения все еще
        не отображаются.
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-4"
        onClick={props.onRefresh}
      >
        Обновить
      </Button>
    </div>
  );
}
