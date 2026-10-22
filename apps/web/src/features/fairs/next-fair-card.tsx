"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Tent } from "lucide-react";
import { listFairs } from "@/features/fairs/api";
import { formatFairPeriod } from "@/features/fairs/constants";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Card do painel: próximo feirão da loja (organizando ou participando). */
export function NextFairCard() {
  const query = useQuery({ queryKey: ["fairs"], queryFn: listFairs });
  const next = query.data?.next ?? null;
  const invites = query.data?.invites.length ?? 0;
  return (
    <Link href={next ? `/fairs/${next.id}` : "/fairs"} className="block" data-testid="next-fair-card">
      <Card className="h-full bg-white/90 transition-colors hover:bg-accent/40">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5">
            <Tent className="h-4 w-4" /> Próximo feirão
          </CardDescription>
          <CardTitle className="text-lg leading-tight">
            {query.isLoading ? "…" : next ? next.name : "Nenhum marcado"}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {next ? formatFairPeriod(next.startsAt, next.endsAt) : ""}
            {invites ? `${next ? " · " : ""}${invites} ${invites === 1 ? "convite" : "convites"} para responder` : ""}
          </p>
        </CardHeader>
      </Card>
    </Link>
  );
}
