"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MessageSquareHeart } from "lucide-react";
import { getShowcaseStats } from "@/features/showcase/api";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Card do painel: contatos da vitrine nos últimos 7 dias. */
export function ShowcaseContactsCard() {
  const query = useQuery({ queryKey: ["showcase-stats"], queryFn: getShowcaseStats });
  const s = query.data;
  const value = query.isLoading ? "…" : query.isError || !s ? "—" : s.contactsWeek;

  return (
    <Link href="/leads" className="block" data-testid="showcase-contacts">
      <Card className="h-full bg-white/90 transition-colors hover:bg-accent/40">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5">
            <MessageSquareHeart className="h-4 w-4" /> Contatos da vitrine (7 dias)
          </CardDescription>
          <CardTitle className="font-display text-3xl">{value}</CardTitle>
          {s ? (
            <p className="text-xs text-muted-foreground">
              {s.whatsappClicksWeek} cliques no WhatsApp · {s.pageViewsWeek} visitas
            </p>
          ) : null}
        </CardHeader>
      </Card>
    </Link>
  );
}
