import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const trimOrNull = ({ value }: { value: unknown }): unknown => {
  if (value === null) return null;
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? null : t;
};

/** Vitrine e Feirões — dados públicos da loja. */
export class UpdateShowcaseSettingsDto {
  @ApiPropertyOptional({ example: '(14) 99999-0000', nullable: true })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  publicWhatsapp?: string | null;

  @ApiPropertyOptional({
    example: 'Av. Dep. Dante Delmanto, 1600',
    nullable: true,
  })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(300)
  publicAddress?: string | null;

  @ApiPropertyOptional({ example: 'Botucatu', nullable: true })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(120)
  city?: string | null;

  @ApiPropertyOptional({
    description: 'Aceite do termo de uso da vitrine (registra data/hora)',
  })
  @IsOptional()
  @IsBoolean()
  acceptTerms?: boolean;

  @ApiPropertyOptional({
    description:
      'Liga/desliga a vitrine. Ligar exige endereço da vitrine (slug), WhatsApp, cidade e termo aceito.',
  })
  @IsOptional()
  @IsBoolean()
  showcaseEnabled?: boolean;
}
