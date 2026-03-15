export type AuthUser = {
  sub: string;
  email: string;
};

export type AppEnv = {
  Variables: {
    requestId: string;
    authUser: AuthUser;
    authToken: string;
    authTokenExpiresAt: Date;
  };
};
