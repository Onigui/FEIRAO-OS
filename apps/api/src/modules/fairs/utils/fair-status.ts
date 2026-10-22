import { FairStatus } from '@prisma/client';

/** Status do feirão só avança, um passo por vez: DRAFT → PUBLISHED → LIVE → ENDED. */
const NEXT: Record<FairStatus, FairStatus | null> = {
  DRAFT: FairStatus.PUBLISHED,
  PUBLISHED: FairStatus.LIVE,
  LIVE: FairStatus.ENDED,
  ENDED: null,
};

export function nextFairStatus(from: FairStatus): FairStatus | null {
  return NEXT[from];
}

export function canAdvanceFair(from: FairStatus, to: FairStatus): boolean {
  return NEXT[from] === to;
}

/** Depois de ENDED a lista de carros congela. */
export function isFairFrozen(status: FairStatus): boolean {
  return status === FairStatus.ENDED;
}

/** "Vendido no feirão": sold_at entre o início e o fim do evento. */
export function soldDuringFair(
  soldAt: Date | null,
  fair: { startsAt: Date; endsAt: Date },
): boolean {
  if (!soldAt) return false;
  const t = soldAt.getTime();
  return t >= fair.startsAt.getTime() && t <= fair.endsAt.getTime();
}
