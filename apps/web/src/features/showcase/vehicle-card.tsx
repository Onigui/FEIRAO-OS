import Link from "next/link";
import { Car } from "lucide-react";
import { FUEL_LABEL, TRANSMISSION_LABEL } from "@/features/inventory/constants";
import { formatKm, formatPriceCents, formatYears } from "@/features/inventory/format";
import type { PublicVehicleCard } from "@/features/showcase/types";

export function VehicleCard({
  vehicle: v,
  showStore = true,
}: {
  vehicle: PublicVehicleCard;
  showStore?: boolean;
}) {
  return (
    <li>
      <Link
        href={`/carro/${v.slug}`}
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
          <p className="font-display text-xl text-primary">{formatPriceCents(v.priceCents)}</p>
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
