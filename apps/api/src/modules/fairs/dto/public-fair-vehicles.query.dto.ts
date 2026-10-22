import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PUBLIC_FAIR_VEHICLES_MAX_LIMIT } from '../fairs.constants';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class PublicFairVehiclesQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  make?: string;

  @ApiPropertyOptional({ description: 'Endereço da vitrine da loja' })
  @IsOptional()
  @Transform(trim)
  @Matches(/^[a-z0-9-]{1,80}$/)
  store?: string;

  @ApiPropertyOptional({ description: 'Preço máximo em reais' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'true: esconde os vendidos' })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  onlyAvailable?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page?: number;

  @ApiPropertyOptional({ default: 48 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PUBLIC_FAIR_VEHICLES_MAX_LIMIT)
  limit?: number;
}
