import { errorLogger } from "./logger.js";
import { appConfig } from "./app-config.js";
import { cashout } from "../module/game/gamePlay.js";
import { emitToUser } from "./common-function.js";

export let intervalId = {};

export function getFireIndex(level) {
  const levels = {
    1: { usedLines: 24, losingCount: 1 },
    2: { usedLines: 22, losingCount: 3 },
    3: { usedLines: 20, losingCount: 5 },
    4: { usedLines: 15, losingCount: 10 },
  };

  if (!levels[level]) return null;

  const { losingCount } = levels[level];
  const totalLines = 25;
  let firePositions = new Set();
  // if (level == 3) {
  //   firePositions = generateNumbers();
  // } else {
  while (firePositions.size < losingCount) {
    firePositions.add(Math.floor(Math.random() * totalLines));
  }
  //}
  let fireArray = Array.from(firePositions).sort((a, b) => a - b);
  console.log(fireArray, "fire arry");
  return fireArray[0];
}

function generateNumbers() {
  let firstThree = new Set();
  let lastTwo = new Set();

  while (firstThree.size < 3) {
    firstThree.add(Math.floor(Math.random() * 8)); // 0 to 7
  }
  while (lastTwo.size < 2) {
    lastTwo.add(Math.floor(Math.random() * 17) + 8); // 8 to 24
  }
  return [...firstThree, ...lastTwo];
}


export function getFinalRow(level) {
  const levels = {
    1: 23,
    2: 21,
    3: 19,
    4: 14,
  };

  return levels[level];
}

export function calculateAllMultipliers() {
  const difficultyLevels = {
    1: 24,
    2: 22,
    3: 20,
    4: 15,
  };

  const riskFactors = {
    1: 0.04,
    2: 0.12,
    3: 0.2,
    4: 0.4,
  };

  let baseMultiplier = 1;
  let allMultipliers = {};

  // Loop through each difficulty level
  for (let difficulty in difficultyLevels) {
    let steps = difficultyLevels[difficulty]; // Get the max steps for this difficulty
    let riskFactor = riskFactors[difficulty]; // Get the risk factor for this difficulty

    let multipliers = [];
    for (let i = 1; i <= steps; i++) {
      let multiplier = baseMultiplier * Math.pow(1 + riskFactor, i);
      multipliers.push(parseFloat(multiplier.toFixed(2)));
    }

    allMultipliers[difficulty] = multipliers;
  }

  return allMultipliers;
}

export const gameData = async (socket) => {
  try {
    let multipliers = calculateAllMultipliers();
    emitToUser({
      socket,
      event: "gameData",
      data: {
        multipliers,
        minBet: appConfig.minBetAmount,
        maxBet: appConfig.maxBetAmount,
      },
    });
  } catch (error) {
    errorLogger.error(`Error fetching game data:- ${error}`);
  }
};

export const timeOut = (io, socket) => {
  let timer = 61;
  const user_id = socket.data.userInfo.userId;
  const key =  `${user_id}`;
  intervalId[key] = setInterval(async () => {
    timer -= 1;
    console.log(timer);
    if (timer == 0) {
      await cashout(io, socket, "Auto Cashout");
      if (intervalId[key])
        clearInterval(intervalId[key]);
    }
  }, 1000);
};
