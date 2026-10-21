import { ApiProperty } from '@nestjs/swagger';
import { VehicleStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ChangeVehicleStatusDto {
  @ApiProperty({ enum: VehicleStatus })
  @IsEnum(VehicleStatus)
  toStatus!: VehicleStatus;
}
