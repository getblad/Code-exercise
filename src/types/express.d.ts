import type { Principal } from '../modules/auth/principal';

declare global {
  namespace Express {
    interface Request {
      principal?: Principal;
    }
  }
}
