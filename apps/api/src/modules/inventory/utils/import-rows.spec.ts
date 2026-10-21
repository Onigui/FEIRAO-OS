import { VehicleFuel, VehicleTransmission } from '@prisma/client';
import {
  mapImportHeaders,
  parseFuel,
  parseIntegerLoose,
  parsePriceToCents,
  parseTransmission,
  validateImportRows,
} from './import-rows';

const NOW = new Date('2026-10-21T12:00:00Z');
const HEADERS = [
  'Marca',
  'Modelo',
  'Versão',
  'Ano Fabricação',
  'Ano Modelo',
  'Preço',
  'KM',
  'Câmbio',
  'Combustível',
  'Carroceria',
  'Cor',
  'Descrição',
];
const row = (over: Partial<Record<number, string>> = {}) => {
  const base = [
    'Volkswagen',
    'Gol',
    '1.0',
    '2020',
    '2021',
    'R$ 59.900,00',
    '45.000',
    'manual',
    'flex',
    'Hatch',
    'Prata',
    'Revisado',
  ];
  Object.entries(over).forEach(([i, v]) => (base[Number(i)] = v as string));
  return base;
};

describe('parsePriceToCents', () => {
  it.each([
    ['R$ 59.900,00', 5_990_000],
    ['59.900', 5_990_000],
    ['59900', 5_990_000],
    ['59900,5', 5_990_050],
    ['59900.50', 5_990_050],
    ['1.059.900', 105_990_000],
    ['R$59.900', 5_990_000],
  ])('%s → %d', (input, cents) => {
    expect(parsePriceToCents(input)).toBe(cents);
  });

  it.each(['', 'abc', '59,900,00', '-100', '1.2.3,4.5,6'])(
    'rejeita %p',
    (input) => {
      expect(parsePriceToCents(input)).toBeNull();
    },
  );
});

describe('parseIntegerLoose', () => {
  it.each([
    ['45.000', 45000],
    ['45000 km', 45000],
    ['0', 0],
  ])('%s → %d', (i, o) => expect(parseIntegerLoose(i)).toBe(o));
  it.each(['', '4,5', 'mil'])('rejeita %p', (i) =>
    expect(parseIntegerLoose(i)).toBeNull(),
  );
});

describe('câmbio e combustível em português', () => {
  it.each([
    ['Manual', VehicleTransmission.MANUAL],
    ['Automático', VehicleTransmission.AUTOMATIC],
    ['CVT', VehicleTransmission.CVT],
    ['automatizado', VehicleTransmission.AUTOMATED],
    ['AUTOMATIC', VehicleTransmission.AUTOMATIC],
  ])('câmbio %s', (i, o) => expect(parseTransmission(i)).toBe(o));
  it('câmbio desconhecido', () =>
    expect(parseTransmission('sequencial')).toBeNull());

  it.each([
    ['Flex', VehicleFuel.FLEX],
    ['Álcool/Gasolina', VehicleFuel.FLEX],
    ['gasolina', VehicleFuel.GASOLINE],
    ['Etanol', VehicleFuel.ETHANOL],
    ['álcool', VehicleFuel.ETHANOL],
    ['Diesel', VehicleFuel.DIESEL],
    ['Híbrido', VehicleFuel.HYBRID],
    ['Elétrico', VehicleFuel.ELECTRIC],
  ])('combustível %s', (i, o) => expect(parseFuel(i)).toBe(o));
});

describe('mapImportHeaders', () => {
  it('reconhece cabeçalhos com acento e sinônimos', () => {
    const { index, missing } = mapImportHeaders([
      'Fabricante',
      'Modelo',
      'Ano',
      'Ano Fab',
      'Valor',
      'Quilometragem',
      'Transmissão',
      'Combustível',
    ]);
    expect(missing).toEqual([]);
    expect(index.marca).toBe(0);
    expect(index.ano_modelo).toBe(2);
    expect(index.preco).toBe(4);
  });

  it('lista colunas obrigatórias ausentes', () => {
    expect(mapImportHeaders(['marca', 'modelo']).missing).toEqual([
      'ano_fabricacao',
      'ano_modelo',
      'preco',
      'km',
      'cambio',
      'combustivel',
    ]);
  });
});

describe('validateImportRows', () => {
  it('converte uma linha válida', () => {
    const result = validateImportRows(HEADERS, [row()], NOW);
    expect(result.errors).toEqual([]);
    expect(result.valid).toEqual([
      {
        line: 2,
        vehicle: {
          make: 'Volkswagen',
          model: 'Gol',
          version: '1.0',
          yearManufacture: 2020,
          yearModel: 2021,
          priceCents: 5_990_000,
          mileageKm: 45000,
          transmission: VehicleTransmission.MANUAL,
          fuel: VehicleFuel.FLEX,
          bodyType: 'Hatch',
          color: 'Prata',
          description: 'Revisado',
        },
      },
    ]);
  });

  it('separa válidas de inválidas com a linha da planilha e mensagens em português', () => {
    const rows = [
      row(),
      row({ 0: '', 5: 'barato' }),
      row({ 3: '2020', 4: '2023' }),
      row({ 7: 'sequencial', 8: 'gás' }),
      row({ 3: '1900' }),
    ];
    const result = validateImportRows(HEADERS, rows, NOW);
    expect(result.totalRows).toBe(5);
    expect(result.valid.map((v) => v.line)).toEqual([2]);
    expect(result.errors).toEqual([
      { line: 3, messages: ['marca vazia', 'preço inválido'] },
      {
        line: 4,
        messages: [
          'ano do modelo deve ser igual ou 1 a mais que o de fabricação',
        ],
      },
      {
        line: 5,
        messages: [
          'câmbio não reconhecido ("sequencial")',
          'combustível não reconhecido ("gás")',
        ],
      },
      { line: 6, messages: ['ano de fabricação inválido'] },
    ]);
  });

  it('aceita ano-modelo do ano que vem e recusa dois anos à frente', () => {
    expect(
      validateImportRows(HEADERS, [row({ 3: '2027', 4: '2027' })], NOW).valid,
    ).toHaveLength(1);
    expect(
      validateImportRows(HEADERS, [row({ 3: '2028', 4: '2028' })], NOW).errors,
    ).toHaveLength(1);
  });

  it('campos opcionais vazios viram null', () => {
    const r = validateImportRows(
      HEADERS,
      [row({ 2: '', 9: '', 10: '', 11: '' })],
      NOW,
    );
    expect(r.valid[0].vehicle).toMatchObject({
      version: null,
      bodyType: null,
      color: null,
      description: null,
    });
  });

  it('erro claro quando faltam colunas', () => {
    expect(() => validateImportRows(['marca', 'modelo'], [], NOW)).toThrow(
      /Colunas obrigatórias ausentes: ano de fabricação/,
    );
  });

  it('recusa mais de 500 linhas', () => {
    expect(() =>
      validateImportRows(
        HEADERS,
        Array.from({ length: 501 }, () => row()),
        NOW,
      ),
    ).toThrow(/500 linhas/);
  });
});
