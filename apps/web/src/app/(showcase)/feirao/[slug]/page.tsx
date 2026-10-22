import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, Radio } from "lucide-react";
import { formatFairPeriod } from "@/features/fairs/constants";
import { PageView } from "@/features/showcase/page-view";
import { ShowcasePagination } from "@/features/showcase/pagination";
import {
  fetchPublicFair,
  fetchPublicFairVehicles,
  listParamsFrom,
} from "@/features/showcase/server-api";
import { ShareButton } from "@/features/showcase/share-button";
import { VehicleCard } from "@/features/showcase/vehicle-card";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const fair = await fetchPublicFair(slug);
  if (!fair) return { title: "Feirão não encontrado" };
  return {
    title: fair.name,
    description: `${formatFairPeriod(fair.startsAt, fair.endsAt)} · ${fair.venue} · ${fair.counts.vehicles} carros de ${fair.stores.length} lojas.`,
  };
}

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function PublicFairPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const fair = await fetchPublicFair(slug);
  if (!fair) notFound();
  const filters = listParamsFrom(await searchParams);
  const list = await fetchPublicFairVehicles(slug, filters);
  if (!list) notFound();
  const basePath = `/feirao/${slug}`;
  const ended = fair.status === "ENDED";

  return (
    <div className="space-y-5">
      <PageView fairSlug={slug} />
      <section className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {fair.status === "LIVE" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-xs font-bold uppercase text-white">
              <Radio className="h-3.5 w-3.5" /> Acontecendo agora
            </span>
          ) : ended ? (
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-white">
              Feirão encerrado
            </span>
          ) : (
            <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
              Próximo feirão
            </span>
          )}
        </div>
        <h1 className="font-display text-3xl leading-tight sm:text-4xl" data-testid="fair-name">
          {fair.name}
        </h1>
        <p className="flex items-center gap-2 text-sm">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          {formatFairPeriod(fair.startsAt, fair.endsAt)}
        </p>
        <p className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          {[fair.venue, fair.address].filter(Boolean).join(" · ")}
        </p>
        {fair.description ? <p className="whitespace-pre-line text-sm text-muted-foreground">{fair.description}</p> : null}
        <p className="text-sm text-muted-foreground" data-testid="fair-counts">
          {fair.counts.vehicles} carros de {fair.stores.length} {fair.stores.length === 1 ? "loja" : "lojas"}
          {fair.counts.sold ? ` · ${fair.counts.sold} já vendidos` : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          {fair.stores.map((s) => (
            <Link
              key={s.slug}
              href={`${basePath}?store=${s.slug}`}
              className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted"
            >
              {s.name}
            </Link>
          ))}
        </div>
        <ShareButton title={fair.name} />
      </section>

      <form action={basePath} method="get" className="grid grid-cols-2 gap-2 rounded-2xl border bg-white/90 p-3 shadow-sm sm:grid-cols-5">
        <input
          name="q"
          type="search"
          defaultValue={filters.q ?? ""}
          placeholder="Buscar modelo"
          aria-label="Buscar"
          className={`${selectClass} col-span-2`}
        />
        <select name="make" defaultValue={filters.make ?? ""} aria-label="Marca" className={selectClass}>
          <option value="">Todas as marcas</option>
          {fair.makes.map((m) => (
            <option key={m.make} value={m.make}>
              {m.make} ({m.count})
            </option>
          ))}
        </select>
        <select name="store" defaultValue={filters.store ?? ""} aria-label="Loja" className={selectClass}>
          <option value="">Todas as lojas</option>
          {fair.stores.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
        <label className="col-span-2 flex items-center gap-2 text-sm sm:col-span-1">
          <input type="checkbox" name="onlyAvailable" value="true" defaultChecked={filters.onlyAvailable === "true"} />
          Esconder vendidos
        </label>
        <button
          type="submit"
          className="col-span-2 h-11 rounded-lg bg-primary text-sm font-semibold text-primary-foreground sm:col-span-5"
        >
          Filtrar
        </button>
      </form>

      {list.data.length ? (
        <ul className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4" data-testid="fair-vehicle-list">
          {list.data.map((v) => (
            <VehicleCard key={v.slug} vehicle={v} fairSlug={slug} />
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border bg-white p-6 text-center text-muted-foreground">
          Nenhum carro com esses filtros.
        </p>
      )}
      <ShowcasePagination
        basePath={basePath}
        params={filters}
        page={list.meta.page}
        totalPages={list.meta.totalPages}
        keepStore
      />
    </div>
  );
}
