import { databaseLogger } from "../utilities/logger.js";
import { write } from "./db-connection.js";
export const insertData = async (betData) => {
  try {
    const SQL_INSERT_BETS =
      "INSERT INTO bets (bet_id, match_id, user_id, bet_amount, bet_status, bet_request, bet_response, bet_transaction_id) VALUES(?,?,?,?,?,?,?,?)";
    const {
      bet_id,
      matchId,
      user_id,
      betAmount,
      betStatus,
      betRequest,
      betResponse,
      betTransactionId,
    } = betData;
    await write(SQL_INSERT_BETS, [
      bet_id,
      matchId,
      decodeURIComponent(user_id),
      betAmount,
      betStatus,
      betRequest,
      betResponse,
      betTransactionId,
    ]);
    console.log("bets added successfully");
  } catch (err) {
    console.error(err);
    databaseLogger.error(err)
  }
};

export const insertDataLoose = async (betData) => {
  try {
    const SQL_UPDATE_BETS = `
      UPDATE bets 
      SET is_declared = ?,
          game_data = ?,
          win_status = ?, 
          result_status = ?
      WHERE bet_transaction_id = ? AND user_id = ? AND match_id = ?`;
    const {
      is_declared,
      gameData,
      winStatus,
      betTransactionId,
      user_id,
      matchId,
      resultStatus,
    } = betData;
    await write(SQL_UPDATE_BETS, [
      is_declared,
      gameData,
      winStatus,
      resultStatus,
      betTransactionId,
      decodeURIComponent(user_id),
      matchId,
    ]);
    console.log("loose data updated successfully");
  } catch (err) {
    console.error(err);
    databaseLogger.error(err)
  }
};

export const insertDataWin = async (betData) => {
  try {
    const SQL_UPDATE_BETS = `
        UPDATE bets 
        SET is_declared = ?,
            result_request = ?,
            result_status = ?, 
            result_transaction_id = ?, 
            win_amount = ?,
            win_status= ?,
            game_data= ?
        WHERE bet_transaction_id = ? AND result_transaction_id IS NULL AND user_id = ? AND match_id = ?`;
    const {
      is_declared,
      resultRequest,
      resultStatus,
      resultTransactionId,
      winAmount,
      betTransactionId,
      user_id,
      matchId,
      winStatus,
      gameData,
    } = betData;
    await write(SQL_UPDATE_BETS, [
      is_declared,
      resultRequest,
      resultStatus,
      resultTransactionId,
      winAmount,
      winStatus,
      gameData,
      betTransactionId,
      decodeURIComponent(user_id),
      matchId,
    ]);
    console.log("winDAta updated successfully");
  } catch (err) {
    console.error(err);
    databaseLogger.error(err)
  }
};




