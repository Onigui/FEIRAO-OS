"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Car, ShieldOff } from "lucide-react";
import { VEHICLE_STATUS_LABEL } from "@/features/inventory/constants";
import { formatPriceCents } from "@/features/inventory/format";
import { getLeadInterests } from "@/features/showcase/api";
import { INTEREST_SOURCE_LABEL, LEAD_SOURCE_LABEL } from "@/features/showcase/constants";
import type { LeadInterest } from "@/features/showcase/types";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Interesses de vários leads de uma vez (lista de leads). */
export function useLeadInterests(leadIds: string[]) {
  return useQuery({
    queryKey: ["lead-interests", leadIds],
    queryFn: () => getLeadInterests(leadIds),
    enabled: leadIds.length > 0,
    staleTime: 30_000,
  });
}

/** Origem do lead no card/tabela: "Vitrine · Gol 2021" quando veio da vitrine. */
export function LeadOrigin({
  source,
  interest,
}: {
  source: string | null | undefined;
  interest?: LeadInterest;
}) {
  const label = source ? (LEAD_SOURCE_LABEL[source] ?? source) : "—";
  if (!interest?.vehicle) return <span>{label}</span>;
  const v = interest.vehicle;
  return (
    <span className="inline-flex flex-wrap items-center gap-1" data-testid="lead-origin">
      <span>{INTEREST_SOURCE_LABEL[interest.source] ? "Vitrine" : label}</span>
      <span aria-hidden>·</span>
      <span className="font-medium text-foreground">
        {v.make} {v.model} {v.yearModel}
      </span>
    </span>
  );
}

/** Card no detalhe do lead: carros de interesse, origem e autorizações. */
export function LeadVehicleInterestsCard({ leadId }: { leadId: string }) {
  const query = useLeadInterests([leadId]);
  const items = query.data?.[leadId] ?? [];
  if (!query.isLoading && items.length === 0) return null;

  return (
    <Card className="bg-white/90" data-testid="lead-vehicle-interests">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Carros de interesse</CardTitle>
        <CardDescription>Pedidos de contato feitos pela vitrine.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {query.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : null}
        {items[0]?.automationBlocked ? (
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <ShieldOff className="mt-0.5 h-4 w-4 shrink-0" />
            Sem autorização de ofertas: fora de campanhas, first-touch e recuperação automática.
            Responder a este contato continua liberado.
          </p>
        ) : null}
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.id} className="flex gap-3 rounded-lg border p-2">
              <div className="h-14 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                {i.vehicle?.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.vehicle.coverUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <Car className="h-5 w-5" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 text-sm">
                {i.vehicle ? (
                  <Link href={`/inventory/${i.vehicle.id}`} className="font-medium text-primary hover:underline">
                    {i.vehicle.make} {i.vehicle.model} {i.vehicle.yearModel}
                  </Link>
                ) : (
                  <span className="font-medium">Carro removido</span>
                )}
                <p className="text-muted-foreground">
                  {i.vehicle ? `${formatPriceCents(i.vehicle.priceCents)} · ${VEHICLE_STATUS_LABEL[i.vehicle.status]} · ` : ""}
                  {INTEREST_SOURCE_LABEL[i.source] ?? i.source}
                </p>
                <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                  {formatDateTime(i.createdAt)}
                  {i.marketingConsent ? <Badge variant="success">Aceita ofertas</Badge> : null}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
