import { blockedLeadIdsFromInterests } from './automation-block';

describe('blockedLeadIdsFromInterests', () => {
  const at = new Date('2026-11-01T10:00:00Z');

  it('bloqueia quem veio da vitrine sem autorização de ofertas', () => {
    expect([
      ...blockedLeadIdsFromInterests([
        { leadId: 'a', consentMarketingAt: null },
      ]),
    ]).toEqual(['a']);
  });

  it('libera quando algum interesse tem autorização de ofertas', () => {
    const rows = [
      { leadId: 'a', consentMarketingAt: null },
      { leadId: 'a', consentMarketingAt: at },
    ];
    expect(blockedLeadIdsFromInterests(rows).size).toBe(0);
  });

  it('lead sem interesse não aparece (não é da vitrine)', () => {
    expect(blockedLeadIdsFromInterests([]).size).toBe(0);
  });

  it('separa leads', () => {
    const rows = [
      { leadId: 'a', consentMarketingAt: null },
      { leadId: 'b', consentMarketingAt: at },
      { leadId: 'c', consentMarketingAt: null },
    ];
    expect([...blockedLeadIdsFromInterests(rows)].sort()).toEqual(['a', 'c']);
  });
});
