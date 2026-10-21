"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Car, FileSpreadsheet, Plus } from "lucide-react";
import { listVehicles } from "@/features/inventory/api";
import {
  VEHICLE_STATUSES,
  VEHICLE_STATUS_LABEL,
} from "@/features/inventory/constants";
import {
  formatKm,
  formatPriceCents,
  formatYears,
} from "@/features/inventory/format";
import { StatusActions } from "@/features/inventory/status-actions";
import type { VehicleStatus } from "@/features/inventory/types";
import { VehicleStatusBadge } from "@/features/inventory/vehicle-status-badge";
import { breadcrumbsForPath } from "@/lib/nav";
import { useAuth } from "@/providers/auth-provider";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { LoadingBlock } from "@/components/feedback/loading-block";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StatusFilter = VehicleStatus | "ACTIVE" | "ALL";

export default function InventoryPage() {
  const { role } = useAuth();
  const manager = role === "OWNER" || role === "ADMIN";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ACTIVE");
  const [page, setPage] = useState(1);

  const params = useMemo(
    () => ({
      page,
      limit: 24,
      search: search.trim() || undefined,
      status: status === "ACTIVE" || status === "ALL" ? undefined : status,
      includeArchived: status === "ALL",
    }),
    [page, search, status],
  );

  const query = useQuery({
    queryKey: ["vehicles", params],
    queryFn: () => listVehicles(params),
  });

  const actions = (
    <div className="flex flex-wrap gap-2">
      {manager ? (
        <Button asChild variant="outline">
          <Link href="/inventory/import">
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Importar planilha
          </Link>
        </Button>
      ) : null}
      <Button asChild>
        <Link href="/inventory/new">
          <Plus className="mr-2 h-4 w-4" />
          Cadastrar carro
        </Link>
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque"
        description="Seus carros, com status e fotos. Vendido sai da vitrine na hora."
        breadcrumbs={breadcrumbsForPath("/inventory")}
        actions={actions}
      />

      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <Input
          placeholder="Buscar marca, modelo ou versão"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setPage(1);
            setStatus(v as StatusFilter);
          }}
        >
          <SelectTrigger aria-label="Filtrar por status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ACTIVE">Todos menos arquivados</SelectItem>
            {VEHICLE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {VEHICLE_STATUS_LABEL[s]}
              </SelectItem>
            ))}
            <SelectItem value="ALL">Todos, inclusive arquivados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {query.isLoading ? (
        <LoadingBlock rows={4} label="Carregando estoque…" />
      ) : query.isError ? (
        <ErrorPanel
          title="Não foi possível carregar o estoque"
          onRetry={() => void query.refetch()}
        />
      ) : !query.data?.data.length ? (
        <EmptyState
          icon={<Car className="h-8 w-8" />}
          title={search || status !== "ACTIVE" ? "Nenhum carro encontrado" : "Seu estoque está vazio"}
          description={
            search || status !== "ACTIVE"
              ? "Ajuste a busca ou o filtro."
              : "Cadastre o primeiro carro ou importe sua planilha de estoque."
          }
          action={actions}
        />
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="vehicle-list">
            {query.data.data.map((v) => (
              <li key={v.id}>
                <Card className="overflow-hidden bg-white/90">
                  <Link href={`/inventory/${v.id}`} className="block">
                    <div className="relative aspect-[4/3] bg-muted">
                      {v.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={v.coverUrl}
                          alt={`${v.make} ${v.model}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          <Car className="h-10 w-10" />
                        </div>
                      )}
                      <div className="absolute left-2 top-2">
                        <VehicleStatusBadge status={v.status} />
                      </div>
                    </div>
                  </Link>
                  <CardContent className="space-y-3 p-4">
                    <Link href={`/inventory/${v.id}`} className="block">
                      <p className="font-medium leading-tight">
                        {v.make} {v.model}
                        {v.version ? (
                          <span className="font-normal text-muted-foreground"> {v.version}</span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-lg font-semibold">{formatPriceCents(v.priceCents)}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatYears(v.yearManufacture, v.yearModel)} · {formatKm(v.mileageKm)}
                      </p>
                    </Link>
                    <StatusActions vehicle={v} role={role} />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Página {query.data.meta.page} de {query.data.meta.totalPages || 1} ·{" "}
              {query.data.meta.total} carros
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= (query.data.meta.totalPages || 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
