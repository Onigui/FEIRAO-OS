import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CreateInterestDto } from './dto/create-interest.dto';
import { ListPublicVehiclesQueryDto } from './dto/list-public-vehicles.query.dto';
import { TrackEventDto } from './dto/track-event.dto';
import { PublicShowcaseService } from './public-showcase.service';
import { ShowcaseAnalyticsService } from './showcase-analytics.service';
import { ShowcaseInterestService } from './showcase-interest.service';
import {
  PUBLIC_ANALYTICS_LIMIT_PER_MIN,
  PUBLIC_INTEREST_LIMIT_PER_MIN,
  PUBLIC_READ_LIMIT_PER_MIN,
} from './showcase.constants';

const MINUTE = 60_000;

/** Vitrine pública — sem login. Só campos públicos; limites próprios por IP. */
@ApiTags('public')
@Controller('public')
export class PublicShowcaseController {
  constructor(
    private readonly showcase: PublicShowcaseService,
    private readonly interests: ShowcaseInterestService,
    private readonly analytics: ShowcaseAnalyticsService,
  ) {}

  @Get('vehicles')
  @Throttle({ default: { limit: PUBLIC_READ_LIMIT_PER_MIN, ttl: MINUTE } })
  @ApiOperation({
    summary: 'Carros publicados (vitrine da cidade ou de uma loja)',
  })
  list(@Query() query: ListPublicVehiclesQueryDto) {
    return this.showcase.listVehicles(query);
  }

  @Get('vehicles/:slug')
  @Throttle({ default: { limit: PUBLIC_READ_LIMIT_PER_MIN, ttl: MINUTE } })
  @ApiOperation({ summary: 'Página do carro' })
  vehicle(@Param('slug') slug: string) {
    return this.showcase.getVehicle(slug);
  }

  @Get('stores/:slug')
  @Throttle({ default: { limit: PUBLIC_READ_LIMIT_PER_MIN, ttl: MINUTE } })
  @ApiOperation({ summary: 'Dados públicos da loja' })
  store(@Param('slug') slug: string) {
    return this.showcase.getStore(slug);
  }

  @Post('interests')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: PUBLIC_INTEREST_LIMIT_PER_MIN, ttl: MINUTE } })
  @ApiOperation({
    summary: 'Formulário de interesse → Lead da loja dona do carro',
  })
  createInterest(@Body() dto: CreateInterestDto, @Req() req: Request) {
    return this.interests.create(dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('analytics')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: PUBLIC_ANALYTICS_LIMIT_PER_MIN, ttl: MINUTE } })
  @ApiOperation({
    summary: 'Evento anônimo (visita, clique no WhatsApp, busca)',
  })
  async track(@Body() dto: TrackEventDto): Promise<void> {
    await this.analytics.track(dto);
  }
}
