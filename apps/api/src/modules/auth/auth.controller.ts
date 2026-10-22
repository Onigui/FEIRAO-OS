import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AccessLinksService } from './access-links.service';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CompleteAccessLinkDto } from './dto/complete-access-link.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { SelectCompanyDto } from './dto/select-company.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedUser } from './types/jwt-payload';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly accessLinks: AccessLinksService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Login with email/password (company selection required next)',
  })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('select-company')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Bind session to a company via Membership (companySlug validated server-side)',
  })
  selectCompany(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SelectCompanyDto,
    @Req() req: Request,
  ) {
    return this.authService.selectCompany(user, dto.companySlug, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and issue new access token' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke refresh token and session' })
  logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Revoke all sessions and refresh tokens for the current user',
  })
  logoutAll(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    return this.authService.logoutAll(user, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Change own password (keeps this session, revokes the others)',
  })
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    return this.authService.changePassword(user, dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('access-links/:token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Public: describe an invite / password reset link' })
  describeAccessLink(@Param('token') token: string) {
    return this.accessLinks.describe(token);
  }

  @Post('access-links/:token/complete')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Public: accept invite / reset password (single use)',
  })
  completeAccessLink(
    @Param('token') token: string,
    @Body() dto: CompleteAccessLinkDto,
    @Req() req: Request,
  ) {
    return this.accessLinks.complete(token, dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user, company context and membership' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user);
  }
}
