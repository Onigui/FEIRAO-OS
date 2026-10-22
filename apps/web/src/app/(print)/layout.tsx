"use client";

import { RequireAuth } from "@/components/auth/require-auth";

/** Páginas para imprimir: sem menu, só o conteúdo. */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth requireCompany>
      <main data-print-page className="mx-auto max-w-5xl bg-white p-4 print:max-w-none print:p-0">{children}</main>
    </RequireAuth>
  );
}
