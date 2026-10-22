/** Agregação pura do relatório do feirão (sem dado pessoal). */

export type ReportVehicleRow = {
  companyId: string;
  status: string;
  soldDuringFair: boolean;
  priceCentsAtFair: number;
};

export type ReportStoreRow = {
  companyId: string;
  storeName: string;
  vehicles: number;
  soldDuringFair: number;
  soldValueCents: number;
  interests: number;
  qrScans: number;
  whatsappClicks: number;
};

export type ReportTotals = Omit<ReportStoreRow, 'companyId' | 'storeName'> & {
  stores: number;
  pageViews: number;
  conversionPct: number;
};

export function buildFairReport(input: {
  stores: { companyId: string; storeName: string }[];
  vehicles: ReportVehicleRow[];
  interestsByCompany: Record<string, number>;
  qrByCompany: Record<string, number>;
  whatsappByCompany: Record<string, number>;
  pageViews: number;
}): { totals: ReportTotals; stores: ReportStoreRow[] } {
  const rows: ReportStoreRow[] = input.stores.map((s) => {
    const mine = input.vehicles.filter((v) => v.companyId === s.companyId);
    const sold = mine.filter((v) => v.soldDuringFair);
    return {
      companyId: s.companyId,
      storeName: s.storeName,
      vehicles: mine.length,
      soldDuringFair: sold.length,
      soldValueCents: sold.reduce((sum, v) => sum + v.priceCentsAtFair, 0),
      interests: input.interestsByCompany[s.companyId] ?? 0,
      qrScans: input.qrByCompany[s.companyId] ?? 0,
      whatsappClicks: input.whatsappByCompany[s.companyId] ?? 0,
    };
  });
  rows.sort(
    (a, b) =>
      b.soldDuringFair - a.soldDuringFair ||
      a.storeName.localeCompare(b.storeName),
  );

  const sum = (k: keyof ReportStoreRow) =>
    rows.reduce((acc, r) => acc + (r[k] as number), 0);
  const vehicles = sum('vehicles');
  const soldDuringFair = sum('soldDuringFair');
  return {
    stores: rows,
    totals: {
      stores: rows.length,
      vehicles,
      soldDuringFair,
      soldValueCents: sum('soldValueCents'),
      interests: sum('interests'),
      qrScans: sum('qrScans'),
      whatsappClicks: sum('whatsappClicks'),
      pageViews: input.pageViews,
      conversionPct: vehicles
        ? Math.round((soldDuringFair / vehicles) * 1000) / 10
        : 0,
    },
  };
}

const BOM = String.fromCharCode(0xfeff);

function csvCell(value: string | number): string {
  const s = String(value);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV com ";" (abre direto no Excel em português), BOM para acentos. */
export function fairReportCsv(
  report: ReturnType<typeof buildFairReport>,
): string {
  const header = [
    'Loja',
    'Carros no feirão',
    'Vendidos no feirão',
    'Valor vendido (R$)',
    'Contatos',
    'Leituras de QR',
    'Cliques no WhatsApp',
  ];
  const money = (c: number) => (c / 100).toFixed(2).replace('.', ',');
  const lines = report.stores.map((r) =>
    [
      r.storeName,
      r.vehicles,
      r.soldDuringFair,
      money(r.soldValueCents),
      r.interests,
      r.qrScans,
      r.whatsappClicks,
    ]
      .map(csvCell)
      .join(';'),
  );
  const t = report.totals;
  lines.push(
    [
      'Total',
      t.vehicles,
      t.soldDuringFair,
      money(t.soldValueCents),
      t.interests,
      t.qrScans,
      t.whatsappClicks,
    ]
      .map(csvCell)
      .join(';'),
  );
  return `${BOM}${[header.join(';'), ...lines].join('\n')}\n`;
}
