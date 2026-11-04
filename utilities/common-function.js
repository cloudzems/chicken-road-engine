import axios from "axios";
import crypto from "crypto";
import {
  errorLogger,
  failedBetLogger,
  failedThirdPartyLogger,
  thirdPartyLogger,
  webHookLogger,
} from "./logger.js";
import { uuidv7 } from "uuidv7";
import { appConfig } from "./app-config.js";

export const generateUUIDv7 = () => {
  const id = uuidv7()
  return id;
};

export const prepareDataForWebhook = async (betObj, key, socket) => {
  try {
    let {
      betAmount,
      game_id,
      bet_id,
      user_id,
      txnId,
      matchId,
      final_amount,
      creditTxnId,
    } = betObj;
    let userIP = socket?.handshake?.address || "";
    if (socket && socket.handshake.headers["x-forwarded-for"]) {
      userIP = socket.handshake.headers["x-forwarded-for"].split(",")[0].trim();
    }
    let obj = {
      amount: Number(betAmount).toFixed(2),
      txn_id: creditTxnId ? creditTxnId : generateUUIDv7(),
      ip: userIP,
      game_id,
      matchId,
      user_id: decodeURIComponent(user_id),
    };
    switch (key) {
      case "DEBIT":
        obj.description = `${obj.amount} Debited for ${appConfig.gameName} Game for Round Id ${matchId} `;
        obj.bet_id = bet_id;
        obj.txn_type = 0;
        break;
      case "CREDIT":
        obj.amount = Number(final_amount).toFixed(2);
        obj.txn_ref_id = txnId;
        obj.description = `${Number(final_amount).toFixed(2)} Credited for ${
          appConfig.gameName
        } Game for Round Id ${matchId}`;
        obj.txn_type = 1;
        break;
      default:
        obj;
    }
    return obj;
  } catch (err) {
    console.error(err);
    errorLogger.error(
      `[ERR] while trying to prepare data for webhook is::${err}`,
    );
    return false;
  }
};

export const postDataToSourceForBet = async (data) => {
  webHookLogger.info({ data });
  const { webhookData, token, socketId } = data;

  const clientServerOptions = {
    method: "PATCH",
    url: `${appConfig.serviceBaseURL}/services/player/balance/debit`,
    headers: { token },
    data: webhookData,
    timeout: 5000,
  };

  try {
    const result = await axios(clientServerOptions);
    thirdPartyLogger.info(JSON.stringify({ req: data, res: result?.data }));

    return {
      response: result.data,
      status: result.status,
      ...webhookData,
      socketId,
    };
  } catch (err) {
    console.error(err);
    const response = err.response ? err.response.data : "Something went wrong";

    failedThirdPartyLogger.error(
      JSON.stringify({ req: { webhookData, token }, res: response }),
    );

    return {
      response,
      socketId,
    };
  }
};

export const creditBalance = async (data) => {
  const { webhookData, token } = data;
  const clientServerOptions = {
    method: "PATCH",
    url: `${appConfig.serviceBaseURL}/services/player/balance/credit`,
    headers: { token },
    data: webhookData,
    timeout: 5000,
  };

  try {
    const result = await axios(clientServerOptions);

    thirdPartyLogger.info(JSON.stringify({ req: data, res: result?.data }));

    return {
      response: result.data,
      status: result.status,
      ...webhookData,
    };
  } catch (err) {
    const response = err.response ? err.response.data : "Something went wrong";

    failedThirdPartyLogger.error(
      JSON.stringify({ req: { webhookData, token }, res: response })
    );

    return {
      response,
    };
  }
};

export function emitToUser({
  io = null,
  socket = null,
  id = null,
  event,
  data,
}) {
  if (io && id) {
    io.to(id).emit("response", {
      eventName: event,
      message: data,
    });
  } else if (socket) {
    socket.emit("response", {
      eventName: event,
      message: data,
    });
  } else {
    console.warn("No valid io/socket provided for emit");
  }
}

export const gameDetails = async () => {
  try {
   const data = await axios.post(
      `${appConfig.serviceBaseURL}/services/game/details`,
      {
        backend_url: appConfig.backendURL,
      }
    );
   return data.data;
  } catch (err) {
    console.error(err);
    errorLogger.error(err);
    return false;
  }
};
