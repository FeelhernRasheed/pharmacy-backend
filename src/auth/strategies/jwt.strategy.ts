import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {
    const secret =
      configService.getOrThrow<string>('JWT_SECRET');

    super({
      jwtFromRequest:
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: {
    sub: number;
    username: string;
    role: string;
  }) {
    const result = await this.databaseService
      .getPool()
      .query(
        `SELECT id, username, role, status
         FROM users
         WHERE id = $1`,
        [payload.sub],
      );

    if (result.rows.length === 0) {
      throw new UnauthorizedException(
        'User account no longer exists',
      );
    }

    const user = result.rows[0];

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'User account is not active',
      );
    }

    return {
      userId: user.id,
      username: user.username,
      role: user.role,
    };
  }
}