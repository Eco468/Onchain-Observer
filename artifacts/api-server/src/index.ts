import http from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { createWss } from "./lib/websocket";
import { startEventSimulator } from "./lib/eventSimulator";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);

createWss(server);

server.listen(port, () => {
  logger.info({ port }, "Server listening");
  startEventSimulator().catch((err) => {
    logger.error({ err }, "Failed to start event simulator");
  });
});

server.on("error", (err) => {
  logger.error({ err }, "Server error");
  process.exit(1);
});
