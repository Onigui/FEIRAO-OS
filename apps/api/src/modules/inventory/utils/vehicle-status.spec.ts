import { MembershipRole, VehicleStatus } from '@prisma/client';
import { checkVehicleStatusTransition } from './vehicle-status';

const { AVAILABLE, RESERVED, SOLD, ARCHIVED } = VehicleStatus;
const { OWNER, ADMIN, AGENT } = MembershipRole;
const now = new Date('2026-11-20T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);

describe('checkVehicleStatusTransition', () => {
  it.each([
    [AVAILABLE, RESERVED],
    [AVAILABLE, SOLD],
    [AVAILABLE, ARCHIVED],
    [RESERVED, AVAILABLE],
    [RESERVED, SOLD],
    [RESERVED, ARCHIVED],
    [SOLD, ARCHIVED],
  ])('AGENT pode %s → %s', (from, to) => {
    expect(
      checkVehicleStatusTransition({
        from,
        to,
        role: AGENT,
        soldAt: hoursAgo(1),
        now,
      }),
    ).toEqual({ ok: true });
  });

  it.each([AVAILABLE, RESERVED, SOLD, ARCHIVED])(
    'mesmo status %s é recusado',
    (s) => {
      const r = checkVehicleStatusTransition({
        from: s,
        to: s,
        role: OWNER,
        soldAt: null,
        now,
      });
      expect(r).toMatchObject({ ok: false, code: 'SAME_STATUS' });
    },
  );

  it.each([
    [SOLD, RESERVED],
    [ARCHIVED, SOLD],
    [ARCHIVED, RESERVED],
  ])('%s → %s não é permitido', (from, to) => {
    const r = checkVehicleStatusTransition({
      from,
      to,
      role: OWNER,
      soldAt: hoursAgo(1),
      now,
    });
    expect(r).toMatchObject({ ok: false, code: 'NOT_ALLOWED' });
  });

  describe('desfazer venda (SOLD → AVAILABLE)', () => {
    it.each([OWNER, ADMIN])('%s pode dentro de 24h', (role) => {
      expect(
        checkVehicleStatusTransition({
          from: SOLD,
          to: AVAILABLE,
          role,
          soldAt: hoursAgo(23.9),
          now,
        }),
      ).toEqual({ ok: true });
    });

    it('AGENT não pode', () => {
      expect(
        checkVehicleStatusTransition({
          from: SOLD,
          to: AVAILABLE,
          role: AGENT,
          soldAt: hoursAgo(1),
          now,
        }),
      ).toMatchObject({ ok: false, code: 'ROLE' });
    });

    it('depois de 24h ninguém pode', () => {
      expect(
        checkVehicleStatusTransition({
          from: SOLD,
          to: AVAILABLE,
          role: OWNER,
          soldAt: hoursAgo(24.1),
          now,
        }),
      ).toMatchObject({ ok: false, code: 'UNDO_WINDOW' });
    });

    it('sem soldAt não pode', () => {
      expect(
        checkVehicleStatusTransition({
          from: SOLD,
          to: AVAILABLE,
          role: OWNER,
          soldAt: null,
          now,
        }),
      ).toMatchObject({ ok: false, code: 'UNDO_WINDOW' });
    });
  });

  describe('desarquivar (ARCHIVED → AVAILABLE)', () => {
    it('OWNER pode', () => {
      expect(
        checkVehicleStatusTransition({
          from: ARCHIVED,
          to: AVAILABLE,
          role: OWNER,
          soldAt: null,
          now,
        }),
      ).toEqual({ ok: true });
    });
    it('AGENT não pode', () => {
      expect(
        checkVehicleStatusTransition({
          from: ARCHIVED,
          to: AVAILABLE,
          role: AGENT,
          soldAt: null,
          now,
        }),
      ).toMatchObject({ ok: false, code: 'ROLE' });
    });
  });
});
