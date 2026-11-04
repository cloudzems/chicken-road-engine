import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const fileName = fileURLToPath(import.meta.url);
const dirName = path.dirname(fileName);

const logDir = path.resolve(dirName, "../logs");

// Ensure logs directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const { combine, timestamp, printf, colorize, json } = winston.format;

const customFormat = printf(({ timestamp, level, message }) => {
  return `${timestamp} ${level} : ${message}`;
});

// configer winston logger

export function createLogger(name) {
  return winston.createLogger({
    format: combine(timestamp(), json()),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          json(),
          timestamp(),
          colorize({ all: true }),
          customFormat,
        ),
      }),

      new DailyRotateFile({
        dirname: logDir,
        filename: `${name}-%DATE%.jsonl`,
        datePattern: "YYYY-MM-DD",
        zippedArchive: false,
        maxSize: "20m",
        maxFiles: "15d",
      }),
    ],
  });
}

export const logger = createLogger("server");
export const betLogger = createLogger("bets");
export const cashoutLogger = createLogger("cashout");
export const creditSuccessLogger = createLogger("creditSuccess");
export const creditFailLogger = createLogger("creditFail");
export const rabbitMQLogger = createLogger("rabitMQ");
export const thirdPartyLogger = createLogger("thirdParty");
export const databaseLogger = createLogger("database");
export const failedBetLogger = createLogger("failedbet");
export const failedGameLogger = createLogger("failedGame");
export const redisLogger = createLogger("redis");
export const invalidBetLogger = createLogger("invalid");
export const errorLogger = createLogger("error");
export const failedThirdPartyLogger = createLogger("failedThirdParty");
export const failedRollback = createLogger("failedRollback");
export const rollbackRetry = createLogger("rollbackRetry");
export const webHookLogger = createLogger("webHookdata");
export const gameidLogger = createLogger("gameID");
