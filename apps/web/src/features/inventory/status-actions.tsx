"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { changeVehicleStatus } from "@/features/inventory/api";
import { VEHICLE_STATUS_LABEL } from "@/features/inventory/constants";
import type { Vehicle, VehicleStatus } from "@/features/inventory/types";
import type { MembershipRole } from "@/lib/api/types";
import { friendlyError } from "@/lib/errors";

const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

type Action = { to: VehicleStatus; label: string; variant?: "default" | "outline" };

/** Ações permitidas a partir do status atual (espelha as regras da API). */
export function statusActions(
  vehicle: Pick<Vehicle, "status" | "soldAt">,
  role: MembershipRole | null,
): Action[] {
  const manager = role === "OWNER" || role === "ADMIN";
  switch (vehicle.status) {
    case "AVAILABLE":
      return [
        { to: "SOLD", label: "Vendido" },
        { to: "RESERVED", label: "Reservar", variant: "outline" },
      ];
    case "RESERVED":
      return [
        { to: "SOLD", label: "Vendido" },
        { to: "AVAILABLE", label: "Liberar reserva", variant: "outline" },
      ];
    case "SOLD": {
      const recent =
        vehicle.soldAt && Date.now() - new Date(vehicle.soldAt).getTime() <= UNDO_WINDOW_MS;
      return manager && recent
        ? [{ to: "AVAILABLE", label: "Desfazer venda", variant: "outline" }]
        : [];
    }
    case "ARCHIVED":
      return manager ? [{ to: "AVAILABLE", label: "Desarquivar", variant: "outline" }] : [];
    default:
      return [];
  }
}

const CONFIRM_TEXT: Partial<Record<VehicleStatus, string>> = {
  SOLD: "O carro sai da vitrine na hora.",
  ARCHIVED: "O carro sai da lista e da vitrine. Dá para desarquivar depois.",
};

/** Botões de status com confirmação curta (1 toque + confirmar). */
export function StatusActions({
  vehicle,
  role,
  size = "sm",
  includeArchive = false,
}: {
  vehicle: Vehicle;
  role: MembershipRole | null;
  size?: "sm" | "default";
  includeArchive?: boolean;
}) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<VehicleStatus | null>(null);

  const mutation = useMutation({
    mutationFn: (to: VehicleStatus) => changeVehicleStatus(vehicle.id, to),
    onSuccess: async (v) => {
      toast.success(`Status: ${VEHICLE_STATUS_LABEL[v.status]}`);
      queryClient.setQueryData(["vehicle", v.id], v);
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      await queryClient.invalidateQueries({ queryKey: ["vehicle-history", v.id] });
      await queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
    },
    onError: (error) => toast.error(friendlyError(error, "Não foi possível mudar o status.")),
    onSettled: () => setPending(null),
  });

  const actions = statusActions(vehicle, role);
  if (includeArchive && vehicle.status !== "ARCHIVED") {
    actions.push({ to: "ARCHIVED", label: "Arquivar", variant: "outline" });
  }
  if (actions.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button
            key={a.to}
            type="button"
            size={size}
            variant={a.variant ?? "default"}
            disabled={mutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setPending(a.to);
            }}
          >
            {a.label}
          </Button>
        ))}
      </div>
      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {pending ? `Marcar como ${VEHICLE_STATUS_LABEL[pending].toLowerCase()}?` : ""}
            </DialogTitle>
            <DialogDescription>
              {vehicle.make} {vehicle.model} {vehicle.yearModel}
              {pending && CONFIRM_TEXT[pending] ? ` — ${CONFIRM_TEXT[pending]}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button
              disabled={mutation.isPending}
              onClick={() => pending && mutation.mutate(pending)}
            >
              {mutation.isPending ? "Salvando…" : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
