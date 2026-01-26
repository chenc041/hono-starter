import { Hono } from "hono";
import { UserController } from "~/controllers/user";

type Env = {
  Variables: {
    userService: UserController;
  };
};

const userRouter = new Hono<Env>();
userRouter.use("*", async (c, next) => {
  const userService = new UserController("chen");
  c.set("userService", userService);
  await next();
});

userRouter.get("/", async (c) => {
  const userService = c.get("userService");
  const r = await userService.register();
  return c.json({ r: r });
});

export { userRouter };
