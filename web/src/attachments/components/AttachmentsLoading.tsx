import { Spinner } from "@/components/ui/spinner";

export function AttachmentsLoading(props: { inline?: boolean }) {
  if (props.inline) {
    return (
      <div
        aria-busy="true"
        className="flex items-center justify-center px-5 py-12"
      >
        <Spinner aria-label="Загрузка" className="size-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <main
      aria-busy="true"
      className="radar-shell radar-shell-compact flex items-center justify-center"
    >
      <Spinner aria-label="Загрузка" className="size-8 text-muted-foreground" />
    </main>
  );
}
