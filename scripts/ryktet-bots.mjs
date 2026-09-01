import { io } from "socket.io-client";

const PIN = process.env.BOT_PIN ?? "4385";
const bots = [
  { name: "Melany", playerId: "5424133d8c9ef1fb" },
  { name: "Jonas", playerId: "59a393907e3f125f" },
  { name: "Nora", playerId: "240f8945433fc110" },
];

/** Tiny valid PNG so bots can submit a "drawing". */
const DOT =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

const guesses = [
  "a moose",
  "chaos",
  "the cabin",
  "someone sneaking out",
  "karaoke",
  "a raccoon",
];

for (const bot of bots) {
  const socket = io("http://localhost:3001", { transports: ["websocket"] });
  let playerId = bot.playerId;
  let submittedTurn = -1;

  socket.on("connect", () => {
    socket.emit("room:rejoin", { pin: PIN, playerId }, (res) => {
      if (res?.ok && res.playerId) {
        playerId = res.playerId;
        console.log(`${bot.name} rejoined`);
        return;
      }
      socket.emit("room:join", { pin: PIN, name: bot.name }, (joinRes) => {
        console.log(`${bot.name} join`, joinRes);
        if (joinRes?.ok && joinRes.playerId) playerId = joinRes.playerId;
      });
    });
  });

  socket.on("connect_error", (err) => {
    console.error(`${bot.name} connect error`, err.message);
  });

  socket.on("room:state", (state) => {
    const game = state.ryktetGar;
    if (!game || game.phase !== "playing" || !game.inRound || game.hasSubmitted) {
      return;
    }
    if (submittedTurn === game.turnIndex) return;
    submittedTurn = game.turnIndex;
    const delay = 350 + Math.floor(Math.random() * 900);
    setTimeout(() => {
      if (game.turnKind === "drawing") {
        socket.emit("ryktetGar:submit", { image: DOT });
        console.log(`${bot.name} drew turn ${game.turnIndex}`);
      } else {
        const text = guesses[Math.floor(Math.random() * guesses.length)];
        socket.emit("ryktetGar:submit", { text });
        console.log(`${bot.name} guessed "${text}"`);
      }
    }, delay);
  });
}

console.log(`Ryktet går bots ready for PIN ${PIN}`);
