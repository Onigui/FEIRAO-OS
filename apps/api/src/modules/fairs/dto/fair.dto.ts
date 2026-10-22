import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { FairStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  FAIR_MAX_INVITES_PER_REQUEST,
  FAIR_MAX_VEHICLES_PER_REQUEST,
} from '../fairs.constants';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimOrNull = ({ value }: { value: unknown }) => {
  if (value === null) return null;
  if (typeof value !== 'string') return value;
  const t = value.trim();
  return t === '' ? null : t;
};

export class CreateFairDto {
  @ApiProperty({ example: 'Feirão de Novembro' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: '2026-11-21T08:00:00-03:00' })
  @Type(() => Date)
  @IsDate()
  startsAt!: Date;

  @ApiProperty({ example: '2026-11-21T18:00:00-03:00' })
  @Type(() => Date)
  @IsDate()
  endsAt!: Date;

  @ApiProperty({ example: 'Estacionamento da AF Veículos' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  venue!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(300)
  address?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}

export class UpdateFairDto extends PartialType(CreateFairDto) {}

export class ChangeFairStatusDto {
  @ApiProperty({ enum: FairStatus })
  @IsEnum(FairStatus)
  toStatus!: FairStatus;
}

export class InviteStoresDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(FAIR_MAX_INVITES_PER_REQUEST)
  @IsUUID('all', { each: true })
  companyIds!: string[];
}

export class RespondInviteDto {
  @ApiProperty()
  @IsBoolean()
  accept!: boolean;
}

export class AddFairVehiclesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(FAIR_MAX_VEHICLES_PER_REQUEST)
  @IsUUID('all', { each: true })
  vehicleIds!: string[];
}

export class UpdateFairVehicleDto {
  @ApiProperty({ description: 'Preço no feirão, em centavos' })
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(1_000_000_000)
  priceCentsAtFair!: number;
}

export class SearchStoresQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  q?: string;
}
