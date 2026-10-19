import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../database/database.service';
import { LoginDto } from './dto/login.dto';

// Valid bcrypt hash of a throwaway value. Compared against when the
// username does not exist so the failed-login timing does not reveal
// whether an account is registered (username-enumeration defense).
const TIMING_EQUALIZER_HASH =
  '$2b$10$EkVcMwCKZYGsv0YY2kH3fOLM9hhhkWa6i5h/YHX7uS5Igy4ieeS2W';

@Injectable()
export class AuthService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;

    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT
           id,
           full_name,
           username,
           password_hash,
           role,
           status
         FROM users
         WHERE username = $1`,
        [username],
      );

    if (result.rows.length === 0) {
      await bcrypt.compare(
        loginDto.password,
        TIMING_EQUALIZER_HASH,
      );
      throw new UnauthorizedException(
        'Invalid username or password',
      );
    }

    const user = result.rows[0];

    if (user.status !== 'ACTIVE') {
      // Same dummy compare and generic error as the unknown-user path
      // so an inactive account cannot be distinguished by response
      // message or avoidable timing differences.
      await bcrypt.compare(
        loginDto.password,
        TIMING_EQUALIZER_HASH,
      );
      throw new UnauthorizedException(
        'Invalid username or password',
      );
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException(
        'Invalid username or password',
      );
    }

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    const accessToken =
      await this.jwtService.signAsync(payload);

    return {
      message: 'Login successful',
      access_token: accessToken,
      user: {
        id: user.id,
        full_name: user.full_name,
        username: user.username,
        role: user.role,
      },
    };
  }
}