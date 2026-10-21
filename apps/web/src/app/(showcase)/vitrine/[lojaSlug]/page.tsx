import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { ShowcaseFilters } from "@/features/showcase/filters";
import { PageView } from "@/features/showcase/page-view";
import { ShowcasePagination } from "@/features/showcase/pagination";
import {
  fetchPublicStore,
  fetchPublicVehicles,
  listParamsFrom,
} from "@/features/showcase/server-api";
import { VehicleCard } from "@/features/showcase/vehicle-card";
import { WhatsAppButton } from "@/features/showcase/whatsapp-button";

type Props = {
  params: Promise<{ lojaSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lojaSlug } = await params;
  const store = await fetchPublicStore(lojaSlug);
  if (!store) return { title: "Loja não encontrada" };
  return {
    title: `${store.name} — carros à venda`,
    description: `Estoque da ${store.name}${store.city ? ` em ${store.city}` : ""}, com contato pelo WhatsApp.`,
  };
}

export default async function StoreShowcasePage({ params, searchParams }: Props) {
  const { lojaSlug } = await params;
  const store = await fetchPublicStore(lojaSlug);
  if (!store) notFound();
  const listParams = { ...listParamsFrom(await searchParams), store: lojaSlug };
  const result = await fetchPublicVehicles(listParams);
  const basePath = `/vitrine/${lojaSlug}`;

  return (
    <div className="space-y-5">
      <PageView storeSlug={lojaSlug} />
      <section className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <h1 className="font-display text-3xl leading-tight" data-testid="store-name">
            {store.name}
          </h1>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" aria-hidden />
            {[store.address, store.city].filter(Boolean).join(" · ") || "—"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {store.vehicleCount} {store.vehicleCount === 1 ? "carro" : "carros"} na vitrine
          </p>
        </div>
        {store.whatsapp ? (
          <div className="sm:w-64">
            <WhatsAppButton
              phone={store.whatsapp}
              message={`Olá! Vi o estoque da ${store.name} na vitrine.`}
              storeSlug={lojaSlug}
              label="Falar com a loja"
            />
          </div>
        ) : null}
      </section>
      <ShowcaseFilters action={basePath} params={listParams} makes={result.meta.makes} />
      {result.data.length ? (
        <ul className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4" data-testid="public-vehicle-list">
          {result.data.map((v) => (
            <VehicleCard key={v.slug} vehicle={v} showStore={false} />
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border bg-white p-6 text-center text-muted-foreground">
          Nenhum carro com esses filtros.
        </p>
      )}
      <ShowcasePagination
        basePath={basePath}
        params={listParams}
        page={result.meta.page}
        totalPages={result.meta.totalPages}
      />
    </div>
  );
}
