import type {
  VehicleFuel,
  VehicleStatus,
  VehicleTransmission,
} from "@/features/inventory/types";

export type PublicStore = {
  slug: string;
  name: string;
  city: string | null;
  address: string | null;
  /** Só dígitos, com 55. */
  whatsapp: string | null;
};

export type PublicVehicleCard = {
  slug: string;
  code: string;
  make: string;
  model: string;
  version: string | null;
  yearManufacture: number;
  yearModel: number;
  priceCents: number;
  mileageKm: number;
  transmission: VehicleTransmission;
  fuel: VehicleFuel;
  status: VehicleStatus;
  coverUrl: string | null;
  store: Pick<PublicStore, "slug" | "name" | "city">;
};

export type PublicVehicleFair = {
  slug: string;
  name: string;
  status: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  priceCentsAtFair: number;
};

export type PublicVehicleDetail = PublicVehicleCard & {
  fairs: PublicVehicleFair[];
  bodyType: string | null;
  color: string | null;
  description: string | null;
  photos: { url: string; width: number; height: number }[];
  store: PublicStore;
};

export type PublicVehicleList = {
  data: PublicVehicleCard[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    makes: { make: string; count: number }[];
  };
};

export type PublicStoreDetail = PublicStore & { vehicleCount: number };

export type InterestSource =
  | "SHOWCASE_CITY"
  | "SHOWCASE_STORE"
  | "VEHICLE_PAGE"
  | "FAIR_PAGE"
  | "QR";

export type InterestResult = {
  ok: true;
  storeName: string;
  whatsappUrl: string | null;
};

export type ShowcaseStats = {
  availableVehicles: number;
  contactsWeek: number;
  whatsappClicksWeek: number;
  pageViewsWeek: number;
};

export type LeadInterest = {
  id: string;
  source: InterestSource | string;
  createdAt: string;
  marketingConsent: boolean;
  automationBlocked: boolean;
  vehicle: {
    id: string;
    make: string;
    model: string;
    yearModel: number;
    priceCents: number;
    status: VehicleStatus;
    code: string;
    coverUrl: string | null;
  } | null;
};
