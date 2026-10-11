import { sign, TokenExpiredError, verify } from 'jsonwebtoken';
import { z } from 'zod';
import { UnauthorizedError } from '../../errors/app-error';
import { objectIdSchema } from '../../validation/schemas';
import type { IssuedToken, TokenClaims, TokenIssuer } from './auth.types';

const claimsSchema = z.object({ sub: objectIdSchema });

export class TokenService implements TokenIssuer {
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

  verify(token: string): string {
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
    return claims.data.sub;
  }
}
