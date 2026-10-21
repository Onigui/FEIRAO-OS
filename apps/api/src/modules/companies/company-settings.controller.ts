import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MembershipRole } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CompanyContextGuard } from '../auth/guards/company-context.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { CompaniesService } from './companies.service';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';
import { UpdateShowcaseSettingsDto } from './dto/update-showcase-settings.dto';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CompanyContextGuard, RolesGuard)
@Controller('settings/company')
export class CompanySettingsController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.AGENT)
  @ApiOperation({ summary: 'Get current company settings' })
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.companiesService.getSettings(
      user as AuthenticatedUser & { cid: string; sub: string },
    );
  }

  @Patch()
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiOperation({ summary: 'Update current company settings (OWNER|ADMIN)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCompanySettingsDto,
    @Req() req: Request,
  ) {
    return this.companiesService.updateSettings(
      user as AuthenticatedUser & { cid: string; sub: string },
      dto,
      { ip: req.ip, userAgent: req.headers['user-agent'] },
    );
  }

  @Get('showcase')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.AGENT)
  @ApiOperation({ summary: 'Vitrine: dados públicos da loja' })
  getShowcase(@CurrentUser() user: AuthenticatedUser) {
    return this.companiesService.getShowcase(
      user as AuthenticatedUser & { cid: string; sub: string },
    );
  }

  @Patch('showcase')
  @Roles(MembershipRole.OWNER, MembershipRole.ADMIN)
  @ApiOperation({
    summary: 'Vitrine: atualiza dados públicos e liga/desliga (OWNER|ADMIN)',
  })
  updateShowcase(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateShowcaseSettingsDto,
    @Req() req: Request,
  ) {
    return this.companiesService.updateShowcase(
      user as AuthenticatedUser & { cid: string; sub: string },
      dto,
      { ip: req.ip, userAgent: req.headers['user-agent'] },
    );
  }
}
