import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MembershipRole } from '@prisma/client';
import type { Request, Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CompanyContextGuard } from '../auth/guards/company-context.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { actor, meta } from '../inventory/vehicles.controller';
import {
  AddFairVehiclesDto,
  ChangeFairStatusDto,
  CreateFairDto,
  InviteStoresDto,
  RespondInviteDto,
  SearchStoresQueryDto,
  UpdateFairDto,
  UpdateFairVehicleDto,
} from './dto/fair.dto';
import { FairReportService } from './fair-report.service';
import { FairVehiclesService } from './fair-vehicles.service';
import { FairsService } from './fairs.service';

const MANAGERS = [MembershipRole.OWNER, MembershipRole.ADMIN];

@ApiTags('fairs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CompanyContextGuard, RolesGuard)
@Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.AGENT)
@Controller('fairs')
export class FairsController {
  constructor(
    private readonly fairs: FairsService,
    private readonly vehicles: FairVehiclesService,
    private readonly reports: FairReportService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Feirões que organizo, de que participo e convites',
  })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.fairs.list(actor(user));
  }

  @Post()
  @Roles(...MANAGERS)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Cria feirão em rascunho (a loja é a organizadora)',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFairDto,
    @Req() req: Request,
  ) {
    return this.fairs.create(actor(user), dto, meta(req));
  }

  @Get('stores')
  @Roles(...MANAGERS)
  @ApiOperation({ summary: 'Lojas que podem ser convidadas' })
  stores(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: SearchStoresQueryDto,
  ) {
    return this.fairs.searchStores(actor(user), q.q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do feirão' })
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.fairs.detail(actor(user), id);
  }

  @Patch(':id')
  @Roles(...MANAGERS)
  @ApiOperation({ summary: 'Edita dados do feirão (organizador)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFairDto,
    @Req() req: Request,
  ) {
    return this.fairs.update(actor(user), id, dto, meta(req));
  }

  @Post(':id/status')
  @Roles(...MANAGERS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Avança o status: rascunho → publicado → ao vivo → encerrado',
  })
  status(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeFairStatusDto,
    @Req() req: Request,
  ) {
    return this.fairs.changeStatus(actor(user), id, dto, meta(req));
  }

  @Post(':id/invites')
  @Roles(...MANAGERS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Convida lojas (organizador)' })
  invite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InviteStoresDto,
    @Req() req: Request,
  ) {
    return this.fairs.invite(actor(user), id, dto, meta(req));
  }

  @Delete(':id/invites/:companyId')
  @Roles(...MANAGERS)
  @ApiOperation({ summary: 'Tira convite ainda não aceito (organizador)' })
  removeInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Req() req: Request,
  ) {
    return this.fairs.removeInvite(actor(user), id, companyId, meta(req));
  }

  @Post(':id/respond')
  @Roles(...MANAGERS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aceita ou recusa o convite (recusar tira os carros da loja)',
  })
  respond(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondInviteDto,
    @Req() req: Request,
  ) {
    return this.fairs.respond(actor(user), id, dto.accept, meta(req));
  }

  @Get(':id/vehicles')
  @ApiOperation({
    summary: 'Meus carros no feirão e os que ainda podem entrar',
  })
  mine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vehicles.mine(actor(user), id);
  }

  @Post(':id/vehicles')
  @Roles(...MANAGERS)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inscreve carros da loja no feirão' })
  addVehicles(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddFairVehiclesDto,
    @Req() req: Request,
  ) {
    return this.vehicles.add(actor(user), id, dto, meta(req));
  }

  @Patch(':id/vehicles/:fairVehicleId')
  @Roles(...MANAGERS)
  @ApiOperation({ summary: 'Muda o preço do carro no feirão' })
  updateVehicle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fairVehicleId', ParseUUIDPipe) fairVehicleId: string,
    @Body() dto: UpdateFairVehicleDto,
    @Req() req: Request,
  ) {
    return this.vehicles.updatePrice(
      actor(user),
      id,
      fairVehicleId,
      dto,
      meta(req),
    );
  }

  @Delete(':id/vehicles/:fairVehicleId')
  @Roles(...MANAGERS)
  @ApiOperation({ summary: 'Tira o carro do feirão (o QR deixa de valer)' })
  removeVehicle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fairVehicleId', ParseUUIDPipe) fairVehicleId: string,
    @Req() req: Request,
  ) {
    return this.vehicles.remove(actor(user), id, fairVehicleId, meta(req));
  }

  @Get(':id/live')
  @ApiOperation({ summary: 'Modo evento: meus carros e contadores' })
  live(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vehicles.live(actor(user), id);
  }

  @Get(':id/qr')
  @ApiOperation({
    summary:
      'Cartões de QR para imprimir (all=true: todas as lojas, só organizador)',
  })
  qr(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('all') all?: string,
  ) {
    return this.vehicles.qrCards(actor(user), id, all === 'true');
  }

  @Get(':id/report')
  @ApiOperation({ summary: 'Relatório do feirão' })
  report(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reports.report(actor(user), id);
  }

  @Get(':id/report.csv')
  @ApiOperation({ summary: 'Relatório do feirão em CSV' })
  async reportCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const file = await this.reports.csv(actor(user), id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.body);
  }
}
