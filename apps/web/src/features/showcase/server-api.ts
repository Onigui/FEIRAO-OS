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
  onlyAvailable?: string;
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
  "onlyAvailable",
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
  for (const [k, v] of Object.entries(params)) if (v && k !== "onlyAvailable") qs.set(k, v);
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

// ---- Feirões (etapa 4) ----

export type PublicFair = {
  slug: string;
  name: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  address: string | null;
  description: string | null;
  status: "PUBLISHED" | "LIVE" | "ENDED";
  organizer: { name: string; slug: string | null };
  stores: { name: string; slug: string; city: string | null }[];
  counts: { vehicles: number; sold: number };
  makes: { make: string; count: number }[];
};

export type UpcomingFair = Omit<PublicFair, "stores" | "counts" | "makes"> & { vehicles: number };

export type PublicFairVehicle = import("@/features/showcase/types").PublicVehicleCard & {
  soldDuringFair: boolean;
};

export type PublicFairVehicleList = {
  data: PublicFairVehicle[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export function fetchPublicFair(slug: string) {
  return getPublic<PublicFair>(`/fairs/${encodeURIComponent(slug)}`);
}

export async function fetchUpcomingFairs(): Promise<UpcomingFair[]> {
  try {
    return (await getPublic<UpcomingFair[]>("/fairs/upcoming")) ?? [];
  } catch {
    // O destaque do feirão nunca derruba a vitrine.
    return [];
  }
}

export async function fetchPublicFairVehicles(
  slug: string,
  params: PublicListParams & { onlyAvailable?: string },
): Promise<PublicFairVehicleList | null> {
  const qs = new URLSearchParams({ limit: "48" });
  for (const key of ["q", "make", "store", "maxPrice", "page", "onlyAvailable"] as const) {
    const v = params[key];
    if (v) qs.set(key, v);
  }
  const res = await fetch(
    `${API_ORIGIN}/api/public/fairs/${encodeURIComponent(slug)}/vehicles?${qs.toString()}`,
    FETCH_INIT,
  );
  if (res.status === 404) return null;
  if (res.status === 400) return fetchPublicFairVehicles(slug, {});
  if (!res.ok) throw new Error(`Feirão indisponível (${res.status})`);
  return (await res.json()) as PublicFairVehicleList;
}

export async function scanQrCode(code: string): Promise<{ fairSlug: string; vehicleSlug: string | null } | null> {
  if (!/^[A-Za-z0-9]{4,16}$/.test(code)) return null;
  const res = await fetch(`${API_ORIGIN}/api/public/q/${encodeURIComponent(code)}`, FETCH_INIT);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`QR indisponível (${res.status})`);
  return (await res.json()) as { fairSlug: string; vehicleSlug: string | null };
}
