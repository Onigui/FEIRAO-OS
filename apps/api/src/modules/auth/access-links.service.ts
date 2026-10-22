import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CompanyStatus, MembershipRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { runWithTenant } from '../../core/tenancy/tenant-als';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  MEMBERSHIP_STATUS_ACTIVE,
  MEMBERSHIP_STATUS_INVITED,
  MEMBERSHIP_STATUS_REVOKED,
} from './auth.constants';
import { AuthRevocationService } from './auth-revocation.service';
import type { CompleteAccessLinkDto } from './dto/complete-access-link.dto';
import { assertPasswordPolicy } from './password-policy';
import type { AuthenticatedUser } from './types/jwt-payload';

export const ACCESS_LINK_INVITE = 'INVITE';
export const ACCESS_LINK_PASSWORD_RESET = 'PASSWORD_RESET';
export type AccessLinkPurpose =
  typeof ACCESS_LINK_INVITE | typeof ACCESS_LINK_PASSWORD_RESET;

export const ACCESS_LINK_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const ACCESS_LINK_RESET_TTL_MS = 24 * 60 * 60 * 1000;

/** SET_PASSWORD: cria/troca a senha. CONFIRM_EXISTING: já tem conta, confirma com a senha atual. */
export type AccessLinkMode = 'SET_PASSWORD' | 'CONFIRM_EXISTING';

type CompanyActor = AuthenticatedUser & {
  cid: string;
  sub: string;
  role: MembershipRole;
};

type RequestMeta = { ip?: string; userAgent?: string };

const INVALID_LINK = {
  code: 'ACCESS_LINK_INVALID',
  message: 'Este link não vale mais. Peça um novo link para a loja.',
};

export function hashAccessToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Etapa 6 — acesso da equipe sem e-mail: o dono/gerente gera um link de uso único e
 * manda por WhatsApp. O link ativa o convite (define a senha) ou redefine a senha.
 *
 * Proteções contra tomada de conta:
 * - Quem já tem senha nunca recebe uma nova pelo convite de outra loja: confirma com a senha atual.
 * - Redefinir só para quem não está ativo em outra loja (senão uma loja trocaria a senha usada na outra).
 * - Gerente não gera link para o dono; ninguém gera para si mesmo (usa "Trocar senha").
 * - Só o hash do token fica no banco; gerar um link novo cancela o anterior.
 */
@Injectable()
export class AccessLinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly revocation: AuthRevocationService,
  ) {}

  async createForMembership(
    actor: CompanyActor,
    membershipId: string,
    meta?: RequestMeta,
  ) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, companyId: actor.cid, deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            deletedAt: true,
          },
        },
      },
    });
    if (!membership || membership.user.deletedAt) {
      throw new NotFoundException('Membership not found');
    }
    if (membership.status === MEMBERSHIP_STATUS_REVOKED) {
      throw new ConflictException({
        code: 'MEMBERSHIP_REVOKED',
        message: 'Essa pessoa foi removida da equipe. Convide de novo.',
      });
    }
    if (membership.userId === actor.sub) {
      throw new BadRequestException({
        code: 'USE_CHANGE_PASSWORD',
        message: 'Para a sua própria senha, use Configurações → Minha senha.',
      });
    }
    if (
      membership.role === MembershipRole.OWNER &&
      actor.role !== MembershipRole.OWNER
    ) {
      throw new ForbiddenException({
        code: 'OWNER_ONLY',
        message: 'Só o dono pode gerar link de acesso para outro dono.',
      });
    }

    const purpose: AccessLinkPurpose =
      membership.status === MEMBERSHIP_STATUS_INVITED
        ? ACCESS_LINK_INVITE
        : ACCESS_LINK_PASSWORD_RESET;

    if (purpose === ACCESS_LINK_PASSWORD_RESET) {
      // Consulta entre lojas: sai do contexto da loja (memberships não tem RLS).
      const elsewhere = await runWithTenant(
        undefined,
        async () =>
          await this.prisma.membership.count({
            where: {
              userId: membership.userId,
              companyId: { not: actor.cid },
              status: MEMBERSHIP_STATUS_ACTIVE,
              deletedAt: null,
            },
          }),
      );
      if (elsewhere > 0) {
        throw new ConflictException({
          code: 'USER_IN_OTHER_COMPANY',
          message:
            'Essa pessoa também usa outra loja. Peça para ela trocar a senha em Configurações → Minha senha.',
        });
      }
    }

    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() +
        (purpose === ACCESS_LINK_INVITE
          ? ACCESS_LINK_INVITE_TTL_MS
          : ACCESS_LINK_RESET_TTL_MS),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.accessLink.updateMany({
        where: { membershipId: membership.id, usedAt: null, revokedAt: null },
        data: { revokedAt: now },
      });
      const link = await tx.accessLink.create({
        data: {
          userId: membership.userId,
          companyId: actor.cid,
          membershipId: membership.id,
          purpose,
          tokenHash: hashAccessToken(token),
          expiresAt,
          createdById: actor.sub,
        },
        select: { id: true },
      });
      await this.audit.write(tx, {
        companyId: actor.cid,
        actorUserId: actor.sub,
        action: 'ACCESS_LINK_CREATE',
        targetType: 'MEMBERSHIP',
        targetId: membership.id,
        before: null,
        after: {
          accessLinkId: link.id,
          purpose,
          expiresAt: expiresAt.toISOString(),
        },
        ip: meta?.ip,
        userAgent: meta?.userAgent,
      });
    });

    return {
      token,
      purpose,
      expiresAt,
      email: membership.user.email,
      name: membership.user.name,
    };
  }

  /** Público: o que a tela /acesso/[token] precisa mostrar. */
  async describe(token: string) {
    const link = await this.findUsableLink(token);
    return {
      purpose: link.purpose as AccessLinkPurpose,
      mode: this.modeFor(link),
      email: link.user.email,
      name: link.user.name,
      companyName: link.company.name,
      expiresAt: link.expiresAt,
    };
  }

  /** Público: define a senha / confirma a conta e ativa o acesso. Uso único. */
  async complete(
    token: string,
    dto: CompleteAccessLinkDto,
    meta?: RequestMeta,
  ) {
    const link = await this.findUsableLink(token);
    const mode = this.modeFor(link);
    let newHash: string | null = null;

    if (mode === 'SET_PASSWORD') {
      if (!dto.password) {
        throw new BadRequestException({
          code: 'PASSWORD_REQUIRED',
          message: 'Escolha uma senha.',
        });
      }
      assertPasswordPolicy(dto.password, link.user.email);
      newHash = await argon2.hash(dto.password);
    } else {
      const ok =
        !!dto.currentPassword &&
        !!link.user.passwordHash &&
        (await argon2.verify(link.user.passwordHash, dto.currentPassword));
      if (!ok) {
        throw new UnauthorizedException({
          code: 'INVALID_CURRENT_PASSWORD',
          message: 'Senha incorreta. Use a senha que você já usa para entrar.',
        });
      }
    }

    const now = new Date();
    const isInvite = link.purpose === ACCESS_LINK_INVITE;

    await runWithTenant(
      link.companyId,
      async () =>
        await this.prisma.$transaction(async (tx) => {
          // Reivindica o link de forma atômica: dois envios ao mesmo tempo → só um passa.
          const claimed = await tx.accessLink.updateMany({
            where: {
              id: link.id,
              usedAt: null,
              revokedAt: null,
              expiresAt: { gt: now },
            },
            data: { usedAt: now },
          });
          if (claimed.count !== 1) {
            throw new NotFoundException(INVALID_LINK);
          }

          if (newHash) {
            await tx.user.update({
              where: { id: link.userId },
              data: { passwordHash: newHash, status: UserStatus.ACTIVE },
            });
          }
          if (isInvite) {
            await tx.membership.update({
              where: { id: link.membershipId },
              data: { status: MEMBERSHIP_STATUS_ACTIVE, joinedAt: now },
            });
          }

          await this.audit.write(tx, {
            companyId: link.companyId,
            actorUserId: link.userId,
            action: isInvite
              ? 'ACCESS_LINK_INVITE_ACCEPT'
              : 'ACCESS_LINK_PASSWORD_RESET',
            targetType: 'USER',
            targetId: link.userId,
            before: null,
            after: {
              accessLinkId: link.id,
              mode,
              membershipId: link.membershipId,
            },
            ip: meta?.ip,
            userAgent: meta?.userAgent,
          });
        }),
    );

    if (newHash && !isInvite) {
      // Senha redefinida: encerra todas as sessões abertas (ex.: celular perdido).
      await this.revocation.logoutAllDevices(link.userId);
    } else {
      await this.revocation.invalidateAccessCacheForUser(link.userId);
    }

    return { ok: true as const, email: link.user.email, purpose: link.purpose };
  }

  private modeFor(link: {
    purpose: string;
    user: { passwordHash: string | null };
  }): AccessLinkMode {
    if (link.purpose === ACCESS_LINK_INVITE && link.user.passwordHash) {
      return 'CONFIRM_EXISTING';
    }
    return 'SET_PASSWORD';
  }

  private async findUsableLink(token: string) {
    if (!token || token.length < 20 || token.length > 100) {
      throw new NotFoundException(INVALID_LINK);
    }
    const link = await this.prisma.accessLink.findUnique({
      where: { tokenHash: hashAccessToken(token) },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            deletedAt: true,
          },
        },
        company: {
          select: { id: true, name: true, status: true, deletedAt: true },
        },
        membership: {
          select: { id: true, status: true, deletedAt: true },
        },
      },
    });

    const now = Date.now();
    const usable =
      link &&
      !link.usedAt &&
      !link.revokedAt &&
      link.expiresAt.getTime() > now &&
      !link.user.deletedAt &&
      !link.company.deletedAt &&
      link.company.status === CompanyStatus.ACTIVE &&
      !link.membership.deletedAt &&
      link.membership.status !== MEMBERSHIP_STATUS_REVOKED &&
      (link.purpose !== ACCESS_LINK_INVITE ||
        link.membership.status === MEMBERSHIP_STATUS_INVITED);

    if (!usable) {
      throw new NotFoundException(INVALID_LINK);
    }
    return link;
  }
}
