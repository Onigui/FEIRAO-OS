import { buildVehicleSlug, generateShortCode, slugify } from './codes';

describe('codes', () => {
  it('gera código de 8 caracteres sem ambíguos', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateShortCode(8);
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    }
  });

  it('códigos são variados', () => {
    const set = new Set(
      Array.from({ length: 500 }, () => generateShortCode(8)),
    );
    expect(set.size).toBe(500);
  });

  it('slugify remove acentos e símbolos', () => {
    expect(slugify('  Citroën C4 Cactus — Série Ç  ')).toBe(
      'citroen-c4-cactus-serie-c',
    );
  });

  it('slug do veículo tem marca, modelo, ano e sufixo aleatório', () => {
    expect(
      buildVehicleSlug({
        make: 'Volkswagen',
        model: 'T-Cross 200 TSI',
        yearModel: 2022,
      }),
    ).toMatch(/^volkswagen-t-cross-200-tsi-2022-[a-hj-np-z2-9]{6}$/);
  });
});
