import axios from "axios";
import { errorLogger } from "../../utilities/logger.js";
import { appConfig } from "../../utilities/app-config.js";

export const getUserDataFromSource = async (token, game_id) => {
  try {
    const data = await axios.get(
      `${appConfig.serviceBaseURL}/services/player/details`,
      {
        headers: {
          token: token,
        },
      }
    );
    const userData =data?.data?.data;
    if (userData) {
      const userId = encodeURIComponent(userData.user_id);
      const finalData = { ...userData, userId, game_id, token };
      return finalData;
    }
    return;
  } catch (err) {
    errorLogger.error(`${err}`)
    return false;
  }
};
