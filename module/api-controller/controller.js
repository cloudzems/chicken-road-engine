import { read } from "../../db/db-connection.js";
import { errorLogger } from "../../utilities/logger.js";

export const myBets = async (request, reply) => {
  try {
    const { user_id } = request.query;
    if (!user_id) {
      return reply.status(400).send({ message: "User ID is required" });
    }
    const data = await read(
      `SELECT 
      user_id,
      match_id, 
      bet_amount, 
      win_amount, 
      CONVERT_TZ(created_at, '+00:00', '+05:30') AS time, 
      CASE 
          WHEN win_amount > 0  
          THEN JSON_UNQUOTE(JSON_EXTRACT(game_data, '$.multiplier'))
          ELSE '-' 
      END AS multiplier
      FROM bets 
      WHERE user_id = ?
      ORDER BY created_at DESC LIMIT 30`,
      [decodeURIComponent(user_id)]
    );
    return reply.send({
      message: "User history fetched successfully",
      myBets: data,
    });
  } catch (error) {
    errorLogger.error(`${error}`)
    return reply.status(500).send({ message: "Internal Server Error" });
  }
};


