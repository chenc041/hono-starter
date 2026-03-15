import { verify } from "@node-rs/argon2";
import type { PrismaClient } from "~/generated/prisma/client";
import type { AuthUser } from "~/types";

export interface AuthIdentityStore {
  verifyCredentials(email: string, password: string): Promise<AuthUser | null>;
}

export class PrismaAuthIdentityStore implements AuthIdentityStore {
  constructor(private readonly prisma: PrismaClient) {}

  async verifyCredentials(email: string, password: string): Promise<AuthUser | null> {
    const record = await this.prisma.userAuth.findUnique({
      where: {
        email,
      },
    });

    if (!record || record.status !== "ACTIVE") {
      return null;
    }

    const valid = await verify(record.passwordHash, password);
    if (!valid) {
      return null;
    }

    await this.prisma.userAuth.update({
      where: { id: record.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      sub: record.id,
      email: record.email,
    };
  }
}

export class InMemoryAuthIdentityStore implements AuthIdentityStore {
  private readonly records = new Map<string, { password: string; user: AuthUser }>();

  setUser(email: string, password: string, userId = "test-user") {
    this.records.set(email, {
      password,
      user: {
        sub: userId,
        email,
      },
    });
  }

  async verifyCredentials(email: string, password: string): Promise<AuthUser | null> {
    const record = this.records.get(email);
    if (!record || record.password !== password) {
      return null;
    }

    return record.user;
  }
}
