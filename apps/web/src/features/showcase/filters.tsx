import Link from "next/link";
import { FUELS, FUEL_LABEL, TRANSMISSIONS, TRANSMISSION_LABEL } from "@/features/inventory/constants";
import type { PublicListParams } from "@/features/showcase/server-api";

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Filtros por GET: funciona sem JavaScript e a URL pode ser compartilhada. */
export function ShowcaseFilters({
  action,
  params,
  makes,
}: {
  action: string;
  params: PublicListParams;
  makes: { make: string; count: number }[];
}) {
  const year = new Date().getFullYear();
  const years = Array.from({ length: 16 }, (_, i) => year - i);
  const hasFilters = Object.entries(params).some(([k, v]) => v && k !== "page" && k !== "store");

  return (
    <form action={action} method="get" className="space-y-3 rounded-2xl border bg-white/90 p-3 shadow-sm">
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="q">
          Buscar
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={params.q ?? ""}
          placeholder="Buscar marca ou modelo"
          className={`${selectClass} flex-1`}
        />
        <button
          type="submit"
          className="h-11 shrink-0 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Buscar
        </button>
      </div>
      <details className="group" open={hasFilters}>
        <summary className="cursor-pointer select-none text-sm font-medium text-primary">
          Mais filtros
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <select name="make" defaultValue={params.make ?? ""} aria-label="Marca" className={selectClass}>
            <option value="">Todas as marcas</option>
            {makes.map((m) => (
              <option key={m.make} value={m.make}>
                {m.make} ({m.count})
              </option>
            ))}
          </select>
          <select name="maxPrice" defaultValue={params.maxPrice ?? ""} aria-label="Preço até" className={selectClass}>
            <option value="">Qualquer preço</option>
            {[30_000, 40_000, 50_000, 60_000, 80_000, 100_000, 150_000].map((p) => (
              <option key={p} value={p}>
                Até {p.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}
              </option>
            ))}
          </select>
          <select name="minYear" defaultValue={params.minYear ?? ""} aria-label="Ano a partir de" className={selectClass}>
            <option value="">Qualquer ano</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y} ou mais novo
              </option>
            ))}
          </select>
          <select name="transmission" defaultValue={params.transmission ?? ""} aria-label="Câmbio" className={selectClass}>
            <option value="">Qualquer câmbio</option>
            {TRANSMISSIONS.map((t) => (
              <option key={t} value={t}>
                {TRANSMISSION_LABEL[t]}
              </option>
            ))}
          </select>
          <select name="fuel" defaultValue={params.fuel ?? ""} aria-label="Combustível" className={selectClass}>
            <option value="">Qualquer combustível</option>
            {FUELS.map((f) => (
              <option key={f} value={f}>
                {FUEL_LABEL[f]}
              </option>
            ))}
          </select>
          <select name="sort" defaultValue={params.sort ?? "recent"} aria-label="Ordenar" className={selectClass}>
            <option value="recent">Mais recentes</option>
            <option value="price_asc">Menor preço</option>
            <option value="price_desc">Maior preço</option>
          </select>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="submit"
            className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Aplicar filtros
          </button>
          {hasFilters ? (
            <Link href={action} className="inline-flex h-10 items-center rounded-lg border px-4 text-sm">
              Limpar
            </Link>
          ) : null}
        </div>
      </details>
    </form>
  );
}
