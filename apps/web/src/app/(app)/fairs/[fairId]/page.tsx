"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BarChart3, CalendarDays, ExternalLink, MapPin, QrCode, Radio } from "lucide-react";
import { changeFairStatus, getFair, respondInvite, updateFair } from "@/features/fairs/api";
import {
  ADVANCE_CONFIRM,
  ADVANCE_LABEL,
  FAIR_STATUS_LABEL,
  FAIR_STATUS_VARIANT,
  formatFairPeriod,
} from "@/features/fairs/constants";
import { FairForm } from "@/features/fairs/fair-form";
import { FairStoresPanel } from "@/features/fairs/fair-stores-panel";
import { FairVehiclesPanel } from "@/features/fairs/fair-vehicles-panel";
import type { FairStatus } from "@/features/fairs/types";
import { breadcrumbsForPath } from "@/lib/nav";
import { friendlyError } from "@/lib/errors";
import { useAuth } from "@/providers/auth-provider";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { LoadingBlock } from "@/components/feedback/loading-block";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function FairDetailPage() {
  const { fairId } = useParams<{ fairId: string }>();
  const { role } = useAuth();
  const manager = role === "OWNER" || role === "ADMIN";
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["fair", fairId], queryFn: () => getFair(fairId) });
  const [confirm, setConfirm] = useState<FairStatus | null>(null);
  const [editing, setEditing] = useState(false);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["fairs"] });
    await queryClient.invalidateQueries({ queryKey: ["fair-vehicles", fairId] });
  };
  const status = useMutation({
    mutationFn: (to: FairStatus) => changeFairStatus(fairId, to),
    onSuccess: async (data) => {
      queryClient.setQueryData(["fair", fairId], data);
      toast.success(`Feirão ${FAIR_STATUS_LABEL[data.status].toLowerCase()}`);
      setConfirm(null);
      await invalidate();
    },
    onError: (e) => {
      setConfirm(null);
      toast.error(friendlyError(e, "Não foi possível mudar o status."));
    },
  });
  const respond = useMutation({
    mutationFn: (accept: boolean) => respondInvite(fairId, accept),
    onSuccess: async (data, accept) => {
      queryClient.setQueryData(["fair", fairId], data);
      toast.success(accept ? "Convite aceito" : "Sua loja saiu do feirão");
      await invalidate();
    },
    onError: (e) => toast.error(friendlyError(e, "Não foi possível responder.")),
  });
  const edit = useMutation({
    mutationFn: (input: Parameters<typeof updateFair>[1]) => updateFair(fairId, input),
    onSuccess: async (data) => {
      queryClient.setQueryData(["fair", fairId], data);
      toast.success("Dados do feirão salvos");
      setEditing(false);
      await invalidate();
    },
    onError: (e) => toast.error(friendlyError(e, "Não foi possível salvar.")),
  });

  if (query.isLoading) return <LoadingBlock rows={4} label="Carregando feirão…" />;
  if (query.isError || !query.data) {
    return <ErrorPanel title="Não foi possível carregar o feirão" onRetry={() => void query.refetch()} />;
  }
  const fair = query.data;
  const accepted = fair.myParticipation?.status === "ACCEPTED";
  const invited = fair.myParticipation?.status === "INVITED";
  const ended = fair.status === "ENDED";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={fair.name}
        description={fair.isOrganizer ? "Organizado pela sua loja" : `Organizado por ${fair.organizer.name}`}
        breadcrumbs={breadcrumbsForPath(`/fairs/${fair.id}`)}
        actions={
          <Badge variant={FAIR_STATUS_VARIANT[fair.status]} data-testid="fair-status">
            {FAIR_STATUS_LABEL[fair.status]}
          </Badge>
        }
      />

      <Card className="bg-white/90">
        <CardContent className="space-y-3 pt-6 text-sm">
          <p className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            {formatFairPeriod(fair.startsAt, fair.endsAt)}
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            {[fair.venue, fair.address].filter(Boolean).join(" · ")}
          </p>
          {fair.description ? <p className="whitespace-pre-line text-muted-foreground">{fair.description}</p> : null}
          <p className="text-muted-foreground">
            {fair.counts.acceptedStores} lojas · {fair.counts.vehicles} carros · {fair.counts.myVehicles} da sua loja
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {fair.status !== "DRAFT" ? (
              <Button asChild size="sm" variant="outline">
                <a href={`/feirao/${fair.slug}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 h-4 w-4" /> Página pública
                </a>
              </Button>
            ) : null}
            {accepted || fair.isOrganizer ? (
              <>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/fairs/${fair.id}/qr`}>
                    <QrCode className="mr-1.5 h-4 w-4" /> Imprimir QR
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/fairs/${fair.id}/live`}>
                    <Radio className="mr-1.5 h-4 w-4" /> Modo evento
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/fairs/${fair.id}/report`}>
                    <BarChart3 className="mr-1.5 h-4 w-4" /> Relatório
                  </Link>
                </Button>
              </>
            ) : null}
            {fair.isOrganizer && manager && !ended ? (
              <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
                {editing ? "Fechar edição" : "Editar dados"}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {editing ? (
        <Card className="bg-white/90">
          <CardContent className="pt-6">
            <FairForm
              initial={fair}
              submitLabel="Salvar"
              pending={edit.isPending}
              onSubmit={(i) => edit.mutate(i)}
            />
          </CardContent>
        </Card>
      ) : null}

      {fair.isOrganizer && manager && fair.nextStatus ? (
        <Card className="bg-white/90">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Próximo passo</CardTitle>
            <CardDescription>{ADVANCE_CONFIRM[fair.nextStatus]}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setConfirm(fair.nextStatus)} disabled={status.isPending}>
              {ADVANCE_LABEL[fair.nextStatus]}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {invited && manager ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Convite de {fair.organizer.name}</CardTitle>
            <CardDescription>
              Ao aceitar, você escolhe quais carros da sua loja entram no feirão. Os contatos dos seus
              carros continuam só seus.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button disabled={respond.isPending} onClick={() => respond.mutate(true)}>
              Aceitar convite
            </Button>
            <Button variant="outline" disabled={respond.isPending} onClick={() => respond.mutate(false)}>
              Recusar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {accepted ? <FairVehiclesPanel fairId={fair.id} canEdit={manager} /> : null}

      {fair.isOrganizer ? <FairStoresPanel fair={fair} canEdit={manager} /> : null}

      {accepted && !fair.isOrganizer && manager && !ended ? (
        <div className="text-right">
          <Button
            variant="ghost"
            className="text-destructive"
            disabled={respond.isPending}
            onClick={() => respond.mutate(false)}
          >
            Sair do feirão (retira os carros da loja)
          </Button>
        </div>
      ) : null}

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{confirm ? ADVANCE_LABEL[confirm] : ""}?</DialogTitle>
            <DialogDescription>{confirm ? ADVANCE_CONFIRM[confirm] : ""}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
            <Button disabled={status.isPending} onClick={() => confirm && status.mutate(confirm)}>
              {status.isPending ? "Salvando…" : "Confirmar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
