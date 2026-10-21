"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";

export function ShareButton({ title }: { title: string }) {
  return (
    <button
      type="button"
      onClick={async () => {
        const url = window.location.href.split("?")[0];
        try {
          if (navigator.share) {
            await navigator.share({ title, url });
            return;
          }
          await navigator.clipboard.writeText(url);
          toast.success("Link copiado");
        } catch {
          // Compartilhamento cancelado pela pessoa: nada a fazer.
        }
      }}
      className="inline-flex h-10 items-center gap-2 rounded-lg border bg-white px-3 text-sm font-medium"
    >
      <Share2 className="h-4 w-4" aria-hidden />
      Compartilhar
    </button>
  );
}
