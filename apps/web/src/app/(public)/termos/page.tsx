import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termo de uso da vitrine · AutoPilot",
};

/**
 * Versão v1-2026-11 — REVISAR COM ADVOGADO antes do uso comercial.
 * Mudanças de texto exigem nova versão (SHOWCASE_TERMS_VERSION na API).
 */
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-10 text-sm leading-relaxed">
      <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
        Rascunho — revisar com advogado antes do uso comercial.
      </p>
      <h1 className="font-display text-3xl">Termo de uso da vitrine</h1>
      <p className="text-muted-foreground">Versão v1-2026-11</p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">1. O que é a vitrine</h2>
        <p>
          A vitrine do AutoPilot publica, para qualquer pessoa, os veículos que a loja marcar como
          disponíveis ou reservados, com fotos, preço e dados de contato da loja. Também é usada
          nos feirões dos quais a loja participar.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">2. Responsabilidades da loja</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Manter preço, fotos e status (vendido, reservado) corretos e atualizados.</li>
          <li>
            Publicar apenas fotos e informações que a loja tem direito de usar e que correspondem
            ao veículo anunciado.
          </li>
          <li>Responder aos interessados pelos canais informados.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">3. Contatos de interessados (LGPD)</h2>
        <p>
          A loja é a controladora dos dados pessoais dos interessados que entram em contato pela
          vitrine. O AutoPilot atua como operador, tratando esses dados apenas para entregá-los à
          loja e registrar as autorizações de contato dadas pelo interessado.
        </p>
        <p>
          A loja só pode enviar ofertas a quem autorizou expressamente esse tipo de contato, e
          deve atender pedidos de exclusão.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">4. Desativação</h2>
        <p>
          A loja pode desativar a vitrine a qualquer momento nas configurações. Os veículos deixam
          de aparecer para o público; os dados continuam disponíveis para a loja.
        </p>
      </section>
    </main>
  );
}
