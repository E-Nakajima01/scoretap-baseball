import { halfLabel } from "@/lib/gameLogic";
import type { GameState, HistoryEntry, PlateAppearance, TeamKey } from "@/types/baseball";

export function isPlateResult(entry: HistoryEntry) {
  const code = entry.code.split(" ")[0];
  return ["1B", "2B", "3B", "HR", "BB", "HBP", "K", "GO", "FO", "E", "SAC", "SF", "DP"].includes(code);
}

export function plateAppearancesForGame(game: GameState) {
  const pendingPitches = new Map<string, HistoryEntry[]>();
  const appearances: PlateAppearance[] = [];

  [...game.history].reverse().forEach((entry) => {
    if (entry.type === "pitch") {
      const current = pendingPitches.get(entry.batter) ?? [];
      pendingPitches.set(entry.batter, [...current, entry]);
      return;
    }

    if (entry.type === "play" && isPlateResult(entry)) {
      const pitches = pendingPitches.get(entry.batter) ?? [];
      appearances.push({
        id: `${game.id}-${entry.id}`,
        gameId: game.id,
        gameDate: game.date,
        inning: entry.inning,
        half: entry.half,
        batter: entry.batter,
        result: entry,
        pitches,
      });
      pendingPitches.set(entry.batter, []);
    }
  });

  return appearances;
}

export function playerPlateAppearances(games: GameState[], teamNameValue: string, playerName: string) {
  return teamGames(games, teamNameValue)
    .flatMap((item) => plateAppearancesForGame(item))
    .filter((appearance) => appearance.batter === playerName);
}

export function pitchSummary(appearance: PlateAppearance) {
  return appearance.pitches.reduce(
    (summary, pitch) => ({
      total: summary.total + 1,
      balls: summary.balls + (pitch.code === "B" ? 1 : 0),
      calledStrikes: summary.calledStrikes + (pitch.code === "S" ? 1 : 0),
      swingingStrikes: summary.swingingStrikes + (pitch.code === "Sw" ? 1 : 0),
      fouls: summary.fouls + (pitch.code === "F" ? 1 : 0),
    }),
    { total: 0, balls: 0, calledStrikes: 0, swingingStrikes: 0, fouls: 0 },
  );
}

export function outsFromPlateAppearance(appearance: PlateAppearance) {
  const code = appearance.result.code.split(" ")[0];
  if (appearance.result.code.includes("DP")) return 2;
  if (["K", "GO", "FO", "SAC", "SF"].includes(code)) return 1;
  return 0;
}

export function teamGames(games: GameState[], teamNameValue: string) {
  return games.filter((item) => item.awayTeam === teamNameValue || item.homeTeam === teamNameValue);
}

export function teamRecord(games: GameState[], teamNameValue: string) {
  return teamGames(games, teamNameValue).reduce(
    (record, item) => {
      if (item.status !== "completed") return record;
      const isAway = item.awayTeam === teamNameValue;
      const ownScore = isAway ? item.score.away : item.score.home;
      const opponentScore = isAway ? item.score.home : item.score.away;
      if (ownScore > opponentScore) return { ...record, wins: record.wins + 1 };
      if (ownScore < opponentScore) return { ...record, losses: record.losses + 1 };
      return { ...record, draws: record.draws + 1 };
    },
    { wins: 0, losses: 0, draws: 0 },
  );
}

export function playerStats(games: GameState[], teamNameValue: string, playerName: string) {
  const relevantGames = teamGames(games, teamNameValue);
  const resultCodes = new Set(["1B", "2B", "3B", "HR", "BB", "HBP", "K", "GO", "FO", "E", "SAC", "SF", "DP"]);

  return relevantGames.reduce(
    (stats, item) => {
      const played =
        item.awayLineup.includes(playerName) ||
        item.homeLineup.includes(playerName) ||
        Object.values(item.defense.away).includes(playerName) ||
        Object.values(item.defense.home).includes(playerName) ||
        item.history.some((entry) => entry.batter === playerName || entry.descriptionJa.includes(playerName));

      if (!played) return stats;

      const nextStats = { ...stats, games: stats.games + 1 };
      item.history.forEach((entry) => {
        if (entry.batter === playerName && entry.type === "pitch") {
          nextStats.pitchesSeen += 1;
          if (entry.code === "B") nextStats.takenBalls += 1;
          if (entry.code === "S") nextStats.calledStrikes += 1;
          if (entry.code === "Sw") nextStats.swingingStrikes += 1;
          if (entry.code === "F") nextStats.fouls += 1;
        }
        if (entry.batter === playerName && resultCodes.has(entry.code.split(" ")[0])) {
          nextStats.pa += 1;
          if (entry.code === "1B") nextStats.singles += 1;
          if (entry.code === "2B") nextStats.doubles += 1;
          if (entry.code === "3B") nextStats.triples += 1;
          if (entry.code === "HR") {
            nextStats.homeRuns += 1;
            nextStats.runs += 1;
          }
          if (entry.code === "BB") nextStats.walks += 1;
          if (entry.code === "HBP") nextStats.hitByPitch += 1;
          if (entry.code === "K") nextStats.strikeouts += 1;
          if (entry.code === "SAC" || entry.code.startsWith("SAC")) nextStats.sacrificeBunts += 1;
          if (entry.code.startsWith("SF")) nextStats.sacrificeFlies += 1;
          if (entry.code.startsWith("E")) nextStats.reachedOnError += 1;
        }
        if (entry.descriptionJa.includes(`${playerName}がホームイン`)) nextStats.runs += 1;
        if (entry.descriptionJa.includes(`${playerName}が`) && entry.code.startsWith("SB")) nextStats.stolenBases += 1;
        if (entry.descriptionJa.includes(`${playerName}が`) && entry.code === "CS") nextStats.caughtStealing += 1;
      });
      return nextStats;
    },
    {
      games: 0,
      pa: 0,
      singles: 0,
      doubles: 0,
      triples: 0,
      homeRuns: 0,
      walks: 0,
      hitByPitch: 0,
      strikeouts: 0,
      sacrificeBunts: 0,
      sacrificeFlies: 0,
      reachedOnError: 0,
      runs: 0,
      stolenBases: 0,
      caughtStealing: 0,
      pitchesSeen: 0,
      takenBalls: 0,
      calledStrikes: 0,
      swingingStrikes: 0,
      fouls: 0,
    },
  );
}

export function pitcherStats(games: GameState[], teamNameValue: string, playerName: string) {
  return teamGames(games, teamNameValue).reduce(
    (stats, item) => {
      const isAwayTeam = item.awayTeam === teamNameValue;
      const initialPitcher = isAwayTeam ? item.awayStartingPitcher || item.defense.away.P : item.homeStartingPitcher || item.defense.home.P;
      const appearedAsPitcher =
        initialPitcher === playerName ||
        item.history.some((entry) => entry.pitcherName === playerName || (entry.code === "SUB 1" && entry.descriptionJa.includes(playerName)));
      if (!appearedAsPitcher) return stats;

      const opponentTeam: TeamKey = isAwayTeam ? "home" : "away";
      const opponentLineup = opponentTeam === "away" ? item.awayLineup : item.homeLineup;
      const opponentNames = new Set(opponentLineup);
      const appearances = plateAppearancesForGame(item).filter(
        (appearance) => opponentNames.has(appearance.batter) && (appearance.result.pitcherName ?? initialPitcher) === playerName,
      );

      const nextStats = { ...stats, games: stats.games + 1 };
      const legacyRunsAllowed = isAwayTeam ? item.score.home : item.score.away;
      const gameRunEvents = item.history
        .flatMap((entry) => entry.runEvents ?? [])
        .filter((run) => run.team === opponentTeam && run.pitcherName === playerName);
      appearances.forEach((appearance) => {
        const code = appearance.result.code.split(" ")[0];
        nextStats.battersFaced += 1;
        nextStats.pitches += appearance.pitches.filter((pitch) => (pitch.pitcherName ?? initialPitcher) === playerName).length;
        nextStats.outs += outsFromPlateAppearance(appearance);
        if (["1B", "2B", "3B", "HR"].includes(code)) nextStats.hitsAllowed += 1;
        if (code === "HR") nextStats.homeRunsAllowed += 1;
        if (code === "BB") nextStats.walks += 1;
        if (code === "HBP") nextStats.hitByPitch += 1;
        if (code === "K") nextStats.strikeouts += 1;
      });
      if (item.history.some((entry) => entry.runEvents?.length)) {
        nextStats.runsAllowed += gameRunEvents.length;
        nextStats.earnedRuns += gameRunEvents.filter((run) => run.earned).length;
      } else if (initialPitcher === playerName) {
        nextStats.runsAllowed += legacyRunsAllowed;
        nextStats.earnedRuns += legacyRunsAllowed;
      }

      return nextStats;
    },
    {
      games: 0,
      battersFaced: 0,
      outs: 0,
      pitches: 0,
      hitsAllowed: 0,
      homeRunsAllowed: 0,
      walks: 0,
      hitByPitch: 0,
      strikeouts: 0,
      runsAllowed: 0,
      earnedRuns: 0,
    },
  );
}

export function formatAverage(value: number) {
  if (!Number.isFinite(value)) return ".000";
  return value.toFixed(3).replace(/^0/, "");
}

export function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0.0%";
  return `${(value * 100).toFixed(1)}%`;
}

export function formatInnings(outs: number) {
  const fullInnings = Math.floor(outs / 3);
  const partialOuts = outs % 3;
  return partialOuts ? `${fullInnings}.${partialOuts}` : `${fullInnings}`;
}

export function formatDecimal(value: number, digits = 2) {
  if (!Number.isFinite(value)) return "0.00";
  return value.toFixed(digits);
}

export { halfLabel };
