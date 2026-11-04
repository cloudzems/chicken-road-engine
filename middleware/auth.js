import { getUserDataFromSource } from "../module/players/player-data.js";
import { errorLogger } from "../utilities/logger.js";

export async function checkIsAuthenticated(req, res, next) {
  try {
    const { user_id } = req.query;
    const { token } = req.headers;
    if (!token || Array.isArray(token)) {
      res.status(401).json({ success: false, msg: "Token missing or invalid" });
      return;
    }

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }
    const userData = await getUserDataFromSource(token);
    if (!userData) {
      res.status(401).json({ success: false, msg: "Invalid Token" });
      return;
    }

    if (decodeURIComponent(user_id) !== decodeURIComponent(userData.userId)) {
      return res.status(401).json({ success: false, msg: "Inavlid User" });
    }
    next();
  } catch (error) {
    errorLogger.error(JSON.stringify(error));
    res.status(500).json({ success: false, msg: "Internal Server Error" });
    return;
  }
}
