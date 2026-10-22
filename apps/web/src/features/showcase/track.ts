"use client";

const KEY = "autopilot.showcase.session";

/** Identificador anônimo do navegador, trocado todo dia (sem dado pessoal). */
function dailySession(): string {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as {
      day: string;
      id: string;
    } | null;
    if (saved?.day === today && saved.id) return saved.id;
    const id = crypto.randomUUID().replace(/-/g, "");
    localStorage.setItem(KEY, JSON.stringify({ day: today, id }));
    return id;
  } catch {
    return crypto.randomUUID().replace(/-/g, "");
  }
}

export function trackShowcase(
  type: "PAGE_VIEW" | "WHATSAPP_CLICK" | "SEARCH",
  target: { vehicleSlug?: string; storeSlug?: string; fairSlug?: string } = {},
) {
  try {
    const body = JSON.stringify({ type, ...target, session: dailySession() });
    void fetch("/backend/api/public/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Analytics nunca atrapalha a navegação.
  }
}
