export type VehicleStatus = "AVAILABLE" | "RESERVED" | "SOLD" | "ARCHIVED";
export type VehicleTransmission = "MANUAL" | "AUTOMATIC" | "CVT" | "AUTOMATED";
export type VehicleFuel =
  | "FLEX"
  | "GASOLINE"
  | "ETHANOL"
  | "DIESEL"
  | "HYBRID"
  | "ELECTRIC";

export type VehiclePhoto = {
  id: string;
  url: string | null;
  width: number;
  height: number;
  sortOrder: number;
};

export type Vehicle = {
  id: string;
  slug: string;
  showcaseCode: string;
  make: string;
  model: string;
  version: string | null;
  yearManufacture: number;
  yearModel: number;
  priceCents: number;
  mileageKm: number;
  transmission: VehicleTransmission;
  fuel: VehicleFuel;
  bodyType: string | null;
  color: string | null;
  description: string | null;
  status: VehicleStatus;
  soldAt: string | null;
  coverUrl: string | null;
  photos: VehiclePhoto[];
  createdAt: string;
  updatedAt: string;
};

export type VehicleInput = {
  make: string;
  model: string;
  version?: string | null;
  yearManufacture: number;
  yearModel: number;
  priceCents: number;
  mileageKm: number;
  transmission: VehicleTransmission;
  fuel: VehicleFuel;
  bodyType?: string | null;
  color?: string | null;
  description?: string | null;
};

export type ListVehiclesQuery = {
  status?: VehicleStatus;
  includeArchived?: boolean;
  search?: string;
  page?: number;
  limit?: number;
};

export type VehicleStatusChange = {
  id: string;
  fromStatus: VehicleStatus;
  toStatus: VehicleStatus;
  actorUserId: string | null;
  occurredAt: string;
};

export type UploadUrl = {
  method: "PUT";
  url: string;
  key: string;
  headers: Record<string, string>;
  expiresAt: string;
};

export type ImportPreview = {
  totalRows: number;
  valid: { line: number; vehicle: VehicleInput }[];
  errors: { line: number; messages: string[] }[];
};

export type ShowcaseSettings = {
  slug: string | null;
  publicWhatsapp: string | null;
  publicAddress: string | null;
  city: string | null;
  showcaseEnabled: boolean;
  showcaseTermsAcceptedAt: string | null;
  termsVersion: string;
};

export type UpdateShowcaseInput = {
  publicWhatsapp?: string | null;
  publicAddress?: string | null;
  city?: string | null;
  acceptTerms?: boolean;
  showcaseEnabled?: boolean;
};
