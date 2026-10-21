import { PHOTO_JPEG_QUALITY, PHOTO_MAX_SIDE } from "@/features/inventory/constants";

export type CompressedPhoto = { blob: Blob; width: number; height: number };

/** Lado maior até `maxSide`, mantendo proporção. */
export function fitWithin(width: number, height: number, maxSide = PHOTO_MAX_SIDE) {
  const largest = Math.max(width, height);
  if (largest <= maxSide) return { width, height };
  const scale = maxSide / largest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Comprime a foto no navegador antes do envio (economiza dados no 4G e espaço no R2).
 * Respeita a orientação EXIF via createImageBitmap({ imageOrientation: "from-image" }).
 */
export async function compressPhoto(file: File): Promise<CompressedPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Seu navegador não conseguiu processar a foto.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", PHOTO_JPEG_QUALITY),
    );
    if (!blob) throw new Error("Não foi possível comprimir a foto.");
    return { blob, width, height };
  } finally {
    bitmap.close();
  }
}
