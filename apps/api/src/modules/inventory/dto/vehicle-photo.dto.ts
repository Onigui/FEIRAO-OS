import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  VEHICLE_MAX_PHOTOS,
  VEHICLE_PHOTO_CONTENT_TYPES,
  VEHICLE_PHOTO_MAX_BYTES,
} from '../inventory.constants';

export class CreatePhotoUploadUrlDto {
  @ApiProperty({ enum: VEHICLE_PHOTO_CONTENT_TYPES })
  @IsIn(VEHICLE_PHOTO_CONTENT_TYPES)
  contentType!: string;

  @ApiProperty({
    description: 'Tamanho exato em bytes do arquivo já comprimido',
  })
  @IsInt()
  @Min(1)
  @Max(VEHICLE_PHOTO_MAX_BYTES)
  sizeBytes!: number;
}

export class ConfirmVehiclePhotoDto {
  @ApiProperty({ description: 'Chave devolvida por upload-url' })
  @IsString()
  @MaxLength(300)
  storageKey!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(20000)
  width!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(20000)
  height!: number;
}

export class ReorderVehiclePhotosDto {
  @ApiProperty({
    type: [String],
    description:
      'Todas as fotos do veículo na nova ordem (a primeira é a capa)',
  })
  @ArrayMinSize(1)
  @ArrayMaxSize(VEHICLE_MAX_PHOTOS)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  photoIds!: string[];
}
