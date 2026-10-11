import type { Principal } from '../modules/auth/auth.types';

declare global {
  namespace Express {
    interface Request {
      principal?: Principal;
    }
  }
}
