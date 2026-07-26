import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { createHash } from 'node:crypto';
import { AuthService } from '../use-cases/auth.service';
import {
  AppleLoginDto,
  DisableMfaDto,
  EnrollTotpDto,
  GoogleLoginDto,
  IdentifierDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResendMfaLoginDto,
  ResetPasswordDto,
  VerifyMfaLoginDto,
  VerifyOtpDto,
  VerifyTotpEnrollmentDto,
} from '../dto/auth.dto';
import { AuthTokenGuard } from '../guards/auth-token.guard';
import { CurrentAuth } from '../decorators/current-auth.decorator';
import type {
  AuthPrincipalView,
  AuthRequestContext,
} from '../domain/auth.contracts';

@ApiTags('Authentication')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  public constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  public login(@Body() input: LoginDto, @Req() request: Request) {
    return this.auth.login(input, this.context(request));
  }

  @Post('google')
  @HttpCode(200)
  public google(@Body() input: GoogleLoginDto, @Req() request: Request) {
    return this.auth.socialLogin('google', input, this.context(request));
  }

  @Post('apple')
  @HttpCode(200)
  public apple(@Body() input: AppleLoginDto, @Req() request: Request) {
    return this.auth.socialLogin('apple', input, this.context(request));
  }

  @Post('request-signup-otp')
  @HttpCode(200)
  public requestSignupOtp(
    @Body() input: IdentifierDto,
    @Req() request: Request,
  ) {
    return this.auth.requestSignupOtp(
      input.identifier,
      input.captchaToken,
      this.context(request),
    );
  }

  @Post('resend-signup-otp')
  @HttpCode(200)
  public resendSignupOtp(
    @Body() input: IdentifierDto,
    @Req() request: Request,
  ) {
    return this.auth.resendSignupOtp(
      input.identifier,
      input.captchaToken,
      this.context(request),
    );
  }

  @Post('verify-signup-otp')
  @HttpCode(200)
  public verifySignupOtp(@Body() input: VerifyOtpDto) {
    return this.auth.verifySignupOtp(input.identifier, input.otp);
  }

  @Post('forgot-password')
  @HttpCode(200)
  public forgotPassword(@Body() input: IdentifierDto, @Req() request: Request) {
    return this.auth.forgotPassword(
      input.identifier,
      input.captchaToken,
      this.context(request),
    );
  }

  @Post('resend-reset-otp')
  @HttpCode(200)
  public resendResetOtp(@Body() input: IdentifierDto, @Req() request: Request) {
    return this.auth.resendResetOtp(
      input.identifier,
      input.captchaToken,
      this.context(request),
    );
  }

  @Post('verify-reset-otp')
  @HttpCode(200)
  public verifyResetOtp(@Body() input: VerifyOtpDto) {
    return this.auth.verifyResetOtp(input.identifier, input.otp);
  }

  @Post('reset-password-confirmed')
  @HttpCode(200)
  public resetPassword(@Body() input: ResetPasswordDto) {
    return this.auth.resetPassword(
      input.identifier,
      input.otp,
      input.newPassword,
    );
  }

  @Post('register')
  @HttpCode(200)
  public register(@Body() input: RegisterDto, @Req() request: Request) {
    return this.auth.register(input, this.context(request));
  }

  @Post('refresh')
  @HttpCode(200)
  public refresh(@Body() input: RefreshDto) {
    return this.auth.refresh(input.sessionId, input.refreshToken);
  }

  @Post('mfa/verify-login')
  @HttpCode(200)
  public verifyMfaLogin(
    @Body() input: VerifyMfaLoginDto,
    @Req() request: Request,
  ) {
    return this.auth.verifyMfaLogin(
      input.mfaChallengeId,
      input.code,
      this.context(request),
    );
  }

  @Post('mfa/resend')
  @HttpCode(200)
  public resendMfaLogin(
    @Body() input: ResendMfaLoginDto,
    @Req() request: Request,
  ) {
    return this.auth.resendMfaLogin(
      input.mfaChallengeId,
      this.context(request),
    );
  }

  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(AuthTokenGuard)
  public logout(@CurrentAuth() principal: AuthPrincipalView) {
    return this.auth.logout(principal.sessionId);
  }

  @Post('mfa/totp/enroll')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(AuthTokenGuard)
  public enrollTotp(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() input: EnrollTotpDto,
  ) {
    return this.auth.enrollTotp(principal.id, input.label);
  }

  @Post('mfa/totp/verify')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(AuthTokenGuard)
  public verifyTotp(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() input: VerifyTotpEnrollmentDto,
  ) {
    return this.auth.verifyTotpEnrollment(
      principal.id,
      input.factorId,
      input.code,
    );
  }

  @Post('mfa/disable')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(AuthTokenGuard)
  public disableMfa(
    @CurrentAuth() principal: AuthPrincipalView,
    @Body() input: DisableMfaDto,
  ) {
    return this.auth.disableMfa(principal.id, input.code);
  }

  @Get('devices')
  @ApiBearerAuth()
  @UseGuards(AuthTokenGuard)
  public listDevices(@CurrentAuth() principal: AuthPrincipalView) {
    return this.auth.listDevices(principal.id, principal.sessionId);
  }

  @Delete('devices/:sessionId')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(AuthTokenGuard)
  public revokeDevice(
    @CurrentAuth() principal: AuthPrincipalView,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.auth.revokeDevice(
      principal.id,
      sessionId,
      principal.sessionId,
    );
  }

  @Delete('devices')
  @HttpCode(200)
  @ApiBearerAuth()
  @UseGuards(AuthTokenGuard)
  public revokeOtherDevices(@CurrentAuth() principal: AuthPrincipalView) {
    return this.auth.revokeOtherDevices(principal.id, principal.sessionId);
  }

  private context(request: Request): AuthRequestContext {
    const deviceHeader = this.header(request, 'x-device-id');
    const source =
      deviceHeader ??
      `${request.headers['user-agent'] ?? 'unknown'}|${request.headers['accept-language'] ?? ''}`;
    const fingerprint = createHash('sha256').update(source).digest('hex');
    return {
      deviceId: deviceHeader ?? fingerprint,
      deviceFingerprint: fingerprint,
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
      correlationId:
        this.header(request, 'x-request-id') ??
        this.header(request, 'x-correlation-id'),
    };
  }

  private header(request: Request, name: string): string | undefined {
    const value = request.headers[name];
    return typeof value === 'string' ? value : value?.[0];
  }
}
