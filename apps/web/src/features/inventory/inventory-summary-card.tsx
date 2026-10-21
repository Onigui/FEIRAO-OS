"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Car } from "lucide-react";
import { listVehicles } from "@/features/inventory/api";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Card do painel: carros disponíveis (contagem real pela API de estoque). */
export function InventorySummaryCard() {
  const query = useQuery({
    queryKey: ["inventory-summary"],
    queryFn: () => listVehicles({ status: "AVAILABLE", limit: 1 }),
  });
  const value = query.isLoading ? "…" : query.isError ? "—" : (query.data?.meta.total ?? 0);

  return (
    <Link href="/inventory" className="block" data-testid="inventory-summary">
      <Card className="h-full bg-white/90 transition-colors hover:bg-accent/40">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-1.5">
            <Car className="h-4 w-4" /> Carros disponíveis
          </CardDescription>
          <CardTitle className="font-display text-3xl">{value}</CardTitle>
        </CardHeader>
      </Card>
    </Link>
  );
}
