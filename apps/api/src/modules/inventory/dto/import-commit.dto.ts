import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ValidateNested } from 'class-validator';
import { INVENTORY_IMPORT_MAX_ROWS } from '../inventory.constants';
import { CreateVehicleDto } from './vehicle-fields.dto';

/**
 * Commit sem estado no servidor: o cliente devolve as linhas válidas da prévia
 * e a API valida tudo de novo antes de gravar.
 */
export class CommitVehicleImportDto {
  @ApiProperty({ type: [CreateVehicleDto] })
  @ArrayMinSize(1)
  @ArrayMaxSize(INVENTORY_IMPORT_MAX_ROWS)
  @ValidateNested({ each: true })
  @Type(() => CreateVehicleDto)
  vehicles!: CreateVehicleDto[];
}
