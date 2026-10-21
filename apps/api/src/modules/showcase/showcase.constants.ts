/** Vitrine e Feirões — etapa 3 (vitrine pública e contatos). */

/** Versão do texto das duas autorizações do formulário (muda se o texto mudar). */
export const SHOWCASE_CONSENT_TEXT_VERSION = 'v1-2026-11';

/** Origem gravada em `leads.source` quando a vitrine cria o lead. */
export const SHOWCASE_LEAD_SOURCE = 'SHOWCASE';

/** Onde o visitante estava quando pediu contato (`lead_vehicle_interests.source`). */
export const SHOWCASE_INTEREST_SOURCES = [
  'SHOWCASE_CITY',
  'SHOWCASE_STORE',
  'VEHICLE_PAGE',
  'FAIR_PAGE',
  'QR',
] as const;
export type ShowcaseInterestSource = (typeof SHOWCASE_INTEREST_SOURCES)[number];

/** Mesmo carro, mesma pessoa, dentro desta janela → não duplica. */
export const SHOWCASE_INTEREST_DEDUPE_MS = 24 * 60 * 60 * 1000;

/** Status que aparecem na vitrine (vendido sai na hora; arquivado nunca aparece). */
export const SHOWCASE_LISTED_STATUSES = ['AVAILABLE', 'RESERVED'] as const;

export const PUBLIC_LIST_MAX_LIMIT = 48;

/**
 * Limites próprios das rotas públicas (por IP, janela de 1 minuto).
 * Lidos a cada requisição; as variáveis de ambiente permitem ajustar sem deploy de código.
 */
function envLimit(name: string, fallback: number): () => number {
  return () => {
    const n = Number.parseInt(process.env[name] ?? '', 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
}
export const PUBLIC_READ_LIMIT_PER_MIN = envLimit(
  'SHOWCASE_READ_LIMIT_PER_MIN',
  300,
);
export const PUBLIC_INTEREST_LIMIT_PER_MIN = envLimit(
  'SHOWCASE_INTEREST_LIMIT_PER_MIN',
  10,
);
export const PUBLIC_ANALYTICS_LIMIT_PER_MIN = envLimit(
  'SHOWCASE_ANALYTICS_LIMIT_PER_MIN',
  120,
);

/** Auditoria. */
export const SHOWCASE_INTEREST_CREATED = 'SHOWCASE_INTEREST_CREATED';
