import {
  cashout,
  gamePlay,
  startMatch,
} from "../module/game/gamePlay.js";
import { gameData } from "../utilities/helper-function.js";
export const registerEvents = async (io, socket) => {
  socket.on("message", (data) => {
    
   const eventName = data.eventName;
    switch (eventName) {
      case "placeBet":
        //data= {eventName:"string", betAmount:number, level:number}
        return startMatch(io, socket, data.betAmount, data.level);
      case "cashout":
         //data= {eventName:"string"}
        return cashout(io, socket);
      case "jump":
        //data= {eventName:"string", index:number}
        return gamePlay(io, socket, data.index);
      case "gameData":
       //data= {eventName:"string"}
        return gameData(socket);
    }
  });
};
