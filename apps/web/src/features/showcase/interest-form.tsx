"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { sendInterest, InterestError } from "@/features/showcase/api";
import { consentContactText, consentMarketingText } from "@/features/showcase/constants";
import type { InterestResult, InterestSource } from "@/features/showcase/types";

const inputClass =
  "h-12 w-full rounded-lg border border-input bg-white px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Formulário de interesse: 3 campos (o carro já vem preenchido) e 2 autorizações. */
export function InterestForm({
  vehicleSlug,
  vehicleLabel,
  storeName,
  source = "VEHICLE_PAGE",
  fairSlug,
}: {
  fairSlug?: string;
  vehicleSlug: string;
  vehicleLabel: string;
  storeName: string;
  source?: InterestSource;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [contact, setContact] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<InterestResult | null>(null);

  if (done) {
    return (
      <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4" data-testid="interest-done">
        <p className="flex items-center gap-2 font-semibold text-emerald-900">
          <CheckCircle2 className="h-5 w-5" aria-hidden /> Pronto! A {done.storeName} vai falar com você.
        </p>
        <p className="text-sm text-emerald-900/80">
          Se preferir, já pode chamar agora no WhatsApp.
        </p>
        {done.whatsappUrl ? (
          <a
            href={done.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center rounded-xl bg-[#1f8f4e] px-4 font-semibold text-white"
          >
            Abrir conversa
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      data-testid="interest-form"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        if (name.trim().length < 2) return setError("Informe seu nome.");
        if (phone.replace(/\D/g, "").length < 10) {
          return setError("Informe o WhatsApp com DDD, como (14) 99999-0000.");
        }
        if (!contact) return setError("Marque a autorização para a loja falar com você.");
        setSending(true);
        try {
          setDone(
            await sendInterest({
              vehicleSlug,
              name: name.trim(),
              phone,
              consentContact: true,
              consentMarketing: marketing,
              source,
              fairSlug,
              website,
            }),
          );
        } catch (err) {
          setError(err instanceof InterestError ? err.message : "Não foi possível enviar agora.");
        } finally {
          setSending(false);
        }
      }}
    >
      <div className="space-y-1">
        <label htmlFor="interest-name" className="text-sm font-medium">
          Seu nome
        </label>
        <input
          id="interest-name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          maxLength={120}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="interest-phone" className="text-sm font-medium">
          Seu WhatsApp
        </label>
        <input
          id="interest-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(14) 99999-0000"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputClass}
          maxLength={25}
        />
      </div>
      <div className="space-y-1">
        <span className="text-sm font-medium">Carro</span>
        <p className="rounded-lg bg-muted px-3 py-2.5 text-sm">{vehicleLabel}</p>
      </div>

      {/* Campo-armadilha: escondido de pessoas e de leitores de tela. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="interest-website">Site</label>
        <input
          id="interest-website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <label className="flex items-start gap-3 rounded-lg border bg-white p-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 shrink-0"
          checked={contact}
          onChange={(e) => setContact(e.target.checked)}
          data-testid="consent-contact"
        />
        <span>
          {consentContactText(storeName)} <span className="text-muted-foreground">(obrigatório)</span>
        </span>
      </label>
      <label className="flex items-start gap-3 rounded-lg border bg-white p-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 shrink-0"
          checked={marketing}
          onChange={(e) => setMarketing(e.target.checked)}
          data-testid="consent-marketing"
        />
        <span>
          {consentMarketingText(storeName)} <span className="text-muted-foreground">(opcional)</span>
        </span>
      </label>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={sending}
        className="h-12 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {sending ? "Enviando…" : "Quero que a loja me chame"}
      </button>
      <p className="text-xs text-muted-foreground">
        Seus dados vão só para a {storeName}. Veja a{" "}
        <Link href="/privacidade" className="underline">
          política de privacidade
        </Link>
        .
      </p>
    </form>
  );
}
