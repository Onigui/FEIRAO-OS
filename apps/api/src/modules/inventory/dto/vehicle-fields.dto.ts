import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleFuel, VehicleTransmission } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  VEHICLE_MILEAGE_MAX_KM,
  VEHICLE_PRICE_MAX_CENTS,
  VEHICLE_YEAR_MIN,
} from '../inventory.constants';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimOrNull = ({ value }: { value: unknown }) => {
  if (value === null) return null;
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? null : t;
};

/** Ano máximo validado no serviço (ano atual + 1). */
export class CreateVehicleDto {
  @ApiProperty({ example: 'Volkswagen' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  make!: string;

  @ApiProperty({ example: 'Gol' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  model!: string;

  @ApiPropertyOptional({ example: '1.0 MPI', nullable: true })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(120)
  version?: string | null;

  @ApiProperty({ example: 2020 })
  @IsInt()
  @Min(VEHICLE_YEAR_MIN)
  yearManufacture!: number;

  @ApiProperty({ example: 2021 })
  @IsInt()
  @Min(VEHICLE_YEAR_MIN)
  yearModel!: number;

  @ApiProperty({ example: 5990000, description: 'Preço em centavos' })
  @IsInt()
  @Min(1)
  @Max(VEHICLE_PRICE_MAX_CENTS)
  priceCents!: number;

  @ApiProperty({ example: 45000 })
  @IsInt()
  @Min(0)
  @Max(VEHICLE_MILEAGE_MAX_KM)
  mileageKm!: number;

  @ApiProperty({ enum: VehicleTransmission })
  @IsEnum(VehicleTransmission)
  transmission!: VehicleTransmission;

  @ApiProperty({ enum: VehicleFuel })
  @IsEnum(VehicleFuel)
  fuel!: VehicleFuel;

  @ApiPropertyOptional({ example: 'Hatch', nullable: true })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(40)
  bodyType?: string | null;

  @ApiPropertyOptional({ example: 'Prata', nullable: true })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(40)
  color?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(5000)
  description?: string | null;
}
