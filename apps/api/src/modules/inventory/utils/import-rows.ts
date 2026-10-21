import { VehicleFuel, VehicleTransmission } from '@prisma/client';
import {
  normalizeHeaderKey,
  stripAccents,
} from '../../outbound/utils/parse-tabular';
import {
  INVENTORY_IMPORT_MAX_ROWS,
  VEHICLE_MILEAGE_MAX_KM,
  VEHICLE_PRICE_MAX_CENTS,
  VEHICLE_YEAR_MIN,
  type InventoryImportColumn,
} from '../inventory.constants';

export type VehicleImportRow = {
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
};

export type VehicleImportError = {
  /** Linha da planilha (1 = cabeçalho). */
  line: number;
  messages: string[];
};

export type VehicleImportPreview = {
  totalRows: number;
  valid: Array<{ line: number; vehicle: VehicleImportRow }>;
  errors: VehicleImportError[];
};

const HEADER_ALIASES: Record<string, InventoryImportColumn> = {
  marca: 'marca',
  fabricante: 'marca',
  modelo: 'modelo',
  versao: 'versao',
  ano_fabricacao: 'ano_fabricacao',
  ano_fab: 'ano_fabricacao',
  anofabricacao: 'ano_fabricacao',
  ano_modelo: 'ano_modelo',
  anomodelo: 'ano_modelo',
  ano: 'ano_modelo',
  preco: 'preco',
  valor: 'preco',
  preco_rs: 'preco',
  km: 'km',
  quilometragem: 'km',
  kilometragem: 'km',
  cambio: 'cambio',
  transmissao: 'cambio',
  combustivel: 'combustivel',
  carroceria: 'carroceria',
  categoria: 'carroceria',
  cor: 'cor',
  descricao: 'descricao',
  observacoes: 'descricao',
  obs: 'descricao',
};

const REQUIRED: InventoryImportColumn[] = [
  'marca',
  'modelo',
  'ano_fabricacao',
  'ano_modelo',
  'preco',
  'km',
  'cambio',
  'combustivel',
];

const LABEL: Record<InventoryImportColumn, string> = {
  marca: 'marca',
  modelo: 'modelo',
  versao: 'versão',
  ano_fabricacao: 'ano de fabricação',
  ano_modelo: 'ano do modelo',
  preco: 'preço',
  km: 'km',
  cambio: 'câmbio',
  combustivel: 'combustível',
  carroceria: 'carroceria',
  cor: 'cor',
  descricao: 'descrição',
};

function key(value: string): string {
  return stripAccents(value).trim().toLowerCase().replace(/\s+/g, ' ');
}

const TRANSMISSION: Record<string, VehicleTransmission> = {
  manual: VehicleTransmission.MANUAL,
  mecanico: VehicleTransmission.MANUAL,
  mecanica: VehicleTransmission.MANUAL,
  automatico: VehicleTransmission.AUTOMATIC,
  automatica: VehicleTransmission.AUTOMATIC,
  auto: VehicleTransmission.AUTOMATIC,
  at: VehicleTransmission.AUTOMATIC,
  cvt: VehicleTransmission.CVT,
  automatizado: VehicleTransmission.AUTOMATED,
  automatizada: VehicleTransmission.AUTOMATED,
};

const FUEL: Record<string, VehicleFuel> = {
  flex: VehicleFuel.FLEX,
  'alcool/gasolina': VehicleFuel.FLEX,
  'gasolina/alcool': VehicleFuel.FLEX,
  'etanol/gasolina': VehicleFuel.FLEX,
  'gasolina/etanol': VehicleFuel.FLEX,
  gasolina: VehicleFuel.GASOLINE,
  etanol: VehicleFuel.ETHANOL,
  alcool: VehicleFuel.ETHANOL,
  diesel: VehicleFuel.DIESEL,
  hibrido: VehicleFuel.HYBRID,
  hibrida: VehicleFuel.HYBRID,
  eletrico: VehicleFuel.ELECTRIC,
  eletrica: VehicleFuel.ELECTRIC,
};

export function parseTransmission(value: string): VehicleTransmission | null {
  const k = key(value);
  return (Object.values(VehicleTransmission) as string[]).includes(
    k.toUpperCase(),
  )
    ? (k.toUpperCase() as VehicleTransmission)
    : (TRANSMISSION[k] ?? null);
}

export function parseFuel(value: string): VehicleFuel | null {
  const k = key(value).replace(/\s*\/\s*/g, '/');
  return (Object.values(VehicleFuel) as string[]).includes(k.toUpperCase())
    ? (k.toUpperCase() as VehicleFuel)
    : (FUEL[k] ?? null);
}

/**
 * Preço em reais → centavos.
 * Aceita "R$ 59.900,00", "59.900", "59900", "59900,5", "59900.50".
 */
export function parsePriceToCents(value: string): number | null {
  let s = value.replace(/r\$/gi, '').replace(/\s/g, '').trim();
  if (!s || !/^[0-9.,]+$/.test(s)) return null;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes('.')) {
    const parts = s.split('.');
    const last = parts[parts.length - 1];
    // "59.900" / "1.059.900" → milhar; "59900.5" / "59900.50" → decimal
    s = parts.length > 2 || last.length === 3 ? parts.join('') : s;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

export function parseIntegerLoose(value: string): number | null {
  const s = value.replace(/km/gi, '').replace(/[\s.]/g, '').trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

/** Mapeia cabeçalhos da planilha para as colunas do modelo. */
export function mapImportHeaders(headers: string[]): {
  index: Partial<Record<InventoryImportColumn, number>>;
  missing: InventoryImportColumn[];
} {
  const index: Partial<Record<InventoryImportColumn, number>> = {};
  headers.forEach((header, i) => {
    const column = HEADER_ALIASES[normalizeHeaderKey(header)];
    if (column && index[column] === undefined) index[column] = i;
  });
  const missing = REQUIRED.filter((c) => index[c] === undefined);
  return { index, missing };
}

export function missingColumnsMessage(
  missing: InventoryImportColumn[],
): string {
  return `Colunas obrigatórias ausentes: ${missing.map((m) => LABEL[m]).join(', ')}`;
}

function optionalText(value: string | undefined, max: number): string | null {
  const t = (value ?? '').trim();
  return t ? t.slice(0, max) : null;
}

export function validateImportRows(
  headers: string[],
  rows: string[][],
  now: Date = new Date(),
): VehicleImportPreview {
  const { index, missing } = mapImportHeaders(headers);
  if (missing.length > 0) {
    throw new Error(missingColumnsMessage(missing));
  }
  if (rows.length > INVENTORY_IMPORT_MAX_ROWS) {
    throw new Error(
      `A planilha passa do limite de ${INVENTORY_IMPORT_MAX_ROWS} linhas`,
    );
  }

  const maxYear = now.getFullYear() + 1;
  const cell = (row: string[], c: InventoryImportColumn) =>
    index[c] === undefined ? '' : (row[index[c]] ?? '').trim();

  const valid: VehicleImportPreview['valid'] = [];
  const errors: VehicleImportError[] = [];

  rows.forEach((row, i) => {
    const line = i + 2;
    const messages: string[] = [];

    const make = cell(row, 'marca');
    const model = cell(row, 'modelo');
    if (!make) messages.push('marca vazia');
    else if (make.length > 60) messages.push('marca com mais de 60 caracteres');
    if (!model) messages.push('modelo vazio');
    else if (model.length > 80)
      messages.push('modelo com mais de 80 caracteres');

    const yearManufacture = parseIntegerLoose(cell(row, 'ano_fabricacao'));
    const yearModel = parseIntegerLoose(cell(row, 'ano_modelo'));
    const manufactureOk =
      yearManufacture !== null &&
      yearManufacture >= VEHICLE_YEAR_MIN &&
      yearManufacture <= maxYear;
    const modelOk =
      yearModel !== null &&
      yearModel >= VEHICLE_YEAR_MIN &&
      yearModel <= maxYear;
    if (!manufactureOk) messages.push('ano de fabricação inválido');
    if (!modelOk) messages.push('ano do modelo inválido');
    if (
      manufactureOk &&
      modelOk &&
      (yearModel < yearManufacture || yearModel > yearManufacture + 1)
    ) {
      messages.push(
        'ano do modelo deve ser igual ou 1 a mais que o de fabricação',
      );
    }

    const priceCents = parsePriceToCents(cell(row, 'preco'));
    if (
      priceCents === null ||
      priceCents <= 0 ||
      priceCents > VEHICLE_PRICE_MAX_CENTS
    ) {
      messages.push('preço inválido');
    }
    const mileageKm = parseIntegerLoose(cell(row, 'km'));
    if (mileageKm === null || mileageKm > VEHICLE_MILEAGE_MAX_KM) {
      messages.push('km inválido');
    }

    const transmissionRaw = cell(row, 'cambio');
    const transmission = transmissionRaw
      ? parseTransmission(transmissionRaw)
      : null;
    if (!transmission)
      messages.push(
        `câmbio não reconhecido${transmissionRaw ? ` ("${transmissionRaw}")` : ''}`,
      );

    const fuelRaw = cell(row, 'combustivel');
    const fuel = fuelRaw ? parseFuel(fuelRaw) : null;
    if (!fuel)
      messages.push(
        `combustível não reconhecido${fuelRaw ? ` ("${fuelRaw}")` : ''}`,
      );

    if (messages.length > 0) {
      errors.push({ line, messages });
      return;
    }
    valid.push({
      line,
      vehicle: {
        make,
        model,
        version: optionalText(cell(row, 'versao'), 120),
        yearManufacture: yearManufacture as number,
        yearModel: yearModel as number,
        priceCents: priceCents as number,
        mileageKm: mileageKm as number,
        transmission: transmission as VehicleTransmission,
        fuel: fuel as VehicleFuel,
        bodyType: optionalText(cell(row, 'carroceria'), 40),
        color: optionalText(cell(row, 'cor'), 40),
        description: optionalText(cell(row, 'descricao'), 5000),
      },
    });
  });

  return { totalRows: rows.length, valid, errors };
}
