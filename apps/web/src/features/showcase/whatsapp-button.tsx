"use client";

import { MessageCircle } from "lucide-react";
import { trackShowcase } from "@/features/showcase/track";
import { whatsappHref } from "@/features/showcase/constants";

/** Abre a conversa com a loja; registra só o clique anônimo. */
export function WhatsAppButton({
  phone,
  message,
  vehicleSlug,
  storeSlug,
  fairSlug,
  label = "Chamar no WhatsApp",
  variant = "solid",
}: {
  phone: string;
  message: string;
  vehicleSlug?: string;
  storeSlug?: string;
  fairSlug?: string;
  label?: string;
  variant?: "solid" | "outline";
}) {
  const cls =
    variant === "solid"
      ? "bg-[#1f8f4e] text-white hover:bg-[#197a42]"
      : "border border-[#1f8f4e] bg-white text-[#16703c] hover:bg-emerald-50";
  return (
    <a
      href={whatsappHref(phone, message)}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="whatsapp-button"
      onClick={() => trackShowcase("WHATSAPP_CLICK", { vehicleSlug, storeSlug, fairSlug })}
      className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition ${cls}`}
    >
      <MessageCircle className="h-5 w-5" aria-hidden />
      {label}
    </a>
  );
}
