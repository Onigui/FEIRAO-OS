"use client";

import { useEffect } from "react";
import { trackShowcase } from "@/features/showcase/track";

/** Registra a visita uma vez por carregamento (anônimo). */
export function PageView({
  vehicleSlug,
  storeSlug,
  fairSlug,
  search,
}: {
  vehicleSlug?: string;
  storeSlug?: string;
  fairSlug?: string;
  search?: boolean;
}) {
  useEffect(() => {
    trackShowcase(search ? "SEARCH" : "PAGE_VIEW", { vehicleSlug, storeSlug, fairSlug });
  }, [vehicleSlug, storeSlug, fairSlug, search]);
  return null;
}
