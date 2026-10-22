import { apiDownload, apiRequest } from "@/lib/api/client";
import type {
  FairDetail,
  FairInput,
  FairList,
  FairLive,
  FairReport,
  FairStatus,
  MyFairVehicles,
  QrSheet,
  StoreOption,
} from "@/features/fairs/types";

const base = "/api/fairs";

export const listFairs = () => apiRequest<FairList>(base);
export const getFair = (id: string) => apiRequest<FairDetail>(`${base}/${id}`);
export const createFair = (input: FairInput) =>
  apiRequest<FairDetail>(base, { method: "POST", body: input });
export const updateFair = (id: string, input: Partial<FairInput>) =>
  apiRequest<FairDetail>(`${base}/${id}`, { method: "PATCH", body: input });
export const changeFairStatus = (id: string, toStatus: FairStatus) =>
  apiRequest<FairDetail>(`${base}/${id}/status`, { method: "POST", body: { toStatus } });
export const searchStores = (q: string) =>
  apiRequest<StoreOption[]>(`${base}/stores?${new URLSearchParams({ q }).toString()}`);
export const inviteStores = (id: string, companyIds: string[]) =>
  apiRequest<{ invited: number; fair: FairDetail }>(`${base}/${id}/invites`, {
    method: "POST",
    body: { companyIds },
  });
export const removeInvite = (id: string, companyId: string) =>
  apiRequest<FairDetail>(`${base}/${id}/invites/${companyId}`, { method: "DELETE" });
export const respondInvite = (id: string, accept: boolean) =>
  apiRequest<FairDetail>(`${base}/${id}/respond`, { method: "POST", body: { accept } });
export const myFairVehicles = (id: string) => apiRequest<MyFairVehicles>(`${base}/${id}/vehicles`);
export const addFairVehicles = (id: string, vehicleIds: string[]) =>
  apiRequest<MyFairVehicles & { added: number; skipped: number }>(`${base}/${id}/vehicles`, {
    method: "POST",
    body: { vehicleIds },
  });
export const updateFairVehiclePrice = (id: string, fairVehicleId: string, priceCentsAtFair: number) =>
  apiRequest<MyFairVehicles>(`${base}/${id}/vehicles/${fairVehicleId}`, {
    method: "PATCH",
    body: { priceCentsAtFair },
  });
export const removeFairVehicle = (id: string, fairVehicleId: string) =>
  apiRequest<MyFairVehicles>(`${base}/${id}/vehicles/${fairVehicleId}`, { method: "DELETE" });
export const fairLive = (id: string) => apiRequest<FairLive>(`${base}/${id}/live`);
export const fairQr = (id: string, all: boolean) =>
  apiRequest<QrSheet>(`${base}/${id}/qr${all ? "?all=true" : ""}`);
export const fairReport = (id: string) => apiRequest<FairReport>(`${base}/${id}/report`);
export const downloadFairReportCsv = (id: string) => apiDownload(`${base}/${id}/report.csv`);
