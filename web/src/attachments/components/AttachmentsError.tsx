import { type ReactNode } from "react";
import { AlertCircleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function AttachmentsError(props: {
  message: ReactNode;
  title?: string;
}) {
  return (
    <Alert variant="destructive" className="border-destructive/30">
      <AlertCircleIcon />
      <AlertTitle>{props.title || "Ошибка"}</AlertTitle>
      <AlertDescription>{props.message}</AlertDescription>
    </Alert>
  );
}
