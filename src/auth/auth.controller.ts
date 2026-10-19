import {
  Body,
  Controller,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @ApiOperation({ summary: 'Authenticate and receive JWT token' })
  // Stricter per-IP limit for credential guessing. The functions are
  // resolved per request, so values already loaded into process.env
  // (defaults applied by validateEnv) are always current.
  @Throttle({
    default: {
      limit: () =>
        Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10),
      ttl: () =>
        Number(process.env.AUTH_RATE_LIMIT_TTL ?? 60) * 1000,
    },
  })
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}