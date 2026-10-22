import type { FairStatus, ParticipantStatus } from "@/features/fairs/types";

export const FAIR_STATUS_LABEL: Record<FairStatus, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  LIVE: "Ao vivo",
  ENDED: "Encerrado",
};

export const FAIR_STATUS_VARIANT: Record<FairStatus, "muted" | "default" | "success" | "outline"> = {
  DRAFT: "muted",
  PUBLISHED: "default",
  LIVE: "success",
  ENDED: "outline",
};

/** Texto do botão que avança o status (organizador). */
export const ADVANCE_LABEL: Partial<Record<FairStatus, string>> = {
  PUBLISHED: "Publicar feirão",
  LIVE: "Começar (ao vivo)",
  ENDED: "Encerrar feirão",
};

export const ADVANCE_CONFIRM: Partial<Record<FairStatus, string>> = {
  PUBLISHED: "A página do feirão fica pública e os QR passam a funcionar.",
  LIVE: "O feirão aparece como ao vivo para o público.",
  ENDED: "A lista de carros congela e o relatório fica final. Não dá para desfazer.",
};

export const PARTICIPANT_STATUS_LABEL: Record<ParticipantStatus, string> = {
  INVITED: "Convidada",
  ACCEPTED: "Confirmada",
  DECLINED: "Recusou",
};

const DATE = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const TIME = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const DAY = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

/** "sáb., 21 de nov. 08:00 – 18:00" (mesmo dia) ou as duas datas completas. */
export function formatFairPeriod(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  return DAY.format(s) === DAY.format(e)
    ? `${DATE.format(s)} – ${TIME.format(e)}`
    : `${DATE.format(s)} – ${DATE.format(e)}`;
}

/** Date → valor de <input type="datetime-local"> no horário de São Paulo. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Valor de <input type="datetime-local"> (horário de São Paulo, UTC−3) → ISO. */
export function fromLocalInput(value: string): string {
  return new Date(`${value}:00-03:00`).toISOString();
}
