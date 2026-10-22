"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { inviteStores, removeInvite, searchStores } from "@/features/fairs/api";
import { PARTICIPANT_STATUS_LABEL } from "@/features/fairs/constants";
import type { FairDetail } from "@/features/fairs/types";
import { friendlyError } from "@/lib/errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/** Organizador: lojas do feirão e convites. */
export function FairStoresPanel({ fair, canEdit }: { fair: FairDetail; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const frozen = fair.status === "ENDED";
  const search = useQuery({
    queryKey: ["fair-stores", q],
    queryFn: () => searchStores(q.trim()),
    enabled: canEdit && !frozen,
  });
  const setFair = (data: FairDetail) => queryClient.setQueryData(["fair", fair.id], data);
  const invite = useMutation({
    mutationFn: (companyId: string) => inviteStores(fair.id, [companyId]),
    onSuccess: (res) => {
      toast.success(res.invited ? "Convite enviado" : "A loja já estava convidada");
      setFair(res.fair);
    },
    onError: (e) => toast.error(friendlyError(e, "Não foi possível convidar.")),
  });
  const remove = useMutation({
    mutationFn: (companyId: string) => removeInvite(fair.id, companyId),
    onSuccess: (data) => {
      toast.success("Convite retirado");
      setFair(data);
    },
    onError: (e) => toast.error(friendlyError(e, "Não foi possível retirar.")),
  });

  const already = new Set(fair.participants.map((p) => p.companyId));
  const options = (search.data ?? []).filter((s) => !already.has(s.id));

  return (
    <Card className="bg-white/90" data-testid="fair-stores">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Lojas ({fair.counts.acceptedStores} confirmadas)</CardTitle>
        <CardDescription>
          A loja convidada vê o convite em Feirões e aceita. Para aceitar, ela precisa da vitrine ativa.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y rounded-lg border">
          {fair.participants.map((p) => (
            <li key={p.companyId} className="flex flex-wrap items-center gap-2 p-3 text-sm">
              <span className="flex-1 font-medium">
                {p.name}
                {p.isOrganizer ? <span className="ml-1 text-xs text-muted-foreground">(organizadora)</span> : null}
              </span>
              <span className="text-muted-foreground">{p.vehicles} carros</span>
              <Badge
                variant={p.status === "ACCEPTED" ? "success" : p.status === "DECLINED" ? "muted" : "warning"}
              >
                {PARTICIPANT_STATUS_LABEL[p.status]}
              </Badge>
              {canEdit && !frozen && !p.isOrganizer && p.status !== "ACCEPTED" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(p.companyId)}
                >
                  Retirar
                </Button>
              ) : null}
            </li>
          ))}
        </ul>

        {canEdit && !frozen ? (
          <div className="space-y-2">
            <Input
              placeholder="Buscar loja por nome ou cidade"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Buscar loja para convidar"
            />
            {options.length ? (
              <ul className="max-h-64 space-y-1 overflow-auto" data-testid="store-options">
                {options.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                    <span className="flex-1">
                      {s.name}
                      {s.city ? <span className="text-muted-foreground"> · {s.city}</span> : null}
                      {!s.showcaseEnabled ? (
                        <span className="ml-1 text-xs text-amber-700">(vitrine desativada)</span>
                      ) : null}
                    </span>
                    <Button size="sm" variant="outline" disabled={invite.isPending} onClick={() => invite.mutate(s.id)}>
                      Convidar
                    </Button>
                  </li>
                ))}
              </ul>
            ) : search.isFetched ? (
              <p className="text-sm text-muted-foreground">Nenhuma outra loja encontrada.</p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
