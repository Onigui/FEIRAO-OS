import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PUBLIC_READ_LIMIT_PER_MIN } from '../showcase/showcase.constants';
import { PublicFairVehiclesQueryDto } from './dto/public-fair-vehicles.query.dto';
import { PublicFairsService } from './public-fairs.service';

const MINUTE = 60_000;

@ApiTags('public')
@Controller('public')
export class PublicFairsController {
  constructor(private readonly fairs: PublicFairsService) {}

  @Get('fairs/upcoming')
  @Throttle({ default: { limit: PUBLIC_READ_LIMIT_PER_MIN, ttl: MINUTE } })
  @ApiOperation({ summary: 'Próximos feirões publicados' })
  upcoming() {
    return this.fairs.upcoming();
  }

  @Get('fairs/:slug')
  @Throttle({ default: { limit: PUBLIC_READ_LIMIT_PER_MIN, ttl: MINUTE } })
  @ApiOperation({ summary: 'Página do feirão' })
  fair(@Param('slug') slug: string) {
    return this.fairs.getFair(slug);
  }

  @Get('fairs/:slug/vehicles')
  @Throttle({ default: { limit: PUBLIC_READ_LIMIT_PER_MIN, ttl: MINUTE } })
  @ApiOperation({ summary: 'Carros do feirão (vendidos com faixa)' })
  vehicles(
    @Param('slug') slug: string,
    @Query() query: PublicFairVehiclesQueryDto,
  ) {
    return this.fairs.vehicles(slug, query);
  }

  @Get('q/:code')
  @Throttle({ default: { limit: PUBLIC_READ_LIMIT_PER_MIN, ttl: MINUTE } })
  @ApiOperation({
    summary: 'Leitura do QR: registra e devolve o carro e o feirão',
  })
  scan(@Param('code') code: string) {
    return this.fairs.scan(code);
  }
}
