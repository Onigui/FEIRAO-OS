import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MembershipRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CompanyContextGuard } from '../auth/guards/company-context.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import { LeadInterestsQueryDto } from './dto/lead-interests.query.dto';
import { ShowcasePanelService } from './showcase-panel.service';

@ApiTags('showcase')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, CompanyContextGuard, RolesGuard)
@Roles(MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.AGENT)
@Controller('showcase')
export class ShowcasePanelController {
  constructor(private readonly panel: ShowcasePanelService) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Carros disponíveis e números da vitrine nos últimos 7 dias',
  })
  stats(@CurrentUser() user: AuthenticatedUser) {
    return this.panel.stats(user.cid as string);
  }

  @Get('lead-interests')
  @ApiOperation({ summary: 'Carros de interesse e origem por lead' })
  leadInterests(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: LeadInterestsQueryDto,
  ) {
    return this.panel.leadInterests(user.cid as string, query.leadIds);
  }
}
