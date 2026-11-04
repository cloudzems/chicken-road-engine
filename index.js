import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";
import { initSocket } from "./socket.js";
import { checkDatabaseConnection } from "./db/db-connection.js";
import { initializeRedis, setHashField, setupRedisAdapter } from "./utilities/redis-connection.js";
import router from "./router/api-routes.js";
import { logger } from "./utilities/logger.js";
import { gameDetails } from "./utilities/common-function.js";
import { appConfig } from "./utilities/app-config.js";

const startServer = async () => {
  try {
    await Promise.all([checkDatabaseConnection(), initializeRedis()]);
    const fastify = Fastify({
      logger: false,
    });

    await fastify.register(cors, {
      origin: appConfig.frontendURL,
      methods: ["GET", "POST"],
    });
    const io = new Server(fastify.server, {
      cors: {
        origin: appConfig.frontendURL,
        methods: ["GET", "POST"],
      },
      pingInterval: 1000, // Ping every 1 seconds
      pingTimeout: 1000,
    });
    setupRedisAdapter(io);
    fastify.register(router, { prefix: "/api" });

    const gameData = await gameDetails();

    if (gameData.data.length) {
      const data = gameData.data[0];
      await setHashField(`GD:${appConfig.gameName}`, data);
    } else {
      console.error("error in fetiching gamedata", gameData);
    }
    initSocket(io);
    fastify.get("/", async (request, reply) => {
      return {
        status: true,
        message: `${appConfig.gameName} Game server is up and running`,
      };
    });

    await fastify.listen({ port: appConfig.port });
    logger.info(`Server listening at PORT ${appConfig.port}`);
  } catch (error) {
    console.error("Server.js:- ", error);
    logger.error(JSON.stringify(error));
  }
};

startServer();
