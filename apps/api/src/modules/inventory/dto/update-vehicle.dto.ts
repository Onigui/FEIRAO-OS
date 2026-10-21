import { PartialType } from '@nestjs/swagger';
import { CreateVehicleDto } from './vehicle-fields.dto';

export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {}
