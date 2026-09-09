import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

app.listen(env.PORT, env.NODE_ENV === "production" ? "127.0.0.1" : "0.0.0.0", () => {
  console.log(`API listening on http://localhost:${String(env.PORT)}`);
});
