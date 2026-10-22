import type { Metadata } from "next";
import { SHOWCASE_CITY } from "@/features/showcase/constants";
import { ShowcaseFilters } from "@/features/showcase/filters";
import { PageView } from "@/features/showcase/page-view";
import { ShowcasePagination } from "@/features/showcase/pagination";
import Link from "next/link";
import { formatFairPeriod } from "@/features/fairs/constants";
import {
  fetchPublicVehicles,
  fetchUpcomingFairs,
  listParamsFrom,
} from "@/features/showcase/server-api";
import { VehicleCard } from "@/features/showcase/vehicle-card";

export const metadata: Metadata = {
  title: `Carros à venda em ${SHOWCASE_CITY}`,
  description: `Seminovos das lojas de ${SHOWCASE_CITY}, com preço e contato direto pelo WhatsApp.`,
};

export default async function CityShowcasePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = listParamsFrom(await searchParams);
  const [result, fairs] = await Promise.all([fetchPublicVehicles(params), fetchUpcomingFairs()]);
  const nextFair = fairs[0];
  const searching = Boolean(params.q || params.make || params.maxPrice || params.minYear);

  return (
    <div className="space-y-5">
      <PageView search={searching} />
      <div>
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">
          Carros à venda em {SHOWCASE_CITY}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {result.meta.total} {result.meta.total === 1 ? "carro" : "carros"} das lojas da cidade.
        </p>
      </div>
      {nextFair ? (
        <Link
          href={`/feirao/${nextFair.slug}`}
          className="block rounded-2xl bg-primary p-4 text-primary-foreground shadow-sm transition hover:opacity-95"
          data-testid="next-fair"
        >
          <p className="text-xs font-bold uppercase tracking-wide opacity-80">
            {nextFair.status === "LIVE" ? "Feirão acontecendo agora" : "Próximo feirão"}
          </p>
          <p className="font-display text-2xl leading-tight">{nextFair.name}</p>
          <p className="text-sm opacity-90">
            {formatFairPeriod(nextFair.startsAt, nextFair.endsAt)} · {nextFair.venue} · {nextFair.vehicles} carros
          </p>
          <p className="mt-1 text-sm font-semibold underline">Ver os carros do feirão</p>
        </Link>
      ) : null}
      <ShowcaseFilters action="/vitrine" params={params} makes={result.meta.makes} />
      {result.data.length ? (
        <ul className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4" data-testid="public-vehicle-list">
          {result.data.map((v) => (
            <VehicleCard key={v.slug} vehicle={v} />
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border bg-white p-6 text-center text-muted-foreground">
          Nenhum carro com esses filtros. Tente uma busca mais ampla.
        </p>
      )}
      <ShowcasePagination
        basePath="/vitrine"
        params={params}
        page={result.meta.page}
        totalPages={result.meta.totalPages}
      />
    </div>
  );
}
