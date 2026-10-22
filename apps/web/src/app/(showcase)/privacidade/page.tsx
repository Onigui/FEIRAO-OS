import type { Metadata } from "next";

export const metadata: Metadata = { title: "Política de privacidade da vitrine" };

/**
 * Versão v1-2026-11 — RASCUNHO. Revisar com advogado antes do uso comercial.
 * Mudanças de texto exigem nova versão.
 */
export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-6 text-sm leading-relaxed">
      <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
        Rascunho — revisar com advogado antes do uso comercial.
      </p>
      <h1 className="font-display text-3xl">Política de privacidade da vitrine</h1>
      <p className="text-muted-foreground">Versão v1-2026-11</p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Quem cuida dos seus dados</h2>
        <p>
          Quando você pede contato sobre um carro, seu nome e WhatsApp vão para a loja dona do
          anúncio. A loja é a <strong>controladora</strong> desses dados. O AutoPilot, sistema
          usado pela loja, é o <strong>operador</strong>: guarda e entrega os dados à loja, sem usar
          para outra finalidade.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">O que é guardado e para quê</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Nome, WhatsApp e o carro de interesse: para a loja responder sobre esse carro.</li>
          <li>
            A data e o texto das autorizações que você marcou. A loja só pode mandar ofertas de
            outros carros se você marcou a segunda autorização.
          </li>
          <li>
            Visitas e cliques são contados sem identificar você: o navegador usa um código
            aleatório que muda todo dia. Não guardamos seu IP nesses registros.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Por quanto tempo</h2>
        <p>
          Um pedido de contato sem andamento por 12 meses é anonimizado automaticamente. Se a
          vitrine foi o único contato entre você e a loja, seu nome e telefone são apagados. Se
          você também conversa com a loja por outro canal, como o WhatsApp, esse histórico fica
          com a loja.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Seus direitos</h2>
        <p>
          Para parar de receber mensagens, responda <strong>PARE</strong> no WhatsApp da loja.
          Para pedir acesso, correção ou exclusão dos seus dados, fale com a loja pelo mesmo
          WhatsApp. A loja atende o pedido pelo AutoPilot.
        </p>
      </section>
    </article>
  );
}
