import Link from "next/link";
import { redirect } from "next/navigation";
import { scanQrCode } from "@/features/showcase/server-api";

export const dynamic = "force-dynamic";

/** Leitura do QR do feirão: registra (sem dado pessoal) e leva ao carro com a origem marcada. */
export default async function QrPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const target = await scanQrCode(codigo);
  if (target?.vehicleSlug) {
    redirect(`/carro/${target.vehicleSlug}?feirao=${encodeURIComponent(target.fairSlug)}&origem=qr`);
  }
  if (target) redirect(`/feirao/${target.fairSlug}`);

  return (
    <div className="mx-auto max-w-md space-y-3 rounded-2xl border bg-white p-6 text-center">
      <h1 className="font-display text-2xl">QR não encontrado</h1>
      <p className="text-sm text-muted-foreground">
        Este código não está mais ativo. O carro pode ter saído do feirão.
      </p>
      <Link href="/vitrine" className="inline-block font-medium text-primary underline">
        Ver os carros da vitrine
      </Link>
    </div>
  );
}
