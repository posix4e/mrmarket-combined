export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

export interface User {
  id: string;
  username: string;
  role: UserRole;
  fullName?: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}