import { createHash } from "node:crypto";
import type { PrismaClient } from "~/generated/prisma/client";

export type RefreshTokenRecord = {
  tokenHash: string;
  userId: string;
  email: string;
  expiresAt: Date;
};

export type ActiveRefreshToken = RefreshTokenRecord;

export type RevokeAccessTokenInput = {
  tokenHash: string;
  userId: string;
  expiresAt: Date;
  reason: string;
};

export interface AuthTokenStore {
  saveRefreshToken(record: RefreshTokenRecord): Promise<void>;
  findActiveRefreshToken(tokenHash: string): Promise<ActiveRefreshToken | null>;
  revokeRefreshToken(tokenHash: string, replacedByTokenHash?: string): Promise<void>;
  revokeAccessToken(input: RevokeAccessTokenInput): Promise<void>;
  isAccessTokenRevoked(tokenHash: string): Promise<boolean>;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class PrismaAuthTokenStore implements AuthTokenStore {
  constructor(private readonly prisma: PrismaClient) {}

  async saveRefreshToken(record: RefreshTokenRecord): Promise<void> {
    await this.prisma.refreshToken.create({ data: record });
  }

  async findActiveRefreshToken(tokenHash: string): Promise<ActiveRefreshToken | null> {
    const token = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!token) {
      return null;
    }

    return { tokenHash: token.tokenHash, userId: token.userId, email: token.email, expiresAt: token.expiresAt };
  }

  async revokeRefreshToken(tokenHash: string, replacedByTokenHash?: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date(), ...(replacedByTokenHash ? { replacedByTokenHash } : {}) },
    });
  }

  async revokeAccessToken(input: RevokeAccessTokenInput): Promise<void> {
    await this.prisma.revokedToken.upsert({
      where: { tokenHash: input.tokenHash },
      update: { reason: input.reason, expiresAt: input.expiresAt },
      create: { tokenHash: input.tokenHash, userId: input.userId, expiresAt: input.expiresAt, reason: input.reason },
    });
  }

  async isAccessTokenRevoked(tokenHash: string): Promise<boolean> {
    const token = await this.prisma.revokedToken.findFirst({
      where: { tokenHash, expiresAt: { gt: new Date() } },
    });

    return Boolean(token);
  }
}

export class InMemoryAuthTokenStore implements AuthTokenStore {
  private readonly refreshTokens = new Map<
    string,
    ActiveRefreshToken & { revokedAt?: Date; replacedByTokenHash?: string }
  >();
  private readonly revokedAccessTokens = new Map<string, RevokeAccessTokenInput>();

  async saveRefreshToken(record: RefreshTokenRecord): Promise<void> {
    this.refreshTokens.set(record.tokenHash, record);
  }

  async findActiveRefreshToken(tokenHash: string): Promise<ActiveRefreshToken | null> {
    const token = this.refreshTokens.get(tokenHash);
    if (!token || token.revokedAt || token.expiresAt <= new Date()) {
      return null;
    }

    return { tokenHash: token.tokenHash, userId: token.userId, email: token.email, expiresAt: token.expiresAt };
  }

  async revokeRefreshToken(tokenHash: string, replacedByTokenHash?: string): Promise<void> {
    const token = this.refreshTokens.get(tokenHash);
    if (!token || token.revokedAt) {
      return;
    }

    this.refreshTokens.set(tokenHash, {
      ...token,
      revokedAt: new Date(),
      ...(replacedByTokenHash ? { replacedByTokenHash } : {}),
    });
  }

  async revokeAccessToken(input: RevokeAccessTokenInput): Promise<void> {
    this.revokedAccessTokens.set(input.tokenHash, input);
  }

  async isAccessTokenRevoked(tokenHash: string): Promise<boolean> {
    const token = this.revokedAccessTokens.get(tokenHash);
    if (!token) {
      return false;
    }

    return token.expiresAt > new Date();
  }
}
