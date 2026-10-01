import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../database/database.service';
import { LoginDto } from './dto/login.dto';

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
      throw new UnauthorizedException(
        'Invalid username or password',
      );
    }

    const user = result.rows[0];

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'User account is not active',
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