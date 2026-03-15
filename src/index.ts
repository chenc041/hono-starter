import { createApp } from "~/app";
import { getEnv } from "~/core/config/env";

const env = getEnv();
const app = createApp();

export default {
  port: env.PORT,
  fetch: app.fetch,
  idleTimeout: 0,
};
