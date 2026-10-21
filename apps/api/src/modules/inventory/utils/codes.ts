import { randomInt } from 'node:crypto';
import { stripAccents } from '../../outbound/utils/parse-tabular';

/** Sem caracteres ambíguos (0/O, 1/I/l). */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Código curto e aleatório (QR da vitrine e do feirão). Não carrega dado da loja nem do carro. */
export function generateShortCode(length = 8): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

export function slugify(value: string): string {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** make-model-yearModel-<6 aleatórios>, até 160 caracteres. */
export function buildVehicleSlug(input: {
  make: string;
  model: string;
  yearModel: number;
}): string {
  const base = [
    slugify(input.make),
    slugify(input.model),
    String(input.yearModel),
  ]
    .filter(Boolean)
    .join('-');
  return `${base}-${generateShortCode(6).toLowerCase()}`.slice(0, 160);
}
