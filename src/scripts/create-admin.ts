import { hash } from "@node-rs/argon2";
import { loadEnvFiles } from "~/core/config/load-env";
import { getPrismaClient } from "~/db/client";

loadEnvFiles();

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error("Missing ADMIN_EMAIL or ADMIN_PASSWORD");
  process.exit(1);
}

if (password.length < 8) {
  console.error("ADMIN_PASSWORD must be at least 8 characters");
  process.exit(1);
}

const prisma = getPrismaClient();
const passwordHash = await hash(password);

await prisma.userAuth.upsert({
  where: { email },
  update: {
    passwordHash,
    status: "ACTIVE",
  },
  create: {
    email,
    passwordHash,
    status: "ACTIVE",
  },
});

console.log(`Admin user upserted: ${email}`);
