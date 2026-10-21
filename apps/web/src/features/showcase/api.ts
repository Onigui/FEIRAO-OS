import { apiRequest } from "@/lib/api/client";
import type {
  InterestResult,
  InterestSource,
  LeadInterest,
  ShowcaseStats,
} from "@/features/showcase/types";

export type InterestInput = {
  vehicleSlug: string;
  name: string;
  phone: string;
  consentContact: boolean;
  consentMarketing: boolean;
  source: InterestSource;
  website?: string;
};

export class InterestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Formulário público: sem login, pelo proxy /backend. */
export async function sendInterest(input: InterestInput): Promise<InterestResult> {
  const res = await fetch("/backend/api/public/interests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.ok) return (await res.json()) as InterestResult;
  let message = "Não foi possível enviar agora. Tente de novo em instantes.";
  if (res.status === 409) message = "Este carro acabou de ser vendido.";
  else if (res.status === 429) message = "Muitas tentativas. Aguarde um minuto e tente de novo.";
  else if (res.status === 400) {
    const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
    const text = Array.isArray(body?.message) ? body.message.join(" ") : String(body?.message ?? "");
    message = /whats|ddd|phone/i.test(text)
      ? "Confira o WhatsApp: precisa ter DDD, como (14) 99999-0000."
      : "Confira os dados e marque a autorização de contato.";
  } else if (res.status === 404) message = "Este anúncio não está mais na vitrine.";
  throw new InterestError(message, res.status);
}

export function getShowcaseStats() {
  return apiRequest<ShowcaseStats>("/api/showcase/stats");
}

export function getLeadInterests(leadIds: string[]) {
  const qs = new URLSearchParams({ leadIds: leadIds.join(",") });
  return apiRequest<Record<string, LeadInterest[]>>(
    `/api/showcase/lead-interests?${qs.toString()}`,
  );
}
