import type {
  PublicStoreDetail,
  PublicVehicleDetail,
  PublicVehicleList,
} from "@/features/showcase/types";

/** A página pública é renderizada no servidor: fala direto com a API. */
const API_ORIGIN = (
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_ORIGIN ??
  "http://localhost:3001"
).replace(/\/$/, "");

/**
 * Sem cache: "vendido some da vitrine na hora" (regra do produto). Na escala de
 * uma cidade, cada visita é uma consulta leve à API.
 */
const FETCH_INIT = { cache: "no-store" } as const;

async function getPublic<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_ORIGIN}/api/public${path}`, {
    ...FETCH_INIT,
    headers: { Accept: "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Vitrine indisponível (${res.status})`);
  return (await res.json()) as T;
}

export type PublicListParams = {
  q?: string;
  make?: string;
  store?: string;
  maxPrice?: string;
  minYear?: string;
  transmission?: string;
  fuel?: string;
  sort?: string;
  page?: string;
};

const LIST_KEYS: (keyof PublicListParams)[] = [
  "q",
  "make",
  "store",
  "maxPrice",
  "minYear",
  "transmission",
  "fuel",
  "sort",
  "page",
];

export function listParamsFrom(
  searchParams: Record<string, string | string[] | undefined>,
): PublicListParams {
  const out: PublicListParams = {};
  for (const key of LIST_KEYS) {
    const raw = searchParams[key];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
    if (value) out[key] = value;
  }
  return out;
}

export async function fetchPublicVehicles(
  params: PublicListParams,
): Promise<PublicVehicleList> {
  const qs = new URLSearchParams({ limit: "24" });
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  const res = await fetch(`${API_ORIGIN}/api/public/vehicles?${qs.toString()}`, FETCH_INIT);
  // Filtro inválido na URL (ex.: ano "abc"): mostra a lista sem filtros.
  if (res.status === 400) {
    return fetchPublicVehicles(params.store ? { store: params.store } : {});
  }
  if (!res.ok) throw new Error(`Vitrine indisponível (${res.status})`);
  return (await res.json()) as PublicVehicleList;
}

export function fetchPublicVehicle(slug: string) {
  return getPublic<PublicVehicleDetail>(`/vehicles/${encodeURIComponent(slug)}`);
}

export function fetchPublicStore(slug: string) {
  return getPublic<PublicStoreDetail>(`/stores/${encodeURIComponent(slug)}`);
}
