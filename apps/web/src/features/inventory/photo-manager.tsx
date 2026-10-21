"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  confirmPhoto,
  createPhotoUploadUrl,
  deletePhoto,
  reorderPhotos,
} from "@/features/inventory/api";
import { compressPhoto } from "@/features/inventory/compress-photo";
import { MAX_PHOTOS, PHOTO_MAX_BYTES } from "@/features/inventory/constants";
import type { Vehicle } from "@/features/inventory/types";
import { friendlyError } from "@/lib/errors";

type Progress = { done: number; total: number };

async function uploadOne(vehicleId: string, file: File): Promise<Vehicle> {
  const photo = await compressPhoto(file);
  if (photo.blob.size > PHOTO_MAX_BYTES) {
    throw new Error("Foto grande demais mesmo depois de comprimida.");
  }
  const target = await createPhotoUploadUrl(vehicleId, {
    contentType: "image/jpeg",
    sizeBytes: photo.blob.size,
  });
  const res = await fetch(target.url, {
    method: "PUT",
    headers: target.headers,
    body: photo.blob,
  });
  if (!res.ok) {
    throw new Error("O envio da foto falhou. Verifique a conexão e tente de novo.");
  }
  return confirmPhoto(vehicleId, {
    storageKey: target.key,
    width: photo.width,
    height: photo.height,
  });
}

/** Envio (com compressão), ordem, capa e remoção das fotos de um veículo. */
export function PhotoManager({ vehicle }: { vehicle: Vehicle }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<Progress | null>(null);

  const setVehicle = (v: Vehicle) => {
    queryClient.setQueryData(["vehicle", v.id], v);
    void queryClient.invalidateQueries({ queryKey: ["vehicles"] });
  };

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const room = MAX_PHOTOS - vehicle.photos.length;
      const batch = files.slice(0, room);
      if (files.length > room) {
        toast.warning(`Só cabem mais ${room} foto(s) neste veículo.`);
      }
      setProgress({ done: 0, total: batch.length });
      let last: Vehicle | null = null;
      for (const file of batch) {
        last = await uploadOne(vehicle.id, file);
        setVehicle(last);
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
      return last;
    },
    onSuccess: (last) => {
      if (last) toast.success("Fotos enviadas");
    },
    onError: (error) => toast.error(friendlyError(error, "Não foi possível enviar a foto.")),
    onSettled: () => {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    },
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderPhotos(vehicle.id, ids),
    onSuccess: setVehicle,
    onError: (error) => toast.error(friendlyError(error)),
  });

  const remove = useMutation({
    mutationFn: (photoId: string) => deletePhoto(vehicle.id, photoId),
    onSuccess: (v) => {
      setVehicle(v);
      toast.success("Foto removida");
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const ids = vehicle.photos.map((p) => p.id);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= ids.length) return;
    const next = [...ids];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    reorder.mutate(next);
  };

  const busy = upload.isPending || reorder.isPending || remove.isPending;
  const full = vehicle.photos.length >= MAX_PHOTOS;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {vehicle.photos.length} de {MAX_PHOTOS} fotos · a primeira é a capa
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          data-testid="photo-input"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) upload.mutate(files);
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy || full}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="mr-2 h-4 w-4" />
          {progress
            ? `Enviando ${progress.done + 1} de ${progress.total}…`
            : "Adicionar fotos"}
        </Button>
      </div>

      {vehicle.photos.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhuma foto ainda. No celular, o botão abre a câmera ou a galeria.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="photo-list">
          {vehicle.photos.map((photo, index) => (
            <li key={photo.id} className="overflow-hidden rounded-lg border bg-muted/30">
              <div className="relative aspect-[4/3] bg-muted">
                {photo.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.url}
                    alt={`Foto ${index + 1}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : null}
                {index === 0 ? (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white">
                    <Star className="h-3 w-3" /> Capa
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-1 p-1.5">
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    aria-label="Mover para a esquerda"
                    disabled={busy || index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    aria-label="Mover para a direita"
                    disabled={busy || index === vehicle.photos.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  {index !== 0 ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label="Usar como capa"
                      disabled={busy}
                      onClick={() => move(index, 0)}
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive"
                  aria-label="Remover foto"
                  disabled={busy}
                  onClick={() => remove.mutate(photo.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
