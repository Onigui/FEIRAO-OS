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
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MembershipRole } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CompanyContextGuard } from '../auth/guards/company-context.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { ChangeVehicleStatusDto } from './dto/change-vehicle-status.dto';
import { ListVehiclesQueryDto } from './dto/list-vehicles.query.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { CreateVehicleDto } from './dto/vehicle-fields.dto';
import {
  ConfirmVehiclePhotoDto,
  CreatePhotoUploadUrlDto,
  ReorderVehiclePhotosDto,
} from './dto/vehicle-photo.dto';
import { VehiclePhotosService } from './vehicle-photos.service';
import { VehiclesService, type CompanyActor } from './vehicles.service';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CompanyContextGuard, RolesGuard)
@Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.AGENT)
@Controller('inventory/vehicles')
export class VehiclesController {
  constructor(
    private readonly vehicles: VehiclesService,
    private readonly photos: VehiclePhotosService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lista o estoque da loja (sem arquivados por padrão)',
  })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListVehiclesQueryDto,
  ) {
    return this.vehicles.list(actor(user), query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cadastra veículo (status AVAILABLE)' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVehicleDto,
    @Req() req: Request,
  ) {
    return this.vehicles.create(actor(user), dto, meta(req));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do veículo com fotos' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vehicles.findOne(actor(user), id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edita dados do veículo' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleDto,
    @Req() req: Request,
  ) {
    return this.vehicles.update(actor(user), id, dto, meta(req));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiOperation({ summary: 'Exclui o veículo (lógico; OWNER|ADMIN)' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    return this.vehicles.remove(actor(user), id, meta(req));
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Muda o status (desfazer venda até 24h e desarquivar: OWNER|ADMIN)',
  })
  changeStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeVehicleStatusDto,
    @Req() req: Request,
  ) {
    return this.vehicles.changeStatus(actor(user), id, dto.toStatus, meta(req));
  }

  @Get(':id/status-history')
  @ApiOperation({ summary: 'Histórico de status do veículo' })
  statusHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vehicles.statusHistory(actor(user), id);
  }

  @Post(':id/photos/upload-url')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'URL assinada para enviar uma foto ao R2 (PUT, 5 min)',
  })
  uploadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePhotoUploadUrlDto,
  ) {
    return this.photos.createUploadUrl(actor(user), id, dto);
  }

  @Post(':id/photos')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Confirma a foto enviada (checa o arquivo no R2)' })
  confirmPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmVehiclePhotoDto,
    @Req() req: Request,
  ) {
    return this.photos.confirm(actor(user), id, dto, meta(req));
  }

  @Put(':id/photos/order')
  @ApiOperation({ summary: 'Reordena as fotos (a primeira é a capa)' })
  reorderPhotos(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderVehiclePhotosDto,
  ) {
    return this.photos.reorder(actor(user), id, dto);
  }

  @Delete(':id/photos/:photoId')
  @ApiOperation({ summary: 'Remove uma foto' })
  removePhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
    @Req() req: Request,
  ) {
    return this.photos.remove(actor(user), id, photoId, meta(req));
  }
}

/** CompanyContextGuard garante cid/mid/role. */
export function actor(user: AuthenticatedUser): CompanyActor {
  return user as CompanyActor;
}

export function meta(req: Request) {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}
