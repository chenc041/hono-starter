import type { PrismaClient } from "~/generated/prisma/client";
import type { CreateUserInput } from "~/modules/users/user.schema";

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateUserInput) {
    return this.prisma.user.create({
      data,
    });
  }

  async list() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });
  }
}
