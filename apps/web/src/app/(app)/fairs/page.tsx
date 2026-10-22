"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { listFairs, respondInvite } from "@/features/fairs/api";
import { FairCard } from "@/features/fairs/fair-card";
import type { FairSummary } from "@/features/fairs/types";
import { breadcrumbsForPath } from "@/lib/nav";
import { friendlyError } from "@/lib/errors";
import { useAuth } from "@/providers/auth-provider";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { LoadingBlock } from "@/components/feedback/loading-block";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";

function Section({ title, items, render }: {
  title: string;
  items: FairSummary[];
  render?: (f: FairSummary) => React.ReactNode;
}) {
  if (!items.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((f) => (
          <FairCard key={f.id} fair={f}>
            {render?.(f)}
          </FairCard>
        ))}
      </div>
    </section>
  );
}

export default function FairsPage() {
  const { role } = useAuth();
  const manager = role === "OWNER" || role === "ADMIN";
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["fairs"], queryFn: listFairs });
  const respond = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => respondInvite(id, accept),
    onSuccess: async (_d, v) => {
      toast.success(v.accept ? "Convite aceito" : "Convite recusado");
      await queryClient.invalidateQueries({ queryKey: ["fairs"] });
    },
    onError: (e) => toast.error(friendlyError(e, "Não foi possível responder.")),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feirões"
        description="Organize um feirão com outras lojas ou participe dos convites."
        breadcrumbs={breadcrumbsForPath("/fairs")}
        actions={
          manager ? (
            <Button asChild>
              <Link href="/fairs/new">
                <Plus className="mr-2 h-4 w-4" /> Novo feirão
              </Link>
            </Button>
          ) : null
        }
      />
      {query.isLoading ? <LoadingBlock rows={3} label="Carregando feirões…" /> : null}
      {query.isError ? <ErrorPanel title="Não foi possível carregar" onRetry={() => void query.refetch()} /> : null}
      {query.data ? (
        query.data.organizing.length + query.data.participating.length + query.data.invites.length === 0 ? (
          <EmptyState
            title="Nenhum feirão ainda"
            description={manager ? "Crie o primeiro e convide as lojas da cidade." : "Quando sua loja participar de um feirão, ele aparece aqui."}
          />
        ) : (
          <div className="space-y-8">
            <Section
              title="Convites"
              items={query.data.invites}
              render={(f) =>
                manager ? (
                  <>
                    <Button size="sm" disabled={respond.isPending} onClick={() => respond.mutate({ id: f.id, accept: true })}>
                      Aceitar
                    </Button>
                    <Button size="sm" variant="outline" disabled={respond.isPending} onClick={() => respond.mutate({ id: f.id, accept: false })}>
                      Recusar
                    </Button>
                  </>
                ) : null
              }
            />
            <Section title="Organizados pela sua loja" items={query.data.organizing} />
            <Section title="Participando" items={query.data.participating} />
          </div>
        )
      ) : null}
    </div>
  );
}
