import { retentionCutoff } from './showcase-retention.service';

describe('retentionCutoff', () => {
  it('volta N meses', () => {
    expect(
      retentionCutoff(new Date('2027-11-21T12:00:00Z'), 12).toISOString(),
    ).toBe('2026-11-21T12:00:00.000Z');
    expect(
      retentionCutoff(new Date('2027-03-15T00:00:00Z'), 6).toISOString(),
    ).toBe('2026-09-15T00:00:00.000Z');
  });
});
