import { sign, TokenExpiredError, verify } from 'jsonwebtoken';
import { z } from 'zod';
import { UnauthorizedError } from '../../errors/app-error';
import { objectIdSchema } from '../../validation/schemas';
import { USER_ROLES, type UserRole } from '../users/user.model';

const claimsSchema = z.object({ sub: objectIdSchema, role: z.enum(USER_ROLES) });

export interface TokenClaims {
  userId: string;
  role: UserRole;
}

export interface IssuedToken {
  token: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export class TokenService {
  constructor(
    private readonly secret: string,
    private readonly ttlSeconds: number,
  ) {}

  issue({ userId, role }: TokenClaims): IssuedToken {
    const token = sign({ role }, this.secret, {
      algorithm: 'HS256',
      subject: userId,
      expiresIn: this.ttlSeconds,
    });
    return { token, tokenType: 'Bearer', expiresIn: this.ttlSeconds };
  }

  verify(token: string): TokenClaims {
    let payload: unknown;
    try {
      payload = verify(token, this.secret, { algorithms: ['HS256'] });
    } catch (error) {
      throw new UnauthorizedError(
        error instanceof TokenExpiredError ? 'Token expired' : 'Invalid token',
      );
    }

    const claims = claimsSchema.safeParse(payload);
    if (!claims.success) throw new UnauthorizedError('Invalid token');
    return { userId: claims.data.sub, role: claims.data.role };
  }
}
