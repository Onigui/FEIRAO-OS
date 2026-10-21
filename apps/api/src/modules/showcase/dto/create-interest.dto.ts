import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SHOWCASE_INTEREST_SOURCES } from '../showcase.constants';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Formulário de interesse: nome, WhatsApp, carro e as duas autorizações. */
export class CreateInterestDto {
  @ApiProperty({ example: 'gol-1-0-2021-ab12cd' })
  @Matches(/^[a-z0-9-]{3,160}$/)
  vehicleSlug!: string;

  @ApiProperty({ example: 'Maria Souza' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: '(14) 99999-0000' })
  @Transform(trim)
  @IsString()
  @MinLength(8)
  @MaxLength(25)
  phone!: string;

  @ApiProperty({
    description: 'Autorização 1 (obrigatória): falar sobre este veículo',
  })
  @Equals(true, {
    message: 'É preciso autorizar o contato sobre este veículo.',
  })
  consentContact!: boolean;

  @ApiPropertyOptional({
    description: 'Autorização 2 (opcional): ofertas parecidas',
  })
  @IsOptional()
  @IsBoolean()
  consentMarketing?: boolean;

  @ApiPropertyOptional({
    enum: SHOWCASE_INTEREST_SOURCES,
    default: 'VEHICLE_PAGE',
  })
  @IsOptional()
  @IsIn(SHOWCASE_INTEREST_SOURCES)
  source?: (typeof SHOWCASE_INTEREST_SOURCES)[number];

  /** Campo-armadilha: invisível para pessoas; robôs preenchem. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
