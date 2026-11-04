import { checkIsAuthenticated } from "../middleware/auth.js";
import { myBets } from "../module/api-controller/controller.js";

async function routes(fastify, options) {
  fastify.get(
    "/my-bets",
    {
      preHandler: checkIsAuthenticated,
    },
    myBets
  );
}

export default routes;
