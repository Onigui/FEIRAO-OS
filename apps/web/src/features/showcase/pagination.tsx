import Link from "next/link";
import type { PublicListParams } from "@/features/showcase/server-api";

export function ShowcasePagination({
  basePath,
  params,
  page,
  totalPages,
}: {
  basePath: string;
  params: PublicListParams;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const href = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "page" && k !== "store") qs.set(k, v);
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const link = "inline-flex h-10 items-center rounded-lg border bg-white px-4 text-sm font-medium";
  return (
    <nav className="flex items-center justify-between gap-3" aria-label="Páginas">
      {page > 1 ? (
        <Link href={href(page - 1)} className={link}>
          Anterior
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-muted-foreground">
        Página {page} de {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={href(page + 1)} className={link}>
          Próxima
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
