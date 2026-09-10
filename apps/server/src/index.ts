import { createApp } from "./app.js";
import { loadRuntimeConfig } from "./config.js";

const config = loadRuntimeConfig();
const app = createApp(config);

app.listen(config.PORT, () => {
  console.log(JSON.stringify({ event: "server_started", port: config.PORT, network: config.HEDERA_NETWORK }));
});

