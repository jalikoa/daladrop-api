import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { AuthLoggingInterceptor } from './interceptors/auth-logging.interceptor';

@Controller('auth')
@UseInterceptors(AuthLoggingInterceptor)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() registerDto: RegisterDto,
    @Query('autoLogin') autoLogin = 'true',
  ): Promise<RegisterResponseDto> {
    return this.authService.register(registerDto, autoLogin === 'true');
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('refresh_token') refreshToken: string): Promise<AuthResponseDto> {
    return this.authService.refreshToken(refreshToken);
  }
}