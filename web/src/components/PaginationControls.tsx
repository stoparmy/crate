import type { MouseEvent } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

type PaginationControlsProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
};

export function PaginationControls(props: PaginationControlsProps) {
  const pageCount = Math.max(Math.ceil(props.total / props.pageSize), 1);
  if (pageCount <= 1) {
    return null;
  }

  const currentPage = Math.min(Math.max(props.page, 1), pageCount);
  const items = getPaginationItems(currentPage, pageCount);

  const createHandler =
    (nextPage: number, disabled = false) =>
    (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      if (disabled || nextPage === currentPage) {
        return;
      }
      props.onPageChange(nextPage);
    };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        props.className,
      )}
    >
      <div className="text-sm text-muted-foreground">
        Страница {currentPage} из {pageCount}
      </div>

      <Pagination className="mx-0 w-auto justify-start sm:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationLink
              href="#"
              size="default"
              aria-label="Предыдущая страница"
              onClick={createHandler(Math.max(currentPage - 1, 1), currentPage <= 1)}
              className={cn("gap-1 pl-2.5", currentPage <= 1 && "pointer-events-none opacity-50")}
            >
              <ChevronLeftIcon />
              <span>Назад</span>
            </PaginationLink>
          </PaginationItem>

          {items.map((item, index) => {
            if (item === "ellipsis") {
              return (
                <PaginationItem key={`ellipsis-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              );
            }

            return (
              <PaginationItem key={item}>
                <PaginationLink
                  href="#"
                  isActive={item === currentPage}
                  onClick={createHandler(item)}
                >
                  {item}
                </PaginationLink>
              </PaginationItem>
            );
          })}

          <PaginationItem>
            <PaginationLink
              href="#"
              size="default"
              aria-label="Следующая страница"
              onClick={createHandler(Math.min(currentPage + 1, pageCount), currentPage >= pageCount)}
              className={cn("gap-1 pr-2.5", currentPage >= pageCount && "pointer-events-none opacity-50")}
            >
              <span>Вперёд</span>
              <ChevronRightIcon />
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

function getPaginationItems(currentPage: number, pageCount: number) {
  if (pageCount <= 5) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, "ellipsis", pageCount] as const;
  }

  if (currentPage >= pageCount - 2) {
    return [1, "ellipsis", pageCount - 3, pageCount - 2, pageCount - 1, pageCount] as const;
  }

  return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", pageCount] as const;
}
