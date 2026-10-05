import type { Request } from 'express';
import type { AdminRole } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  avatarUrl?: string | null;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
