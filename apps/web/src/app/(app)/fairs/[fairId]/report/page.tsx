"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { downloadFairReportCsv, fairReport } from "@/features/fairs/api";
import { FAIR_STATUS_LABEL, formatFairPeriod } from "@/features/fairs/constants";
import { formatPriceCents } from "@/features/inventory/format";
import { breadcrumbsForPath } from "@/lib/nav";
import { friendlyError } from "@/lib/errors";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { LoadingBlock } from "@/components/feedback/loading-block";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="bg-white/90">
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-display text-3xl">{value}</CardTitle>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardHeader>
    </Card>
  );
}

export default function FairReportPage() {
  const { fairId } = useParams<{ fairId: string }>();
  const query = useQuery({ queryKey: ["fair-report", fairId], queryFn: () => fairReport(fairId) });
  const csv = useMutation({
    mutationFn: () => downloadFairReportCsv(fairId),
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (e) => toast.error(friendlyError(e, "Não foi possível baixar.")),
  });

  if (query.isLoading) return <LoadingBlock rows={4} label="Montando relatório…" />;
  if (query.isError || !query.data) {
    return <ErrorPanel title="Não foi possível carregar o relatório" onRetry={() => void query.refetch()} />;
  }
  const r = query.data;
  const t = r.totals;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title={`Relatório — ${r.fair.name}`}
        description={`${formatFairPeriod(r.fair.startsAt, r.fair.endsAt)} · ${FAIR_STATUS_LABEL[r.fair.status]}${
          r.fair.status !== "ENDED" ? " (números parciais)" : ""
        }`}
        breadcrumbs={breadcrumbsForPath(`/fairs/${r.fair.id}/report`)}
        actions={
          <Button variant="outline" disabled={csv.isPending} onClick={() => csv.mutate()}>
            <Download className="mr-2 h-4 w-4" /> Baixar CSV
          </Button>
        }
      />

      {r.scope === "MY_STORE" ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          Você vê os números da sua loja. O total do feirão fica com a organizadora.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="report-totals">
        <Kpi label="Vendidos no feirão" value={t.soldDuringFair} hint={`${t.conversionPct}% dos ${t.vehicles} carros`} />
        <Kpi label="Valor vendido" value={formatPriceCents(t.soldValueCents)} hint="pelo preço do feirão" />
        <Kpi label="Contatos" value={t.interests} hint={`${t.whatsappClicks} cliques no WhatsApp`} />
        <Kpi label="Leituras de QR" value={t.qrScans} hint={`${t.pageViews} visitas na página do feirão`} />
      </div>

      <Card className="bg-white/90">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Por loja</CardTitle>
          <CardDescription>
            Vendido no feirão = carro marcado como vendido entre o início e o fim do evento. Contatos não
            mostram nome nem telefone: cada loja vê os seus em Leads.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm" data-testid="report-stores">
            <thead className="border-b bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Loja</th>
                <th className="px-4 py-2 font-medium">Carros</th>
                <th className="px-4 py-2 font-medium">Vendidos</th>
                <th className="px-4 py-2 font-medium">Valor</th>
                <th className="px-4 py-2 font-medium">Contatos</th>
                <th className="px-4 py-2 font-medium">QR</th>
                <th className="px-4 py-2 font-medium">WhatsApp</th>
              </tr>
            </thead>
            <tbody>
              {r.stores.map((s) => (
                <tr key={s.companyId} className="border-b last:border-0">
                  <td className="px-4 py-2 font-medium">{s.storeName}</td>
                  <td className="px-4 py-2">{s.vehicles}</td>
                  <td className="px-4 py-2">{s.soldDuringFair}</td>
                  <td className="px-4 py-2">{formatPriceCents(s.soldValueCents)}</td>
                  <td className="px-4 py-2">{s.interests}</td>
                  <td className="px-4 py-2">{s.qrScans}</td>
                  <td className="px-4 py-2">{s.whatsappClicks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Link href={`/fairs/${r.fair.id}`} className="text-sm underline">
        Voltar ao feirão
      </Link>
    </div>
  );
}
