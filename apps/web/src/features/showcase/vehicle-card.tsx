import Link from "next/link";
import { Car } from "lucide-react";
import { FUEL_LABEL, TRANSMISSION_LABEL } from "@/features/inventory/constants";
import { formatKm, formatPriceCents, formatYears } from "@/features/inventory/format";
import type { PublicVehicleCard } from "@/features/showcase/types";

export function VehicleCard({
  vehicle: v,
  showStore = true,
  fairSlug,
}: {
  vehicle: PublicVehicleCard;
  showStore?: boolean;
  /** Na página do feirão: o link leva a origem e os vendidos ganham a faixa. */
  fairSlug?: string;
}) {
  const sold = v.status === "SOLD";
  return (
    <li>
      <Link
        href={fairSlug ? `/carro/${v.slug}?feirao=${encodeURIComponent(fairSlug)}` : `/carro/${v.slug}`}
        className="group block overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative aspect-[4/3] bg-muted">
          {v.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={v.coverUrl}
              alt={`${v.make} ${v.model} ${v.yearModel}`}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Car className="h-10 w-10" aria-hidden />
            </div>
          )}
          {sold ? (
            <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 -rotate-6 bg-red-600/90 py-1.5 text-center text-lg font-bold uppercase tracking-widest text-white">
              Vendido
            </span>
          ) : null}
          {v.status === "RESERVED" ? (
            <span className="absolute left-2 top-2 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
              Reservado
            </span>
          ) : null}
        </div>
        <div className="space-y-1 p-3">
          <p className="truncate text-sm text-muted-foreground">
            {v.make} · {formatYears(v.yearManufacture, v.yearModel)}
          </p>
          <h3 className="truncate font-semibold leading-tight">
            {v.model} {v.version ?? ""}
          </h3>
          <p className={`font-display text-xl ${sold ? "text-muted-foreground line-through" : "text-primary"}`}>
            {formatPriceCents(v.priceCents)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatKm(v.mileageKm)} · {TRANSMISSION_LABEL[v.transmission]} · {FUEL_LABEL[v.fuel]}
          </p>
          {showStore ? (
            <p className="truncate pt-1 text-xs font-medium text-foreground/80">{v.store.name}</p>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
