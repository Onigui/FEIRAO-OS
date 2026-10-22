import type { VehicleStatus } from "@/features/inventory/types";

export type FairStatus = "DRAFT" | "PUBLISHED" | "LIVE" | "ENDED";
export type ParticipantStatus = "INVITED" | "ACCEPTED" | "DECLINED";

export type FairSummary = {
  id: string;
  name: string;
  slug: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  address: string | null;
  description: string | null;
  status: FairStatus;
  nextStatus: FairStatus | null;
  organizer: { id: string; name: string };
  isOrganizer: boolean;
  myParticipation: { status: ParticipantStatus; respondedAt: string | null } | null;
  counts: { acceptedStores: number; vehicles: number; myVehicles: number };
};

export type FairParticipant = {
  companyId: string;
  name: string;
  slug: string | null;
  city: string | null;
  showcaseEnabled: boolean;
  status: ParticipantStatus;
  invitedAt: string;
  respondedAt: string | null;
  vehicles: number;
  isOrganizer: boolean;
};

export type FairDetail = FairSummary & { participants: FairParticipant[] };

export type FairList = {
  organizing: FairSummary[];
  participating: FairSummary[];
  invites: FairSummary[];
  declined: FairSummary[];
  next: FairSummary | null;
};

export type FairInput = {
  name: string;
  startsAt: string;
  endsAt: string;
  venue: string;
  address?: string | null;
  description?: string | null;
};

export type FairVehicleItem = {
  fairVehicleId: string;
  qrCode: string;
  priceCentsAtFair: number;
  addedAt: string;
  soldDuringFair: boolean;
  coverUrl: string | null;
  vehicle: {
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
    status: VehicleStatus;
    soldAt: string | null;
  };
};

export type CandidateVehicle = FairVehicleItem["vehicle"];

export type MyFairVehicles = {
  frozen: boolean;
  vehicles: FairVehicleItem[];
  candidates: CandidateVehicle[];
};

export type FairLive = {
  fair: Pick<FairSummary, "id" | "name" | "slug" | "status" | "startsAt" | "endsAt">;
  counters: {
    fairVehicles: number;
    fairSold: number;
    fairAvailable: number;
    myVehicles: number;
    mySold: number;
  };
  vehicles: FairVehicleItem[];
};

export type QrCard = {
  fairVehicleId: string;
  qrCode: string;
  storeName: string;
  make: string;
  model: string;
  version: string | null;
  yearManufacture: number;
  yearModel: number;
  mileageKm: number;
  priceCentsAtFair: number;
  showcaseCode: string;
};

export type QrSheet = {
  fair: { id: string; name: string; slug: string; startsAt: string; venue: string };
  cards: QrCard[];
};

export type ReportRow = {
  companyId: string;
  storeName: string;
  vehicles: number;
  soldDuringFair: number;
  soldValueCents: number;
  interests: number;
  qrScans: number;
  whatsappClicks: number;
};

export type FairReport = {
  fair: Pick<FairSummary, "id" | "name" | "slug" | "status" | "startsAt" | "endsAt" | "venue">;
  scope: "ALL_STORES" | "MY_STORE";
  totals: Omit<ReportRow, "companyId" | "storeName"> & {
    stores: number;
    pageViews: number;
    conversionPct: number;
  };
  stores: ReportRow[];
};

export type StoreOption = {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  showcaseEnabled: boolean;
};
