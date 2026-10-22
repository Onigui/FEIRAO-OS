"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Car, Trash2 } from "lucide-react";
import {
  addFairVehicles,
  myFairVehicles,
  removeFairVehicle,
  updateFairVehiclePrice,
} from "@/features/fairs/api";
import type { FairVehicleItem, MyFairVehicles } from "@/features/fairs/types";
import { VEHICLE_STATUS_LABEL } from "@/features/inventory/constants";
import {
  centsToReaisInput,
  formatKm,
  formatPriceCents,
  formatYears,
  parseReaisToCents,
} from "@/features/inventory/format";
import { friendlyError } from "@/lib/errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function PriceEditor({
  item,
  disabled,
  onSave,
}: {
  item: FairVehicleItem;
  disabled: boolean;
  onSave: (cents: number) => void;
}) {
  const [value, setValue] = useState(centsToReaisInput(item.priceCentsAtFair));
  const save = () => {
    const cents = parseReaisToCents(value);
    if (cents === null || cents < 100) {
      toast.error("Preço inválido");
      setValue(centsToReaisInput(item.priceCentsAtFair));
      return;
    }
    if (cents !== item.priceCentsAtFair) onSave(cents);
  };
  return (
    <label className="flex items-center gap-1 text-sm">
      <span className="text-muted-foreground">R$</span>
      <Input
        aria-label={`Preço no feirão de ${item.vehicle.make} ${item.vehicle.model}`}
        className="h-9 w-28"
        inputMode="decimal"
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
        }}
      />
    </label>
  );
}

/** Meus carros no feirão: escolher do estoque, preço do evento e retirar. */
export function FairVehiclesPanel({
  fairId,
  canEdit,
}: {
  fairId: string;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const key = ["fair-vehicles", fairId];
  const query = useQuery({ queryKey: key, queryFn: () => myFairVehicles(fairId) });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");

  const onData = async (data: MyFairVehicles) => {
    queryClient.setQueryData(key, data);
    await queryClient.invalidateQueries({ queryKey: ["fair", fairId] });
  };
  const add = useMutation({
    mutationFn: () => addFairVehicles(fairId, [...picked]),
    onSuccess: async (data) => {
      toast.success(`${data.added} ${data.added === 1 ? "carro inscrito" : "carros inscritos"}`);
      setPicked(new Set());
      await onData(data);
    },
    onError: (e) => toast.error(friendlyError(e, "Não foi possível inscrever.")),
  });
  const price = useMutation({
    mutationFn: ({ id, cents }: { id: string; cents: number }) =>
      updateFairVehiclePrice(fairId, id, cents),
    onSuccess: async (data) => {
      toast.success("Preço do feirão salvo");
      await onData(data);
    },
    onError: (e) => toast.error(friendlyError(e, "Não foi possível salvar o preço.")),
  });
  const remove = useMutation({
    mutationFn: (id: string) => removeFairVehicle(fairId, id),
    onSuccess: async (data) => {
      toast.success("Carro retirado do feirão");
      await onData(data);
    },
    onError: (e) => toast.error(friendlyError(e, "Não foi possível retirar.")),
  });

  const candidates = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = query.data?.candidates ?? [];
    return q
      ? list.filter((c) => `${c.make} ${c.model} ${c.version ?? ""}`.toLowerCase().includes(q))
      : list;
  }, [query.data, filter]);

  if (query.isLoading) return null;
  const data = query.data;
  if (!data) return null;
  const editable = canEdit && !data.frozen;

  return (
    <Card className="bg-white/90" data-testid="fair-my-vehicles">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Meus carros no feirão ({data.vehicles.length})</CardTitle>
        <CardDescription>
          {data.frozen
            ? "Feirão encerrado: a lista está congelada."
            : "Cada carro ganha um QR próprio. O preço do feirão pode ser diferente do da vitrine."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {data.vehicles.length ? (
          <ul className="divide-y rounded-lg border" data-testid="fair-vehicle-list">
            {data.vehicles.map((item) => (
              <li key={item.fairVehicleId} className="flex flex-wrap items-center gap-3 p-3">
                <div className="h-12 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                  {item.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <Car className="h-5 w-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {item.vehicle.make} {item.vehicle.model} {item.vehicle.version ?? ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatYears(item.vehicle.yearManufacture, item.vehicle.yearModel)} ·{" "}
                    {formatKm(item.vehicle.mileageKm)} · vitrine {formatPriceCents(item.vehicle.priceCents)} · QR{" "}
                    {item.qrCode}
                  </p>
                </div>
                {item.vehicle.status !== "AVAILABLE" ? (
                  <Badge variant={item.vehicle.status === "SOLD" ? "success" : "warning"}>
                    {VEHICLE_STATUS_LABEL[item.vehicle.status]}
                  </Badge>
                ) : null}
                <PriceEditor
                  key={item.priceCentsAtFair}
                  item={item}
                  disabled={!editable || price.isPending}
                  onSave={(cents) => price.mutate({ id: item.fairVehicleId, cents })}
                />
                {editable ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Retirar ${item.vehicle.model} do feirão`}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(item.fairVehicleId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum carro inscrito ainda.</p>
        )}

        {editable ? (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3" data-testid="fair-candidates">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Adicionar do estoque (disponíveis e reservados)</p>
              <Input
                className="h-9 w-56"
                placeholder="Filtrar modelo"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            {candidates.length ? (
              <>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    className="text-primary underline"
                    onClick={() => setPicked(new Set(candidates.map((c) => c.id)))}
                  >
                    Marcar todos ({candidates.length})
                  </button>
                  {picked.size ? (
                    <button type="button" className="underline" onClick={() => setPicked(new Set())}>
                      Limpar
                    </button>
                  ) : null}
                </div>
                <ul className="max-h-72 space-y-1 overflow-auto">
                  {candidates.map((c) => (
                    <li key={c.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-white">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={picked.has(c.id)}
                          onChange={(e) => {
                            const next = new Set(picked);
                            if (e.target.checked) next.add(c.id);
                            else next.delete(c.id);
                            setPicked(next);
                          }}
                        />
                        <span className="flex-1">
                          {c.make} {c.model} {c.version ?? ""} · {formatYears(c.yearManufacture, c.yearModel)}
                        </span>
                        <span className="text-muted-foreground">{formatPriceCents(c.priceCents)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                <Button disabled={!picked.size || add.isPending} onClick={() => add.mutate()}>
                  {add.isPending
                    ? "Inscrevendo…"
                    : `Inscrever ${picked.size} ${picked.size === 1 ? "carro" : "carros"}`}
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum carro disponível para inscrever.
              </p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
