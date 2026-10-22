"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Car } from "lucide-react";
import { fairLive } from "@/features/fairs/api";
import { FAIR_STATUS_LABEL } from "@/features/fairs/constants";
import type { FairVehicleItem } from "@/features/fairs/types";
import { changeVehicleStatus } from "@/features/inventory/api";
import { formatPriceCents, formatYears } from "@/features/inventory/format";
import { friendlyError } from "@/lib/errors";
import { useAuth } from "@/providers/auth-provider";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { LoadingBlock } from "@/components/feedback/loading-block";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

function Counter({ label, value, testId }: { label: string; value: number; testId?: string }) {
  return (
    <div className="rounded-xl border bg-white p-3 text-center" data-testid={testId}>
      <p className="font-display text-3xl">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** Modo evento: lista grande, um toque para marcar vendido, contadores atualizando. */
export default function FairLivePage() {
  const { fairId } = useParams<{ fairId: string }>();
  const { role } = useAuth();
  const manager = role === "OWNER" || role === "ADMIN";
  const queryClient = useQueryClient();
  const key = ["fair-live", fairId];
  const query = useQuery({
    queryKey: key,
    queryFn: () => fairLive(fairId),
    refetchInterval: 15_000,
  });
  const [pending, setPending] = useState<{ item: FairVehicleItem; to: "SOLD" | "AVAILABLE" } | null>(null);
  const [filter, setFilter] = useState("");

  const mutation = useMutation({
    mutationFn: ({ item, to }: { item: FairVehicleItem; to: "SOLD" | "AVAILABLE" }) =>
      changeVehicleStatus(item.vehicle.id, to),
    onSuccess: async (_v, { to }) => {
      toast.success(to === "SOLD" ? "Vendido!" : "Venda desfeita");
      setPending(null);
      await queryClient.invalidateQueries({ queryKey: key });
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
    onError: (e) => {
      setPending(null);
      toast.error(friendlyError(e, "Não foi possível mudar o status."));
    },
  });

  const items = useMemo(() => {
    const list = query.data?.vehicles ?? [];
    const q = filter.trim().toLowerCase();
    const filtered = q
      ? list.filter((i) =>
          `${i.vehicle.make} ${i.vehicle.model} ${i.vehicle.version ?? ""} ${i.qrCode}`.toLowerCase().includes(q),
        )
      : list;
    const rank = (s: string) => (s === "AVAILABLE" ? 0 : s === "RESERVED" ? 1 : 2);
    return [...filtered].sort((a, b) => rank(a.vehicle.status) - rank(b.vehicle.status));
  }, [query.data, filter]);

  if (query.isLoading) return <LoadingBlock rows={4} label="Carregando modo evento…" />;
  if (query.isError || !query.data) {
    return <ErrorPanel title="Não foi possível carregar" onRetry={() => void query.refetch()} />;
  }
  const { fair, counters } = query.data;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl">{fair.name}</h1>
          <p className="text-sm text-muted-foreground">
            {FAIR_STATUS_LABEL[fair.status]} ·{" "}
            <Link href={`/fairs/${fair.id}`} className="underline">
              voltar ao feirão
            </Link>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Counter label="Vendidos no feirão" value={counters.fairSold} testId="counter-fair-sold" />
        <Counter label="Carros no feirão" value={counters.fairVehicles} />
        <Counter label="Seus vendidos" value={counters.mySold} testId="counter-my-sold" />
        <Counter label="Seus carros" value={counters.myVehicles} />
      </div>

      <Input
        placeholder="Achar carro (modelo ou código do QR)"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="h-12 text-base"
      />

      {items.length === 0 ? (
        <p className="rounded-xl border bg-white p-6 text-center text-muted-foreground">
          Nenhum carro da sua loja neste feirão.
        </p>
      ) : (
        <ul className="space-y-2" data-testid="live-list">
          {items.map((item) => {
            const v = item.vehicle;
            const sold = v.status === "SOLD";
            const canUndo =
              sold && manager && v.soldAt && Date.now() - new Date(v.soldAt).getTime() <= UNDO_WINDOW_MS;
            return (
              <li
                key={item.fairVehicleId}
                className={`flex items-center gap-3 rounded-xl border p-3 ${sold ? "bg-emerald-50" : "bg-white"}`}
              >
                <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {item.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <Car className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold">
                    {v.model} {v.version ?? ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {v.make} · {formatYears(v.yearManufacture, v.yearModel)} · {formatPriceCents(item.priceCentsAtFair)}
                  </p>
                  <p className="text-xs text-muted-foreground">QR {item.qrCode}</p>
                </div>
                {sold ? (
                  <div className="flex flex-col items-end gap-1">
                    <span className="rounded-full bg-emerald-600 px-3 py-1 text-sm font-semibold text-white">
                      Vendido
                    </span>
                    {canUndo ? (
                      <button
                        type="button"
                        className="text-xs underline"
                        onClick={() => setPending({ item, to: "AVAILABLE" })}
                      >
                        Desfazer
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <Button
                    className="h-12 min-w-24 text-base"
                    onClick={() => setPending({ item, to: "SOLD" })}
                    disabled={mutation.isPending}
                  >
                    Vendido
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{pending?.to === "SOLD" ? "Marcar como vendido?" : "Desfazer a venda?"}</DialogTitle>
            <DialogDescription>
              {pending ? `${pending.item.vehicle.make} ${pending.item.vehicle.model} ${pending.item.vehicle.yearModel}` : ""}
              {pending?.to === "SOLD" ? " — sai da vitrine na hora e aparece como vendido no feirão." : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-12" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button
              className="h-12"
              disabled={mutation.isPending}
              onClick={() => pending && mutation.mutate(pending)}
            >
              {mutation.isPending ? "Salvando…" : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
