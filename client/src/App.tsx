import { LocaleProvider } from "./i18n/LocaleContext";
import { useGame } from "./hooks/useGame";
import { AgeGate } from "./screens/AgeGate";
import { BakRyggen } from "./screens/BakRyggen";
import { Home } from "./screens/Home";
import { Lobby } from "./screens/Lobby";
import { Spicy } from "./screens/Spicy";
import { VoteOff } from "./screens/VoteOff";

export default function App() {
  const game = useGame();

  return (
    <LocaleProvider roomLocale={game.room?.locale}>
      <AppBody game={game} />
    </LocaleProvider>
  );
}

function AppBody({ game }: { game: ReturnType<typeof useGame> }) {
  if (!game.ageConfirmed) {
    return <AgeGate onConfirm={game.confirmAge} />;
  }

  if (!game.room) {
    return (
      <Home
        busy={game.busy}
        error={game.error}
        connected={game.connected}
        onCreate={game.createRoom}
        onJoin={game.joinRoom}
        onError={game.setError}
      />
    );
  }

  if (game.room.mode === "bakRyggen" && game.room.bakRyggen) {
    return (
      <BakRyggen
        bak={game.room.bakRyggen}
        playerNames={game.room.players.map((p) => p.name)}
        isHost={game.isHost}
        error={game.error}
        onSubmit={game.submitBakRyggen}
        onNextStep={game.nextBakRyggenStep}
        onEnd={game.endGame}
      />
    );
  }

  if (game.room.mode === "spicy" && game.room.spicy) {
    return (
      <Spicy
        spicy={game.room.spicy}
        playerNames={game.room.players.map((p) => p.name)}
        isHost={game.isHost}
        error={game.error}
        onNext={game.nextSpicy}
        onEnd={game.endGame}
      />
    );
  }

  if (game.room.mode === "voteoff" && game.room.voteoff) {
    return (
      <VoteOff
        voteoff={game.room.voteoff}
        isHost={game.isHost}
        error={game.error}
        onVote={game.voteVoteOff}
        onNext={game.nextVoteOff}
        onForceReveal={game.forceRevealVoteOff}
        onEnd={game.endGame}
      />
    );
  }

  return (
    <Lobby
      room={game.room}
      isHost={game.isHost}
      error={game.error}
      onStart={game.startMode}
      onSetPlayMode={game.setPlayMode}
      onSetLocale={game.setLocale}
      onLeave={game.leaveRoom}
    />
  );
}
