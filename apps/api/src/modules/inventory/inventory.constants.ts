/** Vitrine e Feirões — estoque. */

export const VEHICLE_MAX_PHOTOS = 15;
export const VEHICLE_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const VEHICLE_PHOTO_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export const VEHICLE_PHOTO_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Janela para desfazer uma venda (SOLD → AVAILABLE). */
export const VEHICLE_SOLD_UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

export const INVENTORY_IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const INVENTORY_IMPORT_MAX_ROWS = 500;

/** Colunas do modelo de planilha, na ordem em que aparecem. */
export const INVENTORY_IMPORT_COLUMNS = [
  'marca',
  'modelo',
  'versao',
  'ano_fabricacao',
  'ano_modelo',
  'preco',
  'km',
  'cambio',
  'combustivel',
  'carroceria',
  'cor',
  'descricao',
] as const;

export type InventoryImportColumn = (typeof INVENTORY_IMPORT_COLUMNS)[number];

export const VEHICLE_YEAR_MIN = 1950;
/** Ano máximo aceito = ano atual + 1 (ano-modelo). */
export const VEHICLE_PRICE_MAX_CENTS = 2_000_000_000; // R$ 20 milhões
export const VEHICLE_MILEAGE_MAX_KM = 2_000_000;

export const AUDIT_TARGET_VEHICLE = 'VEHICLE';
