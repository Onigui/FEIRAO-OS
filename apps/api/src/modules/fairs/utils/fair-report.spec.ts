import { buildFairReport, fairReportCsv } from './fair-report';

describe('buildFairReport', () => {
  const input = {
    stores: [
      { companyId: 'a', storeName: 'AF Veículos' },
      { companyId: 'b', storeName: 'Loja B; Centro' },
    ],
    vehicles: [
      {
        companyId: 'a',
        status: 'SOLD',
        soldDuringFair: true,
        priceCentsAtFair: 5_000_000,
      },
      {
        companyId: 'a',
        status: 'SOLD',
        soldDuringFair: false,
        priceCentsAtFair: 4_000_000,
      },
      {
        companyId: 'a',
        status: 'AVAILABLE',
        soldDuringFair: false,
        priceCentsAtFair: 3_000_000,
      },
      {
        companyId: 'b',
        status: 'SOLD',
        soldDuringFair: true,
        priceCentsAtFair: 7_000_000,
      },
      {
        companyId: 'b',
        status: 'SOLD',
        soldDuringFair: true,
        priceCentsAtFair: 2_000_000,
      },
    ],
    interestsByCompany: { a: 3, b: 1 },
    qrByCompany: { a: 10 },
    whatsappByCompany: { b: 4 },
    pageViews: 50,
  };

  it('soma por loja e no total, ordenando por vendidos', () => {
    const r = buildFairReport(input);
    expect(r.stores.map((s) => s.storeName)).toEqual([
      'Loja B; Centro',
      'AF Veículos',
    ]);
    expect(r.stores[1]).toEqual(
      expect.objectContaining({
        vehicles: 3,
        soldDuringFair: 1,
        soldValueCents: 5_000_000,
        interests: 3,
        qrScans: 10,
      }),
    );
    expect(r.totals).toEqual({
      stores: 2,
      vehicles: 5,
      soldDuringFair: 3,
      soldValueCents: 14_000_000,
      interests: 4,
      qrScans: 10,
      whatsappClicks: 4,
      pageViews: 50,
      conversionPct: 60,
    });
  });

  it('feirão vazio não divide por zero', () => {
    const r = buildFairReport({ ...input, vehicles: [], stores: [] });
    expect(r.totals.conversionPct).toBe(0);
  });

  it('CSV com ; e aspas onde precisa', () => {
    const csv = fairReportCsv(buildFairReport(input));
    const lines = csv.replace('﻿', '').trim().split('\n');
    expect(lines[0]).toBe(
      'Loja;Carros no feirão;Vendidos no feirão;Valor vendido (R$);Contatos;Leituras de QR;Cliques no WhatsApp',
    );
    expect(lines[1]).toBe('"Loja B; Centro";2;2;90000,00;1;0;4');
    expect(lines[3]).toBe('Total;5;3;140000,00;4;10;4');
  });
});
