import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { LoginDto } from '../dto/login.dto';
import { AuthResponseDto } from '../dto/auth-response.dto';
import * as bcrypt from 'bcryptjs';
import { RegisterDto } from '../dto/register.dto';
import { RegisterResponseDto } from '../dto/register-response.dto';
import { UserRole } from '../../users/enums/user-role.enum';
import { UserStatus } from '../../users/enums/user-role.enum';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { UserResponseDto } from 'src/modules/users/dto/user-response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto, autoLogin = true): Promise<RegisterResponseDto> {
    if (!registerDto.email && !registerDto.phone_number) {
      throw new BadRequestException('Either email or phone_number is required');
    }

    const existing = await this.usersService.userExists(
      registerDto.email || '',registerDto.phone_number || '',
    );

    if (existing) {
        throw new ConflictException('User already registered');
      }

    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    const newUser = await this.usersService.create({
      email: registerDto.email || undefined,
      phone_number: registerDto.phone_number || undefined,
      password: passwordHash,
      role: registerDto.role || UserRole.CUSTOMER,
      // status: UserStatus.ACTIVE,
      // is_active: true,
      // first_name: registerDto.first_name,
      // last_name: registerDto.last_name,
    });

    const userResponse = {
      id: newUser.id,
      uuid: newUser.uuid,
      email: newUser.email,
      phone_number: newUser.phone_number,
      role: newUser.role,
      status: newUser.status,
      created_at: newUser.created_at,
    };

    if (autoLogin) {
      const tokens = await this.generateTokens(newUser);
      return {
        message: 'Registration successful',
        user: userResponse,
        access_token: tokens.accessToken,
        token_type: 'Bearer',
      };
    }

    return {
      message: 'Registration successful. Please login to continue.',
      user: userResponse,
    };
  }

  async validateUser(email: string, password: string): Promise<unknown> {
    const user = await this.usersService.findByUuid(
      (await this.usersService.findAll(1, 10000)).data.find((u) => u.email === email)?.id?.toString() || '',
    ).catch(() => null);

    if (!user || !user.email) {
      return null;
    }

    // Note: In production, fetch user with password hash from repo directly
    const isPasswordValid = await bcrypt.compare(password, 'hash'); // Replace with actual hash
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async validateUserData(identifier: string, password: string): Promise<any> {
    const user = await this.usersService.findUserWithPassword(identifier);
    if (!user || !user.password_hash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const { password_hash, ...result } = user;
    return result;
  }



  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.validateUserData(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_EXPIRATION') || '1d',
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 86400,
      user: {
        id: user.id,
        uuid: user.uuid,
        email: user.email,
        role: user.role,
      },
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthResponseDto> {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.usersService.findOne(payload.sub);

      const newAccessToken = this.jwtService.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      return {
        access_token: newAccessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 86400,
        user: {
          id: user.id,
          uuid: user.uuid,
          email: user.email,
          role: user.role,
        },
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async generateTokens(user: UserResponseDto): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_EXPIRATION') || '1d',
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    return { accessToken, refreshToken };
  }
}
