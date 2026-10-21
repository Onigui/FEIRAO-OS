"use client";

import { useEffect } from "react";
import { trackShowcase } from "@/features/showcase/track";

/** Registra a visita uma vez por carregamento (anônimo). */
export function PageView({
  vehicleSlug,
  storeSlug,
  search,
}: {
  vehicleSlug?: string;
  storeSlug?: string;
  search?: boolean;
}) {
  useEffect(() => {
    trackShowcase(search ? "SEARCH" : "PAGE_VIEW", { vehicleSlug, storeSlug });
  }, [vehicleSlug, storeSlug, search]);
  return null;
}
