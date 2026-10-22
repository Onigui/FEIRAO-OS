import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * - Convite de quem ainda não tem senha / redefinição: `password`.
 * - Convite de quem já tem conta (outra loja): `currentPassword` confirma que é a própria pessoa.
 */
export class CompleteAccessLinkDto {
  @ApiPropertyOptional({ minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword?: string;
}
