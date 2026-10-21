import type {
  VehicleFuel,
  VehicleStatus,
  VehicleTransmission,
} from "@/features/inventory/types";

export const VEHICLE_STATUSES: VehicleStatus[] = [
  "AVAILABLE",
  "RESERVED",
  "SOLD",
  "ARCHIVED",
];

export const VEHICLE_STATUS_LABEL: Record<VehicleStatus, string> = {
  AVAILABLE: "Disponível",
  RESERVED: "Reservado",
  SOLD: "Vendido",
  ARCHIVED: "Arquivado",
};

export const TRANSMISSIONS: VehicleTransmission[] = [
  "MANUAL",
  "AUTOMATIC",
  "CVT",
  "AUTOMATED",
];

export const TRANSMISSION_LABEL: Record<VehicleTransmission, string> = {
  MANUAL: "Manual",
  AUTOMATIC: "Automático",
  CVT: "CVT",
  AUTOMATED: "Automatizado",
};

export const FUELS: VehicleFuel[] = [
  "FLEX",
  "GASOLINE",
  "ETHANOL",
  "DIESEL",
  "HYBRID",
  "ELECTRIC",
];

export const FUEL_LABEL: Record<VehicleFuel, string> = {
  FLEX: "Flex",
  GASOLINE: "Gasolina",
  ETHANOL: "Etanol",
  DIESEL: "Diesel",
  HYBRID: "Híbrido",
  ELECTRIC: "Elétrico",
};

export const MAX_PHOTOS = 15;
/** Lado maior da foto depois da compressão no navegador. */
export const PHOTO_MAX_SIDE = 1600;
export const PHOTO_JPEG_QUALITY = 0.8;
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
