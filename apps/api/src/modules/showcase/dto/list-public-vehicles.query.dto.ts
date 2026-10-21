import { ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleFuel, VehicleTransmission } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PUBLIC_LIST_MAX_LIMIT } from '../showcase.constants';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export const PUBLIC_VEHICLE_SORTS = [
  'recent',
  'price_asc',
  'price_desc',
] as const;

export class ListPublicVehiclesQueryDto {
  @ApiPropertyOptional({ description: 'Busca em marca, modelo e versão' })
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

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1950)
  @Max(2100)
  minYear?: number;

  @ApiPropertyOptional({ enum: VehicleTransmission })
  @IsOptional()
  @IsEnum(VehicleTransmission)
  transmission?: VehicleTransmission;

  @ApiPropertyOptional({ enum: VehicleFuel })
  @IsOptional()
  @IsEnum(VehicleFuel)
  fuel?: VehicleFuel;

  @ApiPropertyOptional({ enum: PUBLIC_VEHICLE_SORTS, default: 'recent' })
  @IsOptional()
  @IsIn(PUBLIC_VEHICLE_SORTS)
  sort?: (typeof PUBLIC_VEHICLE_SORTS)[number];

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page?: number;

  @ApiPropertyOptional({ default: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PUBLIC_LIST_MAX_LIMIT)
  limit?: number;
}
