import type { Locale } from "../../shared/types.js";

const messages = {
  en: {
    nameLength: "Name must be 1–20 characters.",
    nameLetters: "Name can only use letters.",
    chooseMode: "Choose a game mode.",
    invalidImage: "Invalid image.",
    roomNotFound: "Room not found. Check the PIN.",
    roomFull: "The room is full.",
    enterName: "Enter a name.",
    nameTaken: "That name is already taken.",
    sessionExpired: "Session expired. Join again with the PIN.",
    onlyHostStart: "Only the host can start.",
    needPlayers: (n: number) => `Need at least ${n} players.`,
    gameInProgress: "A game is already in progress.",
    onlyHostEnd: "Only the host can end the game.",
    onlyHostMode: "Only the host can change the mode.",
    onlyHostLocale: "Only the host can change the language.",
    changeModeLobby: "You can only change mode in the lobby.",
    changeLocaleLobby: "You can only change language in the lobby.",
    fillFields: "Fill in all fields.",
    writingOver: "The writing phase is over.",
    alreadySubmitted: "You have already submitted.",
    gameNotActive: "The game is not active.",
    notReveal: "Not in the reveal phase.",
    onlyHostReveal: "Only the host can control the reveal.",
    onlyHostContinue: "Only the host can continue.",
    onlyHostForceReveal: "Only the host can reveal early.",
    votingClosed: "Voting is closed.",
    notInGame: "You are not in this game.",
    invalidChoice: "Invalid choice.",
    needOneVote: "Need at least one vote.",
    notVoting: "Not in the voting phase.",
    gameOver: "The game is over.",
    waitReveal: "Wait for the reveal.",
  },
  no: {
    nameLength: "Navnet må være 1–20 tegn.",
    nameLetters: "Navnet kan bare inneholde bokstaver.",
    chooseMode: "Velg en spillmodus.",
    invalidImage: "Ugyldig bilde.",
    roomNotFound: "Fant ikke rommet. Sjekk PIN-koden.",
    roomFull: "Rommet er fullt.",
    enterName: "Skriv inn et navn.",
    nameTaken: "Det navnet er allerede tatt.",
    sessionExpired: "Økten er utløpt. Bli med på nytt med PIN.",
    onlyHostStart: "Bare verten kan starte.",
    needPlayers: (n: number) => `Trenger minst ${n} spillere.`,
    gameInProgress: "Et spill er allerede i gang.",
    onlyHostEnd: "Bare verten kan avslutte spillet.",
    onlyHostMode: "Bare verten kan bytte modus.",
    onlyHostLocale: "Bare verten kan bytte språk.",
    changeModeLobby: "Du kan bare bytte modus i lobbyen.",
    changeLocaleLobby: "Du kan bare bytte språk i lobbyen.",
    fillFields: "Fyll inn alle feltene.",
    writingOver: "Skrivefasen er over.",
    alreadySubmitted: "Du har allerede sendt inn.",
    gameNotActive: "Spillet er ikke aktivt.",
    notReveal: "Ikke i avsløringsfasen.",
    onlyHostReveal: "Bare verten styrer avsløringen.",
    onlyHostContinue: "Bare verten kan gå videre.",
    onlyHostForceReveal: "Bare verten kan avsløre tidlig.",
    votingClosed: "Avstemningen er stengt.",
    notInGame: "Du er ikke med i dette spillet.",
    invalidChoice: "Ugyldig valg.",
    needOneVote: "Trenger minst én stemme.",
    notVoting: "Ikke i avstemningsfasen.",
    gameOver: "Spillet er over.",
    waitReveal: "Vent på avsløringen.",
  },
} as const;

export type MsgKey = keyof typeof messages.en;

export function t(
  locale: Locale | undefined,
  key: MsgKey,
  ...args: number[]
): string {
  const pack = messages[locale === "no" ? "no" : "en"];
  const value = pack[key];
  if (typeof value === "function") {
    return value(args[0] ?? 0);
  }
  return value;
}
