import { betObj, cashout, gameState } from "./module/game/gamePlay.js";
import { getUserDataFromSource } from "./module/players/player-data.js";
import { registerEvents } from "./router/event-route.js";
import { appConfig } from "./utilities/app-config.js";
import { emitToUser, gameDetails } from "./utilities/common-function.js";
import { gameData } from "./utilities/helper-function.js";
import { gameidLogger, logger } from "./utilities/logger.js";
import {
  deleteCache,
  getCache,
  getHashField,
  setCache,
  setHashField,
  setTempCache,
} from "./utilities/redis-connection.js";

export const initSocket = (io) => {
  const onConnection = async (socket) => {
    console.log("socket connected");
    const token = socket.handshake.headers.authorization?.split(" ")[1];
    if (!token) {
      socket.disconnect(true);
      return console.log("No Token Provided", token);
    }
    let gameSettings = await getHashField(`GD:${appConfig.gameName}`);
    if (!gameSettings.game_id) {
      gameSettings = await gameDetails();
      if (gameSettings.data.length) {
        const data = gameSettings.data[0];
        gameSettings = data;
        await setHashField(`GD:${appConfig.gameName}`, data);
      } else {
        console.error("error in fetiching gamedata", gameSettings);
        return emitToUser({
          socket,
          event: "error",
          data: {
            type: "authError",
            msg: "No Game ID found",
          },
        });
      }
    }
    const game_id = gameSettings?.game_id;
    const userData = await getUserDataFromSource(token, game_id);
    gameidLogger.info({ game_id, userData });
    socket.data["userInfo"] = userData;
    if (!userData) {
      console.log("Invalid token", token);
      return socket.disconnect(true);
    }

    emitToUser({
      socket,
      event: "userInfo",
      data: {
        userId: userData.userId,
        userName: userData.name,
        balance: Number(userData.balance).toFixed(2),
      },
    });

    const key = `${userData.userId}`;
    const existingPlayer = await getCache(`PL:${key}`);
    const parsedExistingPlayer = JSON.parse(existingPlayer);
    if (parsedExistingPlayer) {
      const previousSocket = io.sockets.sockets.get(
        parsedExistingPlayer.socketId,
      );

      if (previousSocket) {
        console.log("socket disconnected");
        emitToUser({
          socket: previousSocket,
          event: "existingUser",
          data: "User exist in another tab.",
        });
        previousSocket.disconnect(true);
        await deleteCache(`PL:${key}`);
      } else {
        console.log(`Socket ${parsedExistingPlayer.socketId} not found.`);
      }
    }

    await setCache(
      `PL:${key}`,
      JSON.stringify({ ...userData, socketId: socket.id }),
      3600,
    );

    if (gameState[key]) {
      gameState[key].betAmount = betObj[key]?.betAmount;
      emitToUser({
        socket,
        event: "reconnection",
        data: gameState[key],
      });
    }
    registerEvents(io, socket);
    socket.on("disconnect", async () => {
      if (gameState[key]) {
        await setTempCache(
          `PL:${key}`,
          JSON.stringify({ ...userData, socketId: socket.id }),
          70,
        );
      }
    });
    socket.on("error", (error) => {
      console.error(`Socket error: ${socket.id}. Error: ${error.message}`);
      logger.error(error);
    });
  };
  io.on("connection", onConnection);
};
