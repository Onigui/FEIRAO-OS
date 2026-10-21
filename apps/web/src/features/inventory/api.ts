import { apiDownload, apiRequest } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { Paginated } from "@/lib/api/types";
import type {
  ImportPreview,
  ListVehiclesQuery,
  ShowcaseSettings,
  UpdateShowcaseInput,
  UploadUrl,
  Vehicle,
  VehicleInput,
  VehicleStatus,
  VehicleStatusChange,
} from "@/features/inventory/types";

function toQuery(params: ListVehiclesQuery) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.includeArchived) search.set("includeArchived", "true");
  if (params.search) search.set("search", params.search);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listVehicles(query: ListVehiclesQuery = {}) {
  return apiRequest<Paginated<Vehicle>>(
    `${endpoints.inventory.vehicles}${toQuery(query)}`,
  );
}

export function getVehicle(id: string) {
  return apiRequest<Vehicle>(endpoints.inventory.vehicle(id));
}

export function createVehicle(input: VehicleInput) {
  return apiRequest<Vehicle>(endpoints.inventory.vehicles, {
    method: "POST",
    body: input,
  });
}

export function updateVehicle(id: string, input: Partial<VehicleInput>) {
  return apiRequest<Vehicle>(endpoints.inventory.vehicle(id), {
    method: "PATCH",
    body: input,
  });
}

export function deleteVehicle(id: string) {
  return apiRequest<void>(endpoints.inventory.vehicle(id), { method: "DELETE" });
}

export function changeVehicleStatus(id: string, toStatus: VehicleStatus) {
  return apiRequest<Vehicle>(endpoints.inventory.status(id), {
    method: "POST",
    body: { toStatus },
  });
}

export function getStatusHistory(id: string) {
  return apiRequest<VehicleStatusChange[]>(endpoints.inventory.statusHistory(id));
}

export function createPhotoUploadUrl(
  id: string,
  input: { contentType: string; sizeBytes: number },
) {
  return apiRequest<UploadUrl>(endpoints.inventory.photoUploadUrl(id), {
    method: "POST",
    body: input,
  });
}

export function confirmPhoto(
  id: string,
  input: { storageKey: string; width: number; height: number },
) {
  return apiRequest<Vehicle>(endpoints.inventory.photos(id), {
    method: "POST",
    body: input,
  });
}

export function reorderPhotos(id: string, photoIds: string[]) {
  return apiRequest<Vehicle>(endpoints.inventory.photosOrder(id), {
    method: "PUT",
    body: { photoIds },
  });
}

export function deletePhoto(id: string, photoId: string) {
  return apiRequest<Vehicle>(endpoints.inventory.photo(id, photoId), {
    method: "DELETE",
  });
}

export function downloadImportTemplate(format: "csv" | "xlsx") {
  return apiDownload(endpoints.inventory.importTemplate(format));
}

export function previewImport(file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiRequest<ImportPreview>(endpoints.inventory.importPreview, {
    method: "POST",
    body: form,
  });
}

export function commitImport(vehicles: VehicleInput[]) {
  return apiRequest<{ imported: number }>(endpoints.inventory.importCommit, {
    method: "POST",
    body: { vehicles },
  });
}

export function getShowcaseSettings() {
  return apiRequest<ShowcaseSettings>(endpoints.settings.showcase);
}

export function updateShowcaseSettings(input: UpdateShowcaseInput) {
  return apiRequest<ShowcaseSettings>(endpoints.settings.showcase, {
    method: "PATCH",
    body: input,
  });
}
