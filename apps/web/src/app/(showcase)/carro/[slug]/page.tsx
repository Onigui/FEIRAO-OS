import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";
import { FUEL_LABEL, TRANSMISSION_LABEL } from "@/features/inventory/constants";
import { formatKm, formatPriceCents, formatYears } from "@/features/inventory/format";
import { formatFairPeriod } from "@/features/fairs/constants";
import { whatsappMessage } from "@/features/showcase/constants";
import { InterestForm } from "@/features/showcase/interest-form";
import { PageView } from "@/features/showcase/page-view";
import { PhotoGallery } from "@/features/showcase/photo-gallery";
import { fetchPublicVehicle } from "@/features/showcase/server-api";
import { ShareButton } from "@/features/showcase/share-button";
import { WhatsAppButton } from "@/features/showcase/whatsapp-button";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const v = await fetchPublicVehicle(slug);
  if (!v) return { title: "Carro não encontrado" };
  const title = `${v.make} ${v.model} ${v.yearModel} — ${formatPriceCents(v.priceCents)}`;
  return {
    title,
    description: `${formatKm(v.mileageKm)}, ${TRANSMISSION_LABEL[v.transmission].toLowerCase()}, ${v.store.name}${v.store.city ? ` em ${v.store.city}` : ""}.`,
    openGraph: {
      title,
      images: v.photos[0] ? [{ url: v.photos[0].url }] : undefined,
    },
  };
}

export default async function VehiclePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const v = await fetchPublicVehicle(slug);
  if (!v) notFound();

  // Veio da página do feirão ou do QR: atribui o contato e mostra o preço do evento.
  const fairParam = first(sp.feirao);
  const fromQr = first(sp.origem) === "qr";
  const fair = v.fairs.find((f) => f.slug === fairParam) ?? null;
  const badgeFair = fair ?? v.fairs[0] ?? null;
  const fairPrice = fair && fair.priceCentsAtFair !== v.priceCents ? fair.priceCentsAtFair : null;

  const sold = v.status === "SOLD";
  const label = `${v.make} ${v.model} ${v.version ?? ""} ${v.yearModel}`.replace(/\s+/g, " ").trim();
  const specs: [string, string][] = [
    ["Ano", formatYears(v.yearManufacture, v.yearModel)],
    ["Quilometragem", formatKm(v.mileageKm)],
    ["Câmbio", TRANSMISSION_LABEL[v.transmission]],
    ["Combustível", FUEL_LABEL[v.fuel]],
    ...(v.bodyType ? ([["Carroceria", v.bodyType]] as [string, string][]) : []),
    ...(v.color ? ([["Cor", v.color]] as [string, string][]) : []),
    ["Código do anúncio", v.code],
  ];

  return (
    <div className="space-y-5">
      <PageView vehicleSlug={v.slug} fairSlug={fair?.slug} />
      <nav className="text-sm text-muted-foreground">
        <Link href="/vitrine" className="hover:underline">
          Vitrine
        </Link>{" "}
        ›{" "}
        <Link href={`/vitrine/${v.store.slug}`} className="hover:underline">
          {v.store.name}
        </Link>
      </nav>

      {badgeFair && !sold ? (
        <Link
          href={`/feirao/${badgeFair.slug}`}
          className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-accent/60 px-4 py-3 text-sm"
          data-testid="fair-badge"
        >
          <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold uppercase text-primary-foreground">
            {badgeFair.status === "LIVE" ? "No feirão agora" : "Vai estar no feirão"}
          </span>
          <span className="font-medium">{badgeFair.name}</span>
          <span className="text-muted-foreground">
            {formatFairPeriod(badgeFair.startsAt, badgeFair.endsAt)} · {badgeFair.venue}
          </span>
        </Link>
      ) : null}

      {sold ? (
        <p className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white" data-testid="sold-banner">
          Este carro já foi vendido.{" "}
          <Link href={`/vitrine/${v.store.slug}`} className="underline">
            Veja outros da {v.store.name}
          </Link>
          .
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-5">
          <PhotoGallery photos={v.photos} alt={label} />
          <section className="rounded-2xl border bg-white p-4">
            <h2 className="mb-3 font-semibold">Ficha</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
              {specs.map(([k, val]) => (
                <div key={k}>
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium">{val}</dd>
                </div>
              ))}
            </dl>
            {v.description ? (
              <p className="mt-4 whitespace-pre-line border-t pt-4 text-sm leading-relaxed">{v.description}</p>
            ) : null}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <section className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">
              {v.make} · {formatYears(v.yearManufacture, v.yearModel)}
            </p>
            <h1 className="font-display text-3xl leading-tight" data-testid="vehicle-title">
              {v.model} {v.version ?? ""}
            </h1>
            {fairPrice !== null && !sold ? (
              <div>
                <p className="text-sm text-muted-foreground line-through">{formatPriceCents(v.priceCents)}</p>
                <p className="font-display text-4xl text-primary" data-testid="fair-price">
                  {formatPriceCents(fairPrice)}
                </p>
                <p className="text-xs font-medium text-primary">Preço do feirão</p>
              </div>
            ) : (
              <p className={`font-display text-4xl ${sold ? "text-muted-foreground line-through" : "text-primary"}`}>
                {formatPriceCents(v.priceCents)}
              </p>
            )}
            {v.status === "RESERVED" ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Reservado — fale com a loja para saber se ainda está disponível.
              </p>
            ) : null}
            {!sold && v.store.whatsapp ? (
              <WhatsAppButton
                phone={v.store.whatsapp}
                message={whatsappMessage({ ...v, code: v.code })}
                vehicleSlug={v.slug}
                fairSlug={fair?.slug}
              />
            ) : null}
            <ShareButton title={label} />
          </section>

          {!sold ? (
            <section className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm" id="interesse">
              <h2 className="font-semibold">Prefere que a loja chame você?</h2>
              <InterestForm
                vehicleSlug={v.slug}
                vehicleLabel={label}
                storeName={v.store.name}
                source={fair ? (fromQr ? "QR" : "FAIR_PAGE") : "VEHICLE_PAGE"}
                fairSlug={fair?.slug}
              />
            </section>
          ) : null}

          <section className="rounded-2xl border bg-white p-4 text-sm">
            <p className="font-semibold">{v.store.name}</p>
            <p className="mt-1 flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-4 w-4" aria-hidden />
              {[v.store.address, v.store.city].filter(Boolean).join(" · ") || "—"}
            </p>
            <Link href={`/vitrine/${v.store.slug}`} className="mt-2 inline-block font-medium text-primary underline">
              Ver todos os carros da loja
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
