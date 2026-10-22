import { FairStatus } from '@prisma/client';
import {
  canAdvanceFair,
  isFairFrozen,
  nextFairStatus,
  soldDuringFair,
} from './fair-status';

describe('fair status', () => {
  it('avança um passo por vez', () => {
    expect(nextFairStatus(FairStatus.DRAFT)).toBe(FairStatus.PUBLISHED);
    expect(nextFairStatus(FairStatus.PUBLISHED)).toBe(FairStatus.LIVE);
    expect(nextFairStatus(FairStatus.LIVE)).toBe(FairStatus.ENDED);
    expect(nextFairStatus(FairStatus.ENDED)).toBeNull();
  });

  it.each([
    [FairStatus.DRAFT, FairStatus.LIVE],
    [FairStatus.DRAFT, FairStatus.ENDED],
    [FairStatus.LIVE, FairStatus.PUBLISHED],
    [FairStatus.ENDED, FairStatus.LIVE],
    [FairStatus.PUBLISHED, FairStatus.PUBLISHED],
  ])('não deixa %s → %s', (from, to) => {
    expect(canAdvanceFair(from, to)).toBe(false);
  });

  it('congela só depois de encerrado', () => {
    expect(isFairFrozen(FairStatus.LIVE)).toBe(false);
    expect(isFairFrozen(FairStatus.ENDED)).toBe(true);
  });

  it('vendido no feirão = sold_at dentro do período', () => {
    const fair = {
      startsAt: new Date('2026-11-21T11:00:00Z'),
      endsAt: new Date('2026-11-21T21:00:00Z'),
    };
    expect(soldDuringFair(new Date('2026-11-21T15:00:00Z'), fair)).toBe(true);
    expect(soldDuringFair(new Date('2026-11-21T11:00:00Z'), fair)).toBe(true);
    expect(soldDuringFair(new Date('2026-11-20T15:00:00Z'), fair)).toBe(false);
    expect(soldDuringFair(new Date('2026-11-22T00:00:00Z'), fair)).toBe(false);
    expect(soldDuringFair(null, fair)).toBe(false);
  });
});
