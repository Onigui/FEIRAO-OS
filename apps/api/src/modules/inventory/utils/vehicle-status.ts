import { MembershipRole, VehicleStatus } from '@prisma/client';
import { VEHICLE_SOLD_UNDO_WINDOW_MS } from '../inventory.constants';

export type StatusTransitionInput = {
  from: VehicleStatus;
  to: VehicleStatus;
  role: MembershipRole;
  soldAt: Date | null;
  now?: Date;
};

export type StatusTransitionCheck =
  | { ok: true }
  | {
      ok: false;
      code: 'SAME_STATUS' | 'NOT_ALLOWED' | 'ROLE' | 'UNDO_WINDOW';
      message: string;
    };

const MANAGER_ROLES: MembershipRole[] = [
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
];

const ALLOWED: Record<VehicleStatus, VehicleStatus[]> = {
  [VehicleStatus.AVAILABLE]: [
    VehicleStatus.RESERVED,
    VehicleStatus.SOLD,
    VehicleStatus.ARCHIVED,
  ],
  [VehicleStatus.RESERVED]: [
    VehicleStatus.AVAILABLE,
    VehicleStatus.SOLD,
    VehicleStatus.ARCHIVED,
  ],
  [VehicleStatus.SOLD]: [VehicleStatus.AVAILABLE, VehicleStatus.ARCHIVED],
  [VehicleStatus.ARCHIVED]: [VehicleStatus.AVAILABLE],
};

/**
 * Regras de status do veículo:
 * - SOLD → AVAILABLE (desfazer venda): só OWNER/ADMIN e até 24h após soldAt.
 * - ARCHIVED → AVAILABLE (desarquivar): só OWNER/ADMIN.
 * - Demais transições permitidas para qualquer papel da loja.
 */
export function checkVehicleStatusTransition(
  input: StatusTransitionInput,
): StatusTransitionCheck {
  const { from, to, role } = input;
  const now = input.now ?? new Date();

  if (from === to) {
    return {
      ok: false,
      code: 'SAME_STATUS',
      message: 'O veículo já está neste status',
    };
  }
  if (!ALLOWED[from].includes(to)) {
    return {
      ok: false,
      code: 'NOT_ALLOWED',
      message: `Transição ${from} → ${to} não permitida`,
    };
  }
  if (from === VehicleStatus.SOLD && to === VehicleStatus.AVAILABLE) {
    if (!MANAGER_ROLES.includes(role)) {
      return {
        ok: false,
        code: 'ROLE',
        message: 'Só dono ou gerente pode desfazer uma venda',
      };
    }
    if (
      !input.soldAt ||
      now.getTime() - input.soldAt.getTime() > VEHICLE_SOLD_UNDO_WINDOW_MS
    ) {
      return {
        ok: false,
        code: 'UNDO_WINDOW',
        message: 'A venda só pode ser desfeita até 24 horas depois',
      };
    }
  }
  if (from === VehicleStatus.ARCHIVED && !MANAGER_ROLES.includes(role)) {
    return {
      ok: false,
      code: 'ROLE',
      message: 'Só dono ou gerente pode desarquivar',
    };
  }
  return { ok: true };
}
