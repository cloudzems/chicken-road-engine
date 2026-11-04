import {
  getCache,
  setCache,
} from "../../utilities/redis-connection.js";
import {
  creditBalance,
  emitToUser,
  generateUUIDv7,
  postDataToSourceForBet,
  prepareDataForWebhook,
} from "../../utilities/common-function.js";
import {
  calculateAllMultipliers,
  getFinalRow,
  getFireIndex,
  intervalId,
  timeOut,
} from "../../utilities/helper-function.js";
import { appConfig } from "../../utilities/app-config.js";
import {
  insertData,
  insertDataLoose,
  insertDataWin,
} from "../../db/db-queries.js";
import { uuidv7 } from "uuidv7";
import {
  betLogger,
  cashoutLogger,
  failedBetLogger,
  invalidBetLogger,
} from "../../utilities/logger.js";

export const gameState = {};
export let betObj = {};
export let fireIndexObj = {};
let allUsersMultipliers = {};
let userCashout = [];

export const startMatch = async (io, socket, betAmount, level) => {
  const userId = socket.data.userInfo.userId;
  const key = `${userId}`;
  level = Number(level);
  if (level > 4 || isNaN(level)) {
     return emitToUser({
        socket,
        event: "error",
        data: {
          type: "betError",
          msg: `${level} > 4
            ? "Level cannot be greater than 4"
            : "Level should be a number"`,
        },
      });
  }
  if (!betObj[key]) {
    await handleBet(io, socket, betAmount, level);
  } else {
    emitToUser({
        socket,
        event: "error",
        data: {
          type: "betError",
          msg: `Bet is already placed`,
        },
      });

    emitToUser({
        socket,
        event: "gamePlay",
        data: gameState[key]
      });  
  }
};

//handle bets and Debit transation---------------------------------------
export const handleBet = async (io, socket, betAmount, level) => {
  const user_id = socket.data?.userInfo.userId;
  const key = `${user_id}`;
  let playerDetails = await getCache(`PL:${key}`);
  if (!playerDetails) {
    return emitToUser({
      socket,
      event: "error",
      data: {
        type: "betError",
        msg: `Invalid Player Details`,
      },
    });
  }    
  const parsedPlayerDetails = JSON.parse(playerDetails);
  const { userId, token, game_id, balance, socketId } =
    parsedPlayerDetails;
  const matchId = generateUUIDv7();
  const bet_id = `BT:${matchId}:${key}`;
  betAmount = parseFloat(betAmount);
  betObj[key] = betObj[key] || {};
  Object.assign(betObj[key], {
    betAmount,
    bet_id,
    token,
    socket_id: parsedPlayerDetails.socketId,
    game_id,
    matchId,
    creditTxnId: uuidv7(),
  });
  if (typeof betAmount !== "number" || isNaN(betAmount)) {
     return emitToUser({
      socket,
      event: "error",
      data: {
        type: "betError",
        msg: "Bet Amount should be number",
      },
    });
  }

  if (
    betAmount < appConfig.minBetAmount ||
    betAmount > appConfig.maxBetAmount ||
    betAmount > balance
  ) {
    const gameLog = {
      logId: generateUUIDv7(),
      res: "Invalid Bet",
      player: parsedPlayerDetails,
      betAmount: betAmount,
    };
    invalidBetLogger.error(gameLog);
    delete betObj[key];
    delete gameState[key];
    return emitToUser({
      socket,
      event: "error",
      data: {
        type: "betError",
        msg:
          betAmount < appConfig.minBetAmount
            ? "Bet Amount cannot be less than Rs.10"
            : betAmount > appConfig.maxBetAmount
              ? `Bet Amount cannot be greater than Rs.${appConfig.maxBetAmount}`
              : "Insufficient balance",
      },
    });
  }
  const webhookData = await prepareDataForWebhook(
    {
      matchId,
      betAmount: betAmount,
      game_id,
      user_id: user_id,
      bet_id,
    },
    "DEBIT",
    socket,
  );
  betObj[key].txn_id = webhookData.txn_id;
  betObj[key].ip = webhookData.ip;

  const debit = await postDataToSourceForBet({
    webhookData,
    token,
    socketId: parsedPlayerDetails.socketId,
  });

  if (!debit.response.status) {
    const gameLog = {
      logId: generateUUIDv7(),
      player: parsedPlayerDetails,
      res: "bet cancel by upstream",
      betObj: betObj[key],
    };
    failedBetLogger.error({ response: debit.response, gameLog });
    delete betObj[key];
    delete gameState[key];
    return emitToUser({
      io,
      id:parsedPlayerDetails.socketId,
      event: "error",
      data: {
        type: "betError",
        msg: "Bet cancelled by upstream",
      },
    });
  }
  await insertData({
    bet_id: bet_id,
    user_id: user_id,
    matchId: matchId,
    betAmount: betAmount,
    betStatus: "success",
    betRequest: { webhookData, token, socketId },
    betResponse: debit.response,
    betTransactionId: betObj[key].txn_id,
  });
  parsedPlayerDetails.balance = Number(
    Number(balance) - Number(betAmount),
  ).toFixed(2);
  await setCache(`PL:${key}`, JSON.stringify(parsedPlayerDetails),);

  const gameLog = {
    logId: generateUUIDv7(),
    player: parsedPlayerDetails,
    betObj: betObj[key],
    betAmount: betAmount,
  };
  betLogger.info(JSON.stringify({ ...gameLog }));

   emitToUser({
     io,
     id: parsedPlayerDetails.socketId,
     event: "bet",
     data: {
       message: "Bet placed Successfully",
       balance: Number(parsedPlayerDetails.balance).toFixed(2),
     },
   });


  gameState[key] = {
    level: Number(level),
    gameOver: false,
    payout: 0,
    multiplier: 0,
    fire: null,
  };
  await gamePlay(io, socket, "0");
};

export const gamePlay = async (io, socket, index) => {
  const user_id = socket.data?.userInfo.userId;
  const key = `${user_id}`;

  if (!gameState[key]) {
    return emitToUser({
      socket,
      event: "error",
      data: {
        type: "gameError",
        msg: "User game state not found.",
      },
    });
  }
  const level = gameState[key].level;
  index = Number(index);
  const finalRow = getFinalRow(level);
  //condition for last row
  if (index <= gameState[key]?.line) {
    return emitToUser({
      socket,
      event: "error",
      data: {
        type: "gameError",
        msg: "Current row cannot equal or less than last row.",
      },
    });
  }

  if (index > gameState[key]?.line + 1) {
    return emitToUser({
      socket,
      event: "error",
      data: {
        type: "gameError",
        msg: "Index cannot be higher than Current line",
      },
    });
  }
  if (index > finalRow) {
    return emitToUser({
      socket,
      event: "error",
      data: {
        type: "gameError",
        msg: "Row cannot be greater than finalRow",
      },
    });
  }
  if (intervalId[key]) clearInterval(intervalId[key]);

  if (index === appConfig.firstIndex) {
    const fire = getFireIndex(level);
    fireIndexObj[key] = fire;
    console.log(user_id, fireIndexObj[key], "fireballj");
    let multipliers = calculateAllMultipliers();
    allUsersMultipliers[key] = multipliers[level];
    gameState[key].multiplier = allUsersMultipliers[key][index];
    console.log(allUsersMultipliers[key]);
  }
  if (allUsersMultipliers[key]) {
    gameState[key].multiplier = allUsersMultipliers[key][index];
  }
  gameState[key].line = index;

  gameState[key].payout = Number(
    (Number(betObj[key]?.betAmount) * gameState[key].multiplier).toFixed(2),
  );

  if (fireIndexObj[key] == index) {
    gameState[key].gameOver = true;
    gameState[key].payout = 0;
    gameState[key].fire = fireIndexObj[key];
    emitToUser({
      socket,
      event: "gamePlay",
      data: gameState[key],
    });

    await insertDataLoose({
      is_declared: 1,
      gameData: gameState[key],
      winStatus: "Lose",
      betTransactionId: betObj[key].txn_id,
      user_id: user_id,
      matchId: betObj[key].matchId,
      resultStatus: "success",
    });

    delete gameState[key];
    delete betObj[key];
    delete fireIndexObj[key];
    return emitToUser({
      socket,
      event: "gameOver",
      data: "You lose! You hit a fireball!",
    });
  }
  if (Number(index) === finalRow) {
    emitToUser({
      socket,
      event: "gamePlay",
      data: gameState[key],
    });
    await cashout(io, socket);
    return;
  }

  emitToUser({
    socket,
    event: "gamePlay",
    data: gameState[key],
  });
  timeOut(io, socket);
};

export const cashout = async (io, socket, cashoutType = "Cashout") => {
  const user_id = socket.data?.userInfo.userId;
  const key = `${user_id}`;
  let playerDetails = await getCache(`PL:${key}`);
  if (!playerDetails) {
    return emitToUser({
      socket,
      event: "error",
      data: {
        type: "cashoutError",
        msg: "Invalid player details",
      },
    });
  }
  if (intervalId[key]) {
    clearInterval(intervalId[key]);
  }
  const parsedPlayerDetails = JSON.parse(playerDetails);
  const { userId, token, game_id, balance, socketId } =
    parsedPlayerDetails;
  if (!betObj[key]) {
    return emitToUser({
      io,
      id: socketId,
      event: "error",
      data: {
        type: "cashoutError",
        msg: "No bet found.",
      },
    });
  }

  const userCashoutId = `${betObj[key].bet_id}:${betObj[key].matchId}`;
  try {
    const findUserCashout = userCashout.find((id) => id === userCashoutId);
    if (findUserCashout) {
      return emitToUser({
        socket,
        event: "error",
        data: {
          type: "cashoutError",
          msg: "User cashout request is in process.",
        },
      });
    }
    userCashout.push(userCashoutId);
    const multiplier = gameState[key]?.multiplier;
    const userBetData = betObj[key];
    if (!userBetData) {
      return emitToUser({
        io,
        id: socketId,
        event: "error",
        data: {
          type: "cashoutError",
          msg: "No bet data found",
        },
      });
    }
    let final_amount = Number(gameState[key].payout);

    if (final_amount > appConfig.maxWinAmount) {
      final_amount = appConfig.maxWinAmount;
    }

    const webhookData = await prepareDataForWebhook(
      {
        user_id: user_id,
        final_amount,
        game_id: userBetData.game_id,
        txnId: userBetData.txn_id,
        matchId: userBetData.matchId,
        creditTxnId: userBetData.creditTxnId,
      },
      "CREDIT",
      socket,
      cashoutType,
    );
    gameState[key].fire = fireIndexObj[key];
    await insertDataWin({
      is_declared: true,
      resultRequest: { webhookData, token },
      resultStatus: "success",
      resultTransactionId: userBetData?.creditTxnId,
      winAmount: final_amount,
      betTransactionId: userBetData.txn_id,
      user_id,
      matchId: userBetData.matchId,
      winStatus: "Win",
      gameData: gameState[key],
    });

    await creditBalance({
      webhookData: webhookData,
      token:  userBetData.token,
    })

    const cashoutLog = {
      logId: generateUUIDv7(),
      socketId: parsedPlayerDetails.socketId,
    };

    parsedPlayerDetails.balance = Number(
      Number(parsedPlayerDetails.balance) + Number(final_amount),
    ).toFixed(2);
    await setCache(`PL:${key}`, JSON.stringify(parsedPlayerDetails));

    cashoutLogger.info(
      JSON.stringify({
        ...cashoutLog,
        parsedPlayerDetails,
        final_amount,
        bet_id: userBetData.bet_id,
        txnId: userBetData.creditTxnId,
        ref_txnId: userBetData.txn_id,
      }),
    );

    emitToUser({
      io,
      id: socketId,
      event: "win",
      data: { final_amount, multiplier, balance: parsedPlayerDetails.balance },
    });

    delete betObj[key];
    delete gameState[key];
    delete fireIndexObj[key];
    userCashout = userCashout.filter((item) => !item.includes(userCashoutId));
  } catch (error) {
    console.error(error);
    userCashout = userCashout.filter((item) => !item.includes(userCashoutId));
    throw error;
  }
};
