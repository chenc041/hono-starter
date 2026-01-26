import { Hono } from "hono";
import { userRouter } from "~/router/user";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.route("/user", userRouter);

export default app;
