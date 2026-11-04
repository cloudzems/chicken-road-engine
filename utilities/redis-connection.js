import Redis from "ioredis";
import dotenv from "dotenv";
dotenv.config();
import { appConfig } from "./app-config.js";
import { redisLogger } from "./logger.js";
import { createAdapter } from "@socket.io/redis-adapter";

const { host, port, password, retry, interval } = appConfig.redis;

const redisConfig = {
  host: host,
  port: port,
  password: password,
};

const maxRetries = retry;
const retryInterval = interval;

let redisClient;

const createRedisClient = () => {
  const client = new Redis(redisConfig);

  client.on("error", (err) => {
    redisLogger.error(`REDIS ERROR: ${err.message}`);
  });

  client.on("connect", () => {
    redisLogger.info("REDIS CONNECTION ESTABLISHED");
  });

  client.on("close", () => {
    redisLogger.info("REDIS CONNECTION CLOSED");
  });

  return client;
};

export const initializeRedis = async () => {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      redisClient = createRedisClient();
      await redisClient.set("test", "test"); // Test connection
      await redisClient.del("test"); // Clean up
      redisLogger.info("REDIS CONNECTION SUCCESSFUL");
      return redisClient;
    } catch (err) {
      retries += 1;
      console.error(err);
      redisLogger.error(
        `REDIS CONNECTION FAILED. Retry ${retries}/${maxRetries}. Error: ${err.message}`,
      );
      if (retries >= maxRetries) {
        redisLogger.error(
          "Maximum retries reached. Could not connect to Redis.",
        );
        process.exit(1); // Exit the application with failure
      }
      await new Promise((res) => setTimeout(res, retryInterval));
    }
  }
};

export const getRedisDuplicate = () => {
  if (!redisClient) {
    throw new Error("Redis not initialized");
  }

  return redisClient.duplicate();
};

export const setupRedisAdapter = (io) => {
  const pubClient = getRedisDuplicate();
  const subClient = getRedisDuplicate();

  pubClient.on("error", (err) => {
    redisLogger.error(`REDIS PUB CLIENT ERROR: ${err.message}`);
  });

  subClient.on("error", (err) => {
    redisLogger.error(`REDIS SUB CLIENT ERROR: ${err.message}`);
  });

  io.adapter(createAdapter(pubClient, subClient));

  redisLogger.info("Socket.IO Redis Adapter Initialized");
};

// Redis Operations
export const setCache = async (key, value, ttl = 3600) => {
  if (!redisClient) await initializeRedis();
  try {
    await redisClient.set(key, value, "EX", ttl);
  } catch (error) {
    console.error("Failed to set cache:", error.message);
    redisLogger.error(`Failed to set cache: ${error}`);
  }
};

export const setTempCache = async (key, value, ttl = 60) => {
  if (!redisClient) await initializeRedis();
  try {
    console.log("in set temp cache");
    await redisClient.set(key, value, "EX", ttl);
  } catch (error) {
    cosnole.error("Failed to set cache:", error.message);
    redisLogger.error(`Failed to set cache: ${error}`);
  }
};

export const getCache = async (key) => {
  if (!redisClient) await initializeRedis();
  try {
    const value = await redisClient.get(key);
    if (value) {
      return value;
    } else {
      console.info(`Cache not found: ${key}`);
      return null;
    }
  } catch (error) {
    console.error("Failed to get cache:", error.message);
    redisLogger.error(`Failed to get cache: ${error}`);
    return null;
  }
};

export const deleteCache = async (key) => {
  if (!redisClient) await initializeRedis();
  try {
    await redisClient.del(key);
  } catch (error) {
    console.error("Failed to delete cache:", error.message);
    redisLogger.error(`Failed to get cache: ${error}`);
  }
};

export const incrementCache = async (key, amount = 1) => {
  if (!redisClient) await initializeRedis();
  try {
    const newValue = await redisClient.incrby(key, amount);
    return newValue;
  } catch (error) {
    console.error("Failed to increment cache:", error.message);
    redisLogger.error(`Failed to increment cache: ${error}`);
    return null;
  }
};

export const setHashField = async (hash, field) => {
  if (!redisClient) await initializeRedis();
  try {
    await redisClient.hset(hash, field);
  } catch (error) {
    console.error("Failed to increment cache:", error);
    redisLogger.error(`Failed to set hash field:- ${error}`);
  }
};

export const deleteHashField = async (hash) => {
  if (!redisClient) await initializeRedis();
  try {
    await redisClient.del(hash);
  } catch (error) {
    console.error("Failed to set hash cache:", error);
    redisLogger.error(`Failed to delete hash field:-${error}`);
  }
};

export const getHashField = async (hash) => {
  if (!redisClient) await initializeRedis();
  try {
    const value = await redisClient.hgetall(hash);
    if (value) {
      return value;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Failed to get hash cache:", error);
    redisLogger.error(`Failed to get hash field:- ${error}`);
    return null;
  }
};

export const getAllBetHash = async (key) => {
  try {
    let cursor = "0";
    const allKeys = [];

    do {
      const [nextCursor, keys] = await redisClient.scan(cursor, "MATCH", key);
      allKeys.push(...keys);
      cursor = nextCursor;
    } while (cursor !== "0");

    return allKeys;
  } catch (error) {
    console.error("Failed to get all hash cache:", error);
    redisLogger.error(`Failed to get all hash bet:- ${error}`);
  }
};
