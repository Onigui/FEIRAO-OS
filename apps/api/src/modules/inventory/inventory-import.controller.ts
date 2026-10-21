import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { MembershipRole } from '@prisma/client';
import type { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CompanyContextGuard } from '../auth/guards/company-context.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { CommitVehicleImportDto } from './dto/import-commit.dto';
import { INVENTORY_IMPORT_MAX_BYTES } from './inventory.constants';
import { InventoryImportService } from './inventory-import.service';
import { actor, meta } from './vehicles.controller';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CompanyContextGuard, RolesGuard)
@Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
@Controller('inventory/import')
export class InventoryImportController {
  constructor(private readonly imports: InventoryImportService) {}

  @Get('template')
  @ApiQuery({ name: 'format', enum: ['csv', 'xlsx'], required: false })
  @ApiOperation({ summary: 'Baixa o modelo de planilha de estoque' })
  async template(
    @Query('format') format: string | undefined,
    @Res() res: Response,
  ) {
    const f = format ?? 'xlsx';
    if (f !== 'csv' && f !== 'xlsx') {
      throw new BadRequestException('format deve ser csv ou xlsx');
    }
    const file = await this.imports.template(f);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    res.send(file.body);
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOperation({
    summary:
      'Lê a planilha e devolve linhas válidas e erros por linha (não grava)',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: INVENTORY_IMPORT_MAX_BYTES, files: 1 },
    }),
  )
  preview(@UploadedFile() file: Express.Multer.File) {
    return this.imports.preview(file);
  }

  @Post('commit')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Grava as linhas válidas da prévia numa transação' })
  commit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CommitVehicleImportDto,
    @Req() req: Request,
  ) {
    return this.imports.commit(actor(user), dto, meta(req));
  }
}
