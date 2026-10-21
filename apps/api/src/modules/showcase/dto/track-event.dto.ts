import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches } from 'class-validator';

/** QR_SCAN é gravado pela rota do QR (etapa 4), não por aqui. */
export const TRACKABLE_EVENTS = [
  'PAGE_VIEW',
  'WHATSAPP_CLICK',
  'SEARCH',
] as const;

export class TrackEventDto {
  @ApiProperty({ enum: TRACKABLE_EVENTS })
  @IsIn(TRACKABLE_EVENTS)
  type!: (typeof TRACKABLE_EVENTS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[a-z0-9-]{3,160}$/)
  vehicleSlug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^[a-z0-9-]{1,80}$/)
  storeSlug?: string;

  /** Identificador anônimo gerado no navegador, trocado todo dia. */
  @ApiProperty()
  @Matches(/^[A-Za-z0-9_-]{8,64}$/)
  session!: string;
}
