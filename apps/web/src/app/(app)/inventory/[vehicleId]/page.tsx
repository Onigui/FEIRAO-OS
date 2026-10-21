"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  deleteVehicle,
  getStatusHistory,
  getVehicle,
  updateVehicle,
} from "@/features/inventory/api";
import { VEHICLE_STATUS_LABEL } from "@/features/inventory/constants";
import { formatPriceCents } from "@/features/inventory/format";
import { PhotoManager } from "@/features/inventory/photo-manager";
import { StatusActions } from "@/features/inventory/status-actions";
import { VehicleForm } from "@/features/inventory/vehicle-form";
import { VehicleStatusBadge } from "@/features/inventory/vehicle-status-badge";
import { breadcrumbsForPath } from "@/lib/nav";
import { friendlyError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { LoadingBlock } from "@/components/feedback/loading-block";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function VehicleDetailPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const router = useRouter();
  const { role } = useAuth();
  const manager = role === "OWNER" || role === "ADMIN";
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const vehicle = useQuery({
    queryKey: ["vehicle", vehicleId],
    queryFn: () => getVehicle(vehicleId),
  });
  const history = useQuery({
    queryKey: ["vehicle-history", vehicleId],
    queryFn: () => getStatusHistory(vehicleId),
  });

  const save = useMutation({
    mutationFn: (input: Parameters<typeof updateVehicle>[1]) => updateVehicle(vehicleId, input),
    onSuccess: async (v) => {
      toast.success("Dados salvos");
      queryClient.setQueryData(["vehicle", v.id], v);
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    },
    onError: (error) => toast.error(friendlyError(error, "Não foi possível salvar.")),
  });

  const remove = useMutation({
    mutationFn: () => deleteVehicle(vehicleId),
    onSuccess: async () => {
      toast.success("Carro excluído");
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      await queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
      router.push("/inventory");
    },
    onError: (error) => toast.error(friendlyError(error, "Não foi possível excluir.")),
  });

  if (vehicle.isLoading) return <LoadingBlock rows={4} label="Carregando carro…" />;
  if (vehicle.isError || !vehicle.data) {
    return (
      <ErrorPanel title="Não foi possível carregar o carro" onRetry={() => void vehicle.refetch()} />
    );
  }
  const v = vehicle.data;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={`${v.make} ${v.model}`}
        description={`${v.version ? `${v.version} · ` : ""}${formatPriceCents(v.priceCents)} · código ${v.showcaseCode}`}
        breadcrumbs={breadcrumbsForPath(`/inventory/${v.id}`)}
        actions={<VehicleStatusBadge status={v.status} />}
      />

      <Card className="bg-white/90">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Status</CardTitle>
          <CardDescription>
            {v.status === "SOLD" && v.soldAt
              ? `Vendido em ${formatDateTime(v.soldAt)}.`
              : "Atualize na hora: vendido sai da vitrine imediatamente."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StatusActions vehicle={v} role={role} size="default" includeArchive={manager} />
        </CardContent>
      </Card>

      <Card className="bg-white/90">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Fotos</CardTitle>
          <CardDescription>
            As fotos são reduzidas no próprio celular antes do envio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PhotoManager vehicle={v} />
        </CardContent>
      </Card>

      <Card className="bg-white/90">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Dados do carro</CardTitle>
        </CardHeader>
        <CardContent>
          <VehicleForm
            key={v.updatedAt}
            vehicle={v}
            submitLabel="Salvar alterações"
            pending={save.isPending}
            onSubmit={(input) => save.mutate(input)}
          />
        </CardContent>
      </Card>

      <Card className="bg-white/90">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Histórico de status</CardTitle>
        </CardHeader>
        <CardContent>
          {history.data?.length ? (
            <ul className="space-y-2 text-sm" data-testid="status-history">
              {history.data.map((h) => (
                <li key={h.id} className="flex flex-wrap justify-between gap-2 border-b pb-2 last:border-0">
                  <span>
                    {VEHICLE_STATUS_LABEL[h.fromStatus]} → {VEHICLE_STATUS_LABEL[h.toStatus]}
                  </span>
                  <span className="text-muted-foreground">{formatDateTime(h.occurredAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sem mudanças de status ainda.</p>
          )}
        </CardContent>
      </Card>

      {manager ? (
        <div className="flex justify-end">
          <Button variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir carro
          </Button>
        </div>
      ) : null}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir este carro?</DialogTitle>
            <DialogDescription>
              Ele sai do estoque e da vitrine. Use “Arquivar” se quiser só tirar da lista.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate()}
            >
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
