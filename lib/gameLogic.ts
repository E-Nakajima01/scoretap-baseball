import type {
  ActionKey,
  AppUser,
  BaseKey,
  Count,
  Defense,
  EndReason,
  GameSettings,
  GameState,
  Half,
  HistoryEntry,
  LineupPosition,
  PitchKey,
  PositionKey,
  RunEvent,
  Runner,
  TeamKey,
  TeamProfile,
} from "@/types/baseball";

export const positions: PositionKey[] = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
export const lineupPositionOptions: LineupPosition[] = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];
export const defaultLineupPositions: LineupPosition[] = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
export const defaultSettings: GameSettings = {
  scheduledInnings: 9,
  dhEnabled: false,
  mercyEnabled: true,
  mercyRuns: 10,
  mercyAfterInning: 5,
};

export const actionLabels: Record<ActionKey, string> = {
  single: "シングル",
  double: "二塁打",
  triple: "三塁打",
  homeRun: "ホームラン",
  walk: "四球",
  hitByPitch: "デッドボール",
  groundOut: "ゴロアウト",
  flyOut: "フライアウト",
  error: "エラー",
  sacBunt: "犠牲バント",
  sacFly: "犠牲フライ",
  doublePlay: "ダブルプレー",
  strikeout: "三振",
};

export const pitchLabels: Record<PitchKey, { label: string; descriptionJa: string; code: string }> = {
  ball: { label: "ボール", descriptionJa: "ボール", code: "B" },
  calledStrike: { label: "見逃し", descriptionJa: "見逃しストライク", code: "S" },
  swingingStrike: { label: "空振り", descriptionJa: "空振りストライク", code: "Sw" },
  foul: { label: "ファウル", descriptionJa: "ファウル", code: "F" },
};

export const positionLabels: Record<PositionKey, string> = {
  P: "ピッチャー",
  C: "キャッチャー",
  "1B": "ファースト",
  "2B": "セカンド",
  "3B": "サード",
  SS: "ショート",
  LF: "レフト",
  CF: "センター",
  RF: "ライト",
};

export const lineupPositionLabels: Record<LineupPosition, string> = {
  ...positionLabels,
  DH: "DH",
};

export const scoreCodes: Record<PositionKey, string> = {
  P: "1",
  C: "2",
  "1B": "3",
  "2B": "4",
  "3B": "5",
  SS: "6",
  LF: "7",
  CF: "8",
  RF: "9",
};

export const fieldPositions: Array<{ key: PositionKey; className: string }> = [
  { key: "LF", className: "left-[13%] top-[20%]" },
  { key: "CF", className: "left-1/2 top-[9%] -translate-x-1/2" },
  { key: "RF", className: "right-[13%] top-[20%]" },
  { key: "SS", className: "left-[29%] top-[45%]" },
  { key: "2B", className: "right-[29%] top-[45%]" },
  { key: "3B", className: "left-[19%] bottom-[25%]" },
  { key: "P", className: "left-1/2 top-[57%] -translate-x-1/2" },
  { key: "1B", className: "right-[19%] bottom-[25%]" },
  { key: "C", className: "left-1/2 bottom-[4%] -translate-x-1/2" },
];

export const defaultNames = ["1番", "2番", "3番", "4番", "5番", "6番", "7番", "8番", "9番"];

export function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export function nowString() {
  return new Date().toISOString();
}

export function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function makeShortCode(length = 6) {
  const source = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length })
    .map(() => source[Math.floor(Math.random() * source.length)])
    .join("");
}

export function makeLoginId(existingUsers: AppUser[]) {
  let candidate = "";
  do {
    candidate = `tap-${makeShortCode(5).toLowerCase()}`;
  } while (existingUsers.some((user) => user.loginId === candidate));
  return candidate;
}

export function makeInviteCode(existingTeams: TeamProfile[]) {
  let candidate = "";
  do {
    candidate = `TAP-${makeShortCode(6)}`;
  } while (existingTeams.some((team) => team.inviteCode === candidate));
  return candidate;
}

export function makeRecoveryCode() {
  return `REC-${makeShortCode(4)}-${makeShortCode(4)}`;
}

export function hashPassword(value: string) {
  return btoa(unescape(encodeURIComponent(`scoretap:${value}`)));
}

export function loginIdToCloudEmail(loginId: string) {
  return `${loginId.trim().toLowerCase()}@scoretap.local`;
}

export function defaultDefenderName(position: PositionKey) {
  return positionLabels[position];
}

export function makeDefense(
  lineup: string[],
  lineupPositions: LineupPosition[] = defaultLineupPositions,
  startingPitcher = "",
): Defense {
  return positions.reduce((defense, position) => {
    const playerIndex = lineupPositions.findIndex((lineupPosition) => lineupPosition === position);
    return {
      ...defense,
      [position]:
        position === "P" && startingPitcher
          ? startingPitcher
          : playerIndex >= 0
            ? lineup[playerIndex] || defaultDefenderName(position)
            : defaultDefenderName(position),
    };
  }, {} as Defense);
}

export function makeInitialGame(): GameState {
  const awayLineup = [...defaultNames];
  const homeLineup = [...defaultNames];
  const awayLineupPositions = [...defaultLineupPositions];
  const homeLineupPositions = [...defaultLineupPositions];
  const timestamp = nowString();
  return {
    id: makeId(),
    homeTeam: "",
    awayTeam: "",
    date: todayString(),
    status: "draft",
    startedAt: timestamp,
    updatedAt: timestamp,
    homeLineup,
    awayLineup,
    homeStartingPitcher: "",
    awayStartingPitcher: "",
    homeLineupPositions,
    awayLineupPositions,
    settings: { ...defaultSettings },
    defense: {
      away: makeDefense(awayLineup, awayLineupPositions),
      home: makeDefense(homeLineup, homeLineupPositions),
    },
    inning: 1,
    half: "top",
    outs: 0,
    earnedOuts: 0,
    earnedOutsByPitcher: {},
    count: { balls: 0, strikes: 0 },
    score: { away: 0, home: 0 },
    bases: { first: null, second: null, third: null },
    currentBatterIndex: { away: 0, home: 0 },
    history: [],
  };
}

export function normalizeGame(saved: Partial<GameState>): GameState {
  const base = makeInitialGame();
  const awayLineup = saved.awayLineup?.length === 9 ? saved.awayLineup : base.awayLineup;
  const homeLineup = saved.homeLineup?.length === 9 ? saved.homeLineup : base.homeLineup;
  const awayLineupPositions =
    saved.awayLineupPositions?.length === 9 ? saved.awayLineupPositions : base.awayLineupPositions;
  const homeLineupPositions =
    saved.homeLineupPositions?.length === 9 ? saved.homeLineupPositions : base.homeLineupPositions;
  const timestamp = nowString();

  return {
    ...base,
    ...saved,
    id: saved.id ?? base.id,
    status: saved.status ?? (saved.homeTeam && saved.awayTeam ? "inProgress" : "draft"),
    startedAt: saved.startedAt ?? timestamp,
    updatedAt: saved.updatedAt ?? timestamp,
    awayLineup,
    homeLineup,
    awayStartingPitcher: saved.awayStartingPitcher ?? base.awayStartingPitcher,
    homeStartingPitcher: saved.homeStartingPitcher ?? base.homeStartingPitcher,
    awayLineupPositions,
    homeLineupPositions,
    settings: { ...defaultSettings, ...saved.settings },
    defense: {
      away: { ...makeDefense(awayLineup, awayLineupPositions, saved.awayStartingPitcher), ...saved.defense?.away },
      home: { ...makeDefense(homeLineup, homeLineupPositions, saved.homeStartingPitcher), ...saved.defense?.home },
    },
    count: saved.count ?? base.count,
    earnedOuts: saved.earnedOuts ?? base.earnedOuts,
    earnedOutsByPitcher: saved.earnedOutsByPitcher ?? base.earnedOutsByPitcher,
    history: saved.history ?? [],
  };
}

export function battingTeam(game: GameState): TeamKey {
  return game.half === "top" ? "away" : "home";
}

export function fieldingTeam(game: GameState): TeamKey {
  return game.half === "top" ? "home" : "away";
}

export function currentBatter(game: GameState) {
  const team = battingTeam(game);
  const lineup = team === "away" ? game.awayLineup : game.homeLineup;
  return lineup[game.currentBatterIndex[team] % lineup.length] || `${game.currentBatterIndex[team] + 1}番`;
}

export function teamName(game: GameState, team: TeamKey) {
  return team === "away" ? game.awayTeam : game.homeTeam;
}

export function addRuns(game: GameState, runs: number) {
  const team = battingTeam(game);
  return {
    ...game.score,
    [team]: game.score[team] + runs,
  };
}

export function makeRunEvent(game: GameState, runner: Runner, reason: string, forceUnearned = false): RunEvent {
  const pitcherName = runner.responsiblePitcher || game.defense[fieldingTeam(game)].P;
  const responsibleEarnedOuts = game.earnedOutsByPitcher[pitcherName] ?? game.earnedOuts;
  const earned = !forceUnearned && runner.earnedResponsible !== false && responsibleEarnedOuts < 3;
  return {
    runnerName: runner.name,
    team: runner.team,
    pitcherName,
    earned,
    reason: earned ? reason : `${reason} / 非自責`,
  };
}

export function activeResponsiblePitchers(game: GameState) {
  return Array.from(
    new Set([
      game.defense[fieldingTeam(game)].P,
      ...Object.values(game.bases)
        .map((runner) => runner?.responsiblePitcher)
        .filter((name): name is string => Boolean(name)),
    ]),
  );
}

export function addEarnedOutsByPitcher(game: GameState, outsAdded: number) {
  if (outsAdded <= 0) return game.earnedOutsByPitcher;
  const next = { ...game.earnedOutsByPitcher };
  activeResponsiblePitchers(game).forEach((pitcherName) => {
    next[pitcherName] = (next[pitcherName] ?? game.earnedOuts) + outsAdded;
  });
  return next;
}

export function advanceBatter(game: GameState) {
  const team = battingTeam(game);
  return {
    ...game.currentBatterIndex,
    [team]: (game.currentBatterIndex[team] + 1) % 9,
  };
}

export function shouldFinishAtHalfEnd(game: GameState) {
  if (game.inning < game.settings.scheduledInnings) return false;
  if (game.half === "top") return game.score.home > game.score.away;
  return game.score.away !== game.score.home;
}

export function shouldMercyEnd(game: GameState) {
  if (!game.settings.mercyEnabled) return false;
  if (game.inning < game.settings.mercyAfterInning) return false;
  return Math.abs(game.score.away - game.score.home) >= game.settings.mercyRuns;
}

export function clearHalfInning(
  game: GameState,
  outs: number,
  earnedOuts: number,
): Pick<GameState, "inning" | "half" | "outs" | "earnedOuts" | "bases" | "count" | "status"> &
  Pick<Partial<GameState>, "earnedOutsByPitcher" | "endReason" | "endedAt"> {
  if (outs < 3) {
    return {
      inning: game.inning,
      half: game.half,
      outs,
      earnedOuts,
      earnedOutsByPitcher: game.earnedOutsByPitcher,
      bases: game.bases,
      count: { balls: 0, strikes: 0 },
      status: game.status,
    };
  }

  if (shouldFinishAtHalfEnd(game)) {
    return {
      inning: game.inning,
      half: game.half,
      outs: 3,
      earnedOuts: 0,
      earnedOutsByPitcher: {},
      bases: { first: null, second: null, third: null },
      count: { balls: 0, strikes: 0 },
      status: "completed",
      endReason: "regulation",
      endedAt: nowString(),
    };
  }

  if (shouldMercyEnd(game)) {
    return {
      inning: game.inning,
      half: game.half,
      outs: 3,
      earnedOuts: 0,
      earnedOutsByPitcher: {},
      bases: { first: null, second: null, third: null },
      count: { balls: 0, strikes: 0 },
      status: "completed",
      endReason: "called",
      endedAt: nowString(),
    };
  }

  return {
    inning: game.half === "bottom" ? game.inning + 1 : game.inning,
    half: game.half === "top" ? "bottom" : "top",
    outs: 0,
    earnedOuts: 0,
    earnedOutsByPitcher: {},
    bases: { first: null, second: null, third: null },
    count: { balls: 0, strikes: 0 },
    status: game.status,
  };
}

export function advanceRunners(game: GameState, batter: Runner, basesGained: 1 | 2 | 3 | 4, forceUnearned = false) {
  const runEvents: RunEvent[] = basesGained === 4 ? [makeRunEvent(game, batter, "打者走者の得点", forceUnearned)] : [];
  const nextBases: Record<BaseKey, Runner | null> = {
    first: null,
    second: null,
    third: null,
  };

  const occupied: Array<[number, Runner | null]> = [
    [3, game.bases.third],
    [2, game.bases.second],
    [1, game.bases.first],
  ];

  occupied.forEach(([baseNumber, runner]) => {
    if (!runner) return;

    let destination = baseNumber + basesGained;
    if (basesGained === 1 && baseNumber >= 2) destination = 4;
    if (basesGained === 2) destination = 4;

    if (destination >= 4) {
      runEvents.push(makeRunEvent(game, runner, `${baseLabel(baseKeyFromNumber(baseNumber))}走者の得点`, forceUnearned));
      return;
    }
    if (destination === 3) nextBases.third = forceUnearned ? { ...runner, earnedResponsible: false } : runner;
    if (destination === 2) nextBases.second = forceUnearned ? { ...runner, earnedResponsible: false } : runner;
  });

  if (basesGained === 1) nextBases.first = forceUnearned ? { ...batter, earnedResponsible: false } : batter;
  if (basesGained === 2) nextBases.second = forceUnearned ? { ...batter, earnedResponsible: false } : batter;
  if (basesGained === 3) nextBases.third = forceUnearned ? { ...batter, earnedResponsible: false } : batter;

  return { nextBases, runEvents };
}

export function walkRunners(game: GameState, batter: Runner) {
  const runEvents: RunEvent[] = [];
  const nextBases = { ...game.bases };

  if (nextBases.first && nextBases.second && nextBases.third) {
    runEvents.push(makeRunEvent(game, nextBases.third, "押し出しの得点"));
  }
  if (nextBases.first && nextBases.second) nextBases.third = nextBases.second;
  if (nextBases.first) nextBases.second = nextBases.first;
  nextBases.first = batter;

  return { nextBases, runEvents };
}

export function playText(action: ActionKey, position: PositionKey | null) {
  const posJa = position ? positionLabels[position] : "";
  const code = position ? scoreCodes[position] : "";

  if (action === "single") return { descriptionJa: `${posJa ? `${posJa}へ` : ""}シングルヒット`, code: "1B" };
  if (action === "double") return { descriptionJa: `${posJa ? `${posJa}へ` : ""}二塁打`, code: "2B" };
  if (action === "triple") return { descriptionJa: `${posJa ? `${posJa}へ` : ""}三塁打`, code: "3B" };
  if (action === "homeRun") return { descriptionJa: "ホームラン", code: "HR" };
  if (action === "walk") return { descriptionJa: "四球で出塁", code: "BB" };
  if (action === "hitByPitch") return { descriptionJa: "デッドボールで出塁", code: "HBP" };
  if (action === "strikeout") return { descriptionJa: "三振でアウト", code: "K" };
  if (action === "groundOut") return { descriptionJa: `${posJa || "内野"}ゴロでアウト`, code: code ? `${code}-3` : "GO" };
  if (action === "flyOut") return { descriptionJa: `${posJa || "野手"}フライでアウト`, code: code ? `F${code}` : "FO" };
  if (action === "error") return { descriptionJa: `${posJa || "守備"}のエラーで出塁`, code: code ? `E${code}` : "E" };
  if (action === "sacBunt") return { descriptionJa: `${posJa || "内野"}への犠牲バント`, code: code ? `SAC ${code}-3` : "SAC" };
  if (action === "sacFly") return { descriptionJa: `${posJa || "外野"}への犠牲フライ`, code: code ? `SF${code}` : "SF" };
  return { descriptionJa: `${posJa || "内野"}ゴロのダブルプレー`, code: code ? `${code}-4-3 DP` : "DP" };
}

export function makeHistoryEntry(
  game: GameState,
  entry: Pick<HistoryEntry, "type" | "descriptionJa" | "code"> & Partial<HistoryEntry>,
): HistoryEntry {
  return {
    id: makeId(),
    type: entry.type,
    inning: game.inning,
    half: game.half,
    batter: entry.batter ?? currentBatter(game),
    descriptionJa: entry.descriptionJa,
    code: entry.code,
    pitcherName: entry.pitcherName ?? (entry.type === "pitch" || entry.type === "play" ? game.defense[fieldingTeam(game)].P : undefined),
    countAfter: entry.countAfter,
    runEvents: entry.runEvents,
    outsAfter: entry.outsAfter ?? game.outs,
    scoreAfter: entry.scoreAfter ?? game.score,
  };
}

export function endReasonLabel(reason?: EndReason) {
  if (reason === "called") return "コールド・途中終了";
  if (reason === "manual") return "手動終了";
  return "正式終了";
}

export function winnerLabel(game: GameState) {
  if (game.score.away === game.score.home) return "引き分け";
  return game.score.away > game.score.home ? `${game.awayTeam} 勝利` : `${game.homeTeam} 勝利`;
}

export function finishGame(game: GameState, reason: EndReason): GameState {
  if (game.status === "completed") return game;

  const endedAt = nowString();
  const descriptionJa = `試合終了: ${winnerLabel(game)} (${endReasonLabel(reason)})`;
  const entry = makeHistoryEntry(game, {
    type: "game",
    descriptionJa,
    code: reason === "called" ? "CALLED" : "FINAL",
    outsAfter: game.outs,
    scoreAfter: game.score,
  });

  return {
    ...game,
    status: "completed",
    endReason: reason,
    endedAt,
    updatedAt: endedAt,
    count: { balls: 0, strikes: 0 },
    history: [entry, ...game.history],
  };
}

export function finishGameIfNeeded(game: GameState): GameState {
  if (game.status === "completed") {
    const hasFinalEntry = game.history.some((entry) => entry.type === "game" && entry.code === "FINAL");
    if (hasFinalEntry) return game;
    return finishGame({ ...game, status: "inProgress" }, game.endReason ?? "regulation");
  }

  if (game.inning >= game.settings.scheduledInnings && game.half === "bottom" && game.score.home > game.score.away) {
    return finishGame(game, "regulation");
  }

  return game;
}

export function applyPlay(game: GameState, action: ActionKey, position: PositionKey | null): GameState {
  if (game.status === "completed") return game;
  const team = battingTeam(game);
  const batterName = currentBatter(game);
  const batter: Runner = { name: batterName, team, responsiblePitcher: game.defense[fieldingTeam(game)].P };
  const text = playText(action, position);
  let nextBases = game.bases;
  let nextScore = game.score;
  let nextOuts = game.outs;
  let nextEarnedOuts = game.earnedOuts;
  let nextEarnedOutsByPitcher = game.earnedOutsByPitcher;
  let runEvents: RunEvent[] = [];

  if (action === "single" || action === "double" || action === "triple" || action === "homeRun") {
    const basesGained = action === "single" ? 1 : action === "double" ? 2 : action === "triple" ? 3 : 4;
    const advanced = advanceRunners(game, batter, basesGained);
    nextBases = advanced.nextBases;
    runEvents = advanced.runEvents;
    nextScore = addRuns(game, runEvents.length);
  }

  if (action === "walk" || action === "hitByPitch") {
    const walked = walkRunners(game, batter);
    nextBases = walked.nextBases;
    runEvents = walked.runEvents;
    nextScore = addRuns(game, runEvents.length);
  }

  if (action === "error") {
    const errorBatter: Runner = { ...batter, earnedResponsible: false };
    const advanced = advanceRunners(game, errorBatter, 1, true);
    nextBases = advanced.nextBases;
    runEvents = advanced.runEvents;
    nextScore = addRuns(game, runEvents.length);
    nextEarnedOuts += 1;
    nextEarnedOutsByPitcher = addEarnedOutsByPitcher(game, 1);
  }

  if (action === "strikeout" || action === "groundOut" || action === "flyOut") {
    nextOuts += 1;
    nextEarnedOuts += 1;
    nextEarnedOutsByPitcher = addEarnedOutsByPitcher(game, 1);
  }

  if (action === "sacBunt") {
    nextOuts += 1;
    nextEarnedOuts += 1;
    nextEarnedOutsByPitcher = addEarnedOutsByPitcher(game, 1);
    runEvents = game.bases.third ? [makeRunEvent(game, game.bases.third, "犠牲バントで得点")] : [];
    nextBases = {
      first: null,
      second: game.bases.first,
      third: game.bases.second,
    };
    nextScore = addRuns(game, runEvents.length);
  }

  if (action === "sacFly") {
    nextOuts += 1;
    nextEarnedOuts += 1;
    nextEarnedOutsByPitcher = addEarnedOutsByPitcher(game, 1);
    if (game.bases.third) {
      nextBases = { ...game.bases, third: null };
      runEvents = [makeRunEvent(game, game.bases.third, "犠牲フライで得点")];
      nextScore = addRuns(game, runEvents.length);
    }
  }

  if (action === "doublePlay") {
    const outsAdded = Math.min(2, 3 - game.outs);
    nextOuts += outsAdded;
    nextEarnedOuts += outsAdded;
    nextEarnedOutsByPitcher = addEarnedOutsByPitcher(game, outsAdded);
    nextBases = { ...game.bases, first: null };
  }

  const inningState = clearHalfInning(
    { ...game, bases: nextBases, score: nextScore, earnedOutsByPitcher: nextEarnedOutsByPitcher },
    nextOuts,
    nextEarnedOuts,
  );
  const play = makeHistoryEntry(game, {
    type: "play",
    descriptionJa: text.descriptionJa,
    code: text.code,
    runEvents,
    outsAfter: inningState.outs,
    scoreAfter: nextScore,
  });

  return finishGameIfNeeded({
    ...game,
    ...inningState,
    score: nextScore,
    currentBatterIndex: advanceBatter(game),
    history: [play, ...game.history],
  });
}

export function applyPitch(game: GameState, pitch: PitchKey): GameState {
  if (game.status === "completed") return game;
  const pitchInfo = pitchLabels[pitch];
  const nextCount: Count = { ...game.count };

  if (pitch === "ball") nextCount.balls += 1;
  if (pitch === "calledStrike" || pitch === "swingingStrike") nextCount.strikes += 1;
  if (pitch === "foul" && nextCount.strikes < 2) nextCount.strikes += 1;

  const pitchEntry = makeHistoryEntry(game, {
    type: "pitch",
    descriptionJa: pitchInfo.descriptionJa,
    code: pitchInfo.code,
    countAfter: nextCount,
  });

  const withPitch = {
    ...game,
    count: nextCount,
    history: [pitchEntry, ...game.history],
  };

  if (nextCount.balls >= 4) {
    return applyPlay(withPitch, "walk", null);
  }

  if (nextCount.strikes >= 3) {
    return applyPlay(withPitch, "strikeout", null);
  }

  return withPitch;
}

export function halfLabel(half: Half) {
  return half === "top" ? "表" : "裏";
}

export function countLabel(count: Count) {
  return `${count.balls}-${count.strikes}`;
}

export function baseLabel(base: BaseKey) {
  if (base === "first") return "一塁";
  if (base === "second") return "二塁";
  return "三塁";
}

export function nextBase(base: BaseKey): BaseKey | "home" {
  if (base === "first") return "second";
  if (base === "second") return "third";
  return "home";
}

export function baseKeyFromNumber(baseNumber: number): BaseKey {
  if (baseNumber === 1) return "first";
  if (baseNumber === 2) return "second";
  return "third";
}
