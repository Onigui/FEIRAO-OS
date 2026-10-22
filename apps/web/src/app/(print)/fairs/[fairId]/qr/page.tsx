"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Printer } from "lucide-react";
import { fairQr } from "@/features/fairs/api";
import type { QrCard } from "@/features/fairs/types";
import { formatKm, formatPriceCents, formatYears } from "@/features/inventory/format";
import { useAuth } from "@/providers/auth-provider";
import { ErrorPanel } from "@/components/feedback/error-panel";
import { LoadingBlock } from "@/components/feedback/loading-block";
import { Button } from "@/components/ui/button";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

function qrUrl(code: string) {
  const origin = APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
  return `${origin}/q/${code}`;
}

function Card({ card }: { card: QrCard }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void QRCode.toString(qrUrl(card.qrCode), { type: "svg", margin: 1, errorCorrectionLevel: "M" }).then(
      (s) => alive && setSvg(s),
    );
    return () => {
      alive = false;
    };
  }, [card.qrCode]);

  return (
    <article
      className="flex break-inside-avoid flex-col items-center gap-2 rounded-2xl border-2 border-foreground/80 p-4 text-center"
      data-testid="qr-card"
      data-qr={card.qrCode}
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.storeName}</p>
      <h2 className="text-xl font-bold leading-tight">
        {card.make} {card.model}
      </h2>
      {card.version ? <p className="text-sm">{card.version}</p> : null}
      <p className="text-sm">
        {formatYears(card.yearManufacture, card.yearModel)} · {formatKm(card.mileageKm)}
      </p>
      <p className="font-display text-3xl font-bold">{formatPriceCents(card.priceCentsAtFair)}</p>
      <div
        className="h-40 w-40"
        aria-label={`QR do carro ${card.qrCode}`}
        // SVG gerado localmente pela biblioteca qrcode a partir do código do carro.
        dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
      />
      <p className="text-sm font-medium">Aponte a câmera para ver fotos e falar com a loja</p>
      <p className="font-mono text-xs text-muted-foreground">{card.qrCode}</p>
    </article>
  );
}

export default function FairQrPage() {
  const { fairId } = useParams<{ fairId: string }>();
  const [all, setAll] = useState(false);
  const { company } = useAuth();
  const query = useQuery({ queryKey: ["fair-qr", fairId, all], queryFn: () => fairQr(fairId, all) });

  if (query.isLoading) return <LoadingBlock rows={3} label="Gerando cartões…" />;
  if (query.isError || !query.data) {
    return <ErrorPanel title="Não foi possível carregar" onRetry={() => void query.refetch()} />;
  }
  const { fair, cards } = query.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div>
          <h1 className="font-display text-2xl">QR dos carros — {fair.name}</h1>
          <p className="text-sm text-muted-foreground">
            {cards.length} cartões · {company?.name ?? ""} ·{" "}
            <Link href={`/fairs/${fair.id}`} className="underline">
              voltar
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
            Todas as lojas (só organizadora)
          </label>
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Imprimir
          </Button>
        </div>
      </div>
      {cards.length === 0 ? (
        <p className="rounded-xl border p-6 text-center text-muted-foreground print:hidden">
          Nenhum carro inscrito. Inscreva os carros na página do feirão.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-3">
          {cards.map((c) => (
            <Card key={c.fairVehicleId} card={c} />
          ))}
        </div>
      )}
    </div>
  );
}
