export interface AuthenticatedUser {
  userId: number;
  username: string;
}

export interface AuthenticatedRequest {
  user: AuthenticatedUser;
}
