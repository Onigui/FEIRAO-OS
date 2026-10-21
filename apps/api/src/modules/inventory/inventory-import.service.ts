import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  parseCsvBuffer,
  parseXlsxBuffer,
} from '../outbound/utils/parse-tabular';
import { CommitVehicleImportDto } from './dto/import-commit.dto';
import {
  AUDIT_TARGET_VEHICLE,
  INVENTORY_IMPORT_COLUMNS,
  INVENTORY_IMPORT_MAX_BYTES,
  INVENTORY_IMPORT_MAX_ROWS,
} from './inventory.constants';
import {
  validateImportRows,
  type VehicleImportPreview,
} from './utils/import-rows';
import {
  VehiclesService,
  type CompanyActor,
  type RequestMeta,
} from './vehicles.service';

type UploadedFile = {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
  size?: number;
};

const TEMPLATE_EXAMPLE = [
  'Volkswagen',
  'Gol',
  '1.0 MPI',
  '2020',
  '2021',
  'R$ 59.900,00',
  '45.000',
  'manual',
  'flex',
  'Hatch',
  'Prata',
  'Único dono, revisado',
];

@Injectable()
export class InventoryImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly vehicles: VehiclesService,
  ) {}

  async template(
    format: 'csv' | 'xlsx',
  ): Promise<{ body: Buffer; contentType: string; filename: string }> {
    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Estoque');
      sheet.addRow([...INVENTORY_IMPORT_COLUMNS]);
      sheet.addRow(TEMPLATE_EXAMPLE);
      sheet.getRow(1).font = { bold: true };
      sheet.columns.forEach((c) => (c.width = 18));
      const body = Buffer.from(await workbook.xlsx.writeBuffer());
      return {
        body,
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        filename: 'modelo-estoque.xlsx',
      };
    }
    const escape = (v: string) =>
      /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    const csv =
      '﻿' +
      [
        INVENTORY_IMPORT_COLUMNS.join(';'),
        TEMPLATE_EXAMPLE.map(escape).join(';'),
      ].join('\n') +
      '\n';
    return {
      body: Buffer.from(csv, 'utf8'),
      contentType: 'text/csv; charset=utf-8',
      filename: 'modelo-estoque.csv',
    };
  }

  async preview(file: UploadedFile | undefined): Promise<VehicleImportPreview> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Envie um arquivo CSV ou XLSX');
    }
    if (file.buffer.length > INVENTORY_IMPORT_MAX_BYTES) {
      throw new BadRequestException('Arquivo maior que 2 MB');
    }
    const name = (file.originalname ?? '').toLowerCase();
    const isXlsx =
      name.endsWith('.xlsx') ||
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const isCsv =
      name.endsWith('.csv') || (file.mimetype ?? '').includes('csv');
    if (!isXlsx && !isCsv) {
      throw new BadRequestException('Formato não suportado: use CSV ou XLSX');
    }

    let headers: string[];
    let rows: string[][];
    try {
      const parsed = isXlsx
        ? await parseXlsxBuffer(file.buffer)
        : parseCsvBuffer(file.buffer);
      headers = parsed.headers;
      rows = parsed.rows;
    } catch (error) {
      const code = (error as Error).message;
      if (code === 'TABULAR_TOO_MANY_ROWS') {
        throw new BadRequestException(
          `A planilha passa do limite de ${INVENTORY_IMPORT_MAX_ROWS} linhas`,
        );
      }
      throw new BadRequestException('Não foi possível ler a planilha');
    }

    try {
      return validateImportRows(headers, rows);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }

  async commit(
    actor: CompanyActor,
    dto: CommitVehicleImportDto,
    meta?: RequestMeta,
  ) {
    // Validação de anos é feita de novo aqui (o cliente pode ter alterado as linhas).
    dto.vehicles.forEach((v, i) => {
      try {
        this.vehicles.assertYears(v.yearManufacture, v.yearModel);
      } catch (error) {
        throw new BadRequestException(
          `Linha ${i + 1}: ${(error as Error).message}`,
        );
      }
    });

    const created = await this.prisma.$transaction(
      async (tx) => {
        const rows = dto.vehicles.map((v) =>
          this.vehicles.createData(actor, v),
        );
        const result = await tx.vehicle.createMany({ data: rows });
        await this.audit.write(tx, {
          companyId: actor.cid,
          actorUserId: actor.sub,
          action: 'VEHICLE_IMPORT',
          targetType: AUDIT_TARGET_VEHICLE,
          targetId: actor.cid,
          before: null,
          after: { count: result.count },
          ip: meta?.ip,
          userAgent: meta?.userAgent,
        });
        return result.count;
      },
      { timeout: 30_000 },
    );
    return { imported: created };
  }
}
