/**
 * Regra da seção 7 do design: lead que veio da vitrine (tem pelo menos um
 * interesse) e nunca autorizou ofertas fica fora das automações proativas.
 */
export function blockedLeadIdsFromInterests(
  rows: { leadId: string; consentMarketingAt: Date | null }[],
): Set<string> {
  const fromShowcase = new Set<string>();
  const consented = new Set<string>();
  for (const row of rows) {
    fromShowcase.add(row.leadId);
    if (row.consentMarketingAt) consented.add(row.leadId);
  }
  return new Set([...fromShowcase].filter((id) => !consented.has(id)));
}
