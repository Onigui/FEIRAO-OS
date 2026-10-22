import { apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type {
  AccessLinkInfo,
  AccessLinkPurpose,
  ChangePasswordInput,
  CompleteAccessLinkInput,
} from "@/lib/api/types";

export function fetchAccessLink(token: string) {
  return apiRequest<AccessLinkInfo>(endpoints.auth.accessLink(token), {
    auth: false,
  });
}

export function completeAccessLink(
  token: string,
  input: CompleteAccessLinkInput,
) {
  return apiRequest<{ ok: true; email: string }>(
    endpoints.auth.completeAccessLink(token),
    { method: "POST", auth: false, body: input },
  );
}

export function changePassword(input: ChangePasswordInput) {
  return apiRequest<{ ok: true; otherSessionsRevoked: number }>(
    endpoints.auth.changePassword,
    { method: "POST", body: input },
  );
}

/** Mesma regra da API: 8+ caracteres, com letras e números. */
export const PASSWORD_HINT = "Mínimo de 8 caracteres, com letras e números.";

export function passwordProblem(
  password: string,
  email?: string,
): string | null {
  if (password.length < 8)
    return "A senha precisa ter pelo menos 8 caracteres.";
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) {
    return "A senha precisa ter letras e números.";
  }
  if (email && password.trim().toLowerCase() === email.trim().toLowerCase()) {
    return "A senha não pode ser igual ao e-mail.";
  }
  return null;
}

export function accessLinkUrl(token: string): string {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL ?? "");
  return `${origin}/acesso/${token}`;
}

/** Mensagem pronta para mandar por WhatsApp. */
export function accessLinkMessage(input: {
  name: string;
  companyName: string;
  purpose: AccessLinkPurpose;
  url: string;
}): string {
  const first = input.name.trim().split(/\s+/)[0] || "Olá";
  if (input.purpose === "INVITE") {
    return `Oi, ${first}! Este é o seu acesso ao painel da ${input.companyName}. Abra o link, crie sua senha e entre: ${input.url} (vale por 7 dias e só pode ser usado uma vez)`;
  }
  return `Oi, ${first}! Para criar uma senha nova no painel da ${input.companyName}, abra: ${input.url} (vale por 24 horas e só pode ser usado uma vez)`;
}

/** Mensagem da API (ex.: "Senha incorreta") sem cair no texto genérico de sessão expirada. */
export function apiMessage(error: unknown, fallback: string): string {
  const e = error as { status?: number; body?: { message?: unknown } };
  if (e?.status && e.status < 500 && e.status !== 429) {
    const m = e.body?.message;
    if (typeof m === "string" && m && !m.includes("/api/")) return m;
    if (Array.isArray(m) && m.length) return String(m[0]);
  }
  if (e?.status === 429)
    return "Muitas tentativas. Espere um minuto e tente de novo.";
  return fallback;
}
