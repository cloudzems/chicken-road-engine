import { createPool } from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();
import { appConfig } from '../utilities/app-config.js';
import { databaseLogger } from '../utilities/logger.js';
const { port, database, password, user, retries, interval, writer, reader, } = appConfig.dbConfig;

const writerConfig = {
    host: writer,     // 👈 writer DB host
    user,
    password,
    database,
    port
};

const readerConfig = {
    host: reader,     // 👈 reader DB host
    user,
    password,
    database,
    port
};

const maxRetries = +retries;
const retryInterval = +interval;

let writerPool;
let readerPool;

const createDatabasePool = async () => {
    let attempts = 0;
    while (attempts < maxRetries) {
        try {
            writerPool = createPool(writerConfig);
            readerPool = createPool(readerConfig);
            databaseLogger.info("DATABASE WRITER & READER POOLS CREATED");
            return;
        } catch (err) {
            attempts += 1;
            console.error(err)
            databaseLogger.error(`DATABASE CONNECTION FAILED. Retry ${attempts}/${maxRetries}. Error: ${err.message}`);
            if (attempts >= maxRetries) {
                databaseLogger.error("Maximum retries reached. Could not connect to the database.");
                process.exit(1);
            }
            await new Promise(res => setTimeout(res, retryInterval));
        }
    }
};

export const read = async (query, params = []) => {
    if (!readerPool) throw new Error('Reader DB not initialized');
    const connection = await readerPool.getConnection();
    try {
        const [results] = await connection.execute(query, params);
        return results;
    } finally {
        connection.release(); // Release the connection back to the pool
    }
};

export const write = async (query, params = []) => {
    if (!writerPool) throw new Error('Writer DB not initialized');
    const connection = await writerPool.getConnection();
    try {
        const [results] = await connection.execute(query, params);
        return results;
    } finally {
        connection.release(); // Release the connection back to the pool
    }
};

export const checkDatabaseConnection = async () => {
    if (!readerPool || !writerPool) {
        await createDatabasePool();
    }
    databaseLogger.info("DATABASE CONNECTION CHECK PASSED");
};

