import { BadRequestException } from '@nestjs/common';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Regra única de senha (convite, redefinição e troca).
 * Mínimo 8 caracteres, com letra e número, e diferente do e-mail.
 */
export function assertPasswordPolicy(password: string, email: string): void {
  const problems: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) {
    problems.push(
      `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
    );
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    problems.push(
      `A senha pode ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`,
    );
  }
  if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) {
    problems.push('A senha precisa ter letras e números.');
  }
  if (password.trim().toLowerCase() === email.trim().toLowerCase()) {
    problems.push('A senha não pode ser igual ao e-mail.');
  }
  if (problems.length > 0) {
    throw new BadRequestException({
      code: 'WEAK_PASSWORD',
      message: problems.join(' '),
    });
  }
}
