/** Mesma versão da API (SHOWCASE_CONSENT_TEXT_VERSION). Mudou o texto, muda a versão. */
export const CONSENT_TEXT_VERSION = "v1-2026-11";

export function consentContactText(storeName: string) {
  return `Autorizo a ${storeName} a falar comigo sobre este veículo pelo WhatsApp.`;
}

export function consentMarketingText(storeName: string) {
  return `Quero receber da ${storeName} ofertas de veículos parecidos.`;
}

export const SHOWCASE_CITY = process.env.NEXT_PUBLIC_SHOWCASE_CITY ?? "Botucatu";

export const INTEREST_SOURCE_LABEL: Record<string, string> = {
  SHOWCASE_CITY: "Vitrine da cidade",
  SHOWCASE_STORE: "Vitrine da loja",
  VEHICLE_PAGE: "Página do carro",
  FAIR_PAGE: "Página do feirão",
  QR: "QR do feirão",
};

export const LEAD_SOURCE_LABEL: Record<string, string> = {
  SHOWCASE: "Vitrine",
  WHATSAPP: "WhatsApp",
};

/** Mensagem pronta do botão de WhatsApp (cita o carro e o código do anúncio). */
export function whatsappMessage(v: {
  make: string;
  model: string;
  yearModel: number;
  code: string;
}) {
  return `Olá! Vi na vitrine e tenho interesse no ${v.make} ${v.model} ${v.yearModel} (anúncio ${v.code}).`;
}

export function whatsappHref(phoneDigits: string, text: string) {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`;
}
