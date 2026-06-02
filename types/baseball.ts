export type Half = "top" | "bottom";
export type TeamKey = "away" | "home";
export type BaseKey = "first" | "second" | "third";
export type PositionKey = "P" | "C" | "1B" | "2B" | "3B" | "SS" | "LF" | "CF" | "RF";
export type LineupPosition = PositionKey | "DH";
export type ActionKey =
  | "single"
  | "double"
  | "triple"
  | "homeRun"
  | "walk"
  | "hitByPitch"
  | "strikeout"
  | "groundOut"
  | "flyOut"
  | "error"
  | "sacBunt"
  | "sacFly"
  | "doublePlay";
export type PitchKey = "ball" | "calledStrike" | "swingingStrike" | "foul";
export type RunnerAction = "advance" | "score" | "out" | "steal" | "caughtStealing" | "wildPitch" | "passedBall";
export type ViewMode = "home" | "setup" | "score" | "teamDetail" | "playerDetail";
export type GameStatus = "draft" | "inProgress" | "completed";
export type EndReason = "regulation" | "called" | "manual";
export type TeamRole = "admin" | "scorer" | "viewer";

export type AppUser = {
  internalUserId: string;
  loginId: string;
  displayName: string;
  passwordHash: string;
  recoveryCode: string;
  createdAt: string;
};

export type Runner = {
  name: string;
  team: TeamKey;
  earnedResponsible?: boolean;
  responsiblePitcher?: string;
};

export type RunEvent = {
  runnerName: string;
  team: TeamKey;
  pitcherName: string;
  earned: boolean;
  reason: string;
};

export type TeamProfile = {
  id: string;
  name: string;
  players: string[];
  inviteCode: string;
  ownerUserId?: string;
  memberUserIds: string[];
  roles: Record<string, TeamRole>;
};

export type Count = {
  balls: number;
  strikes: number;
};

export type HistoryEntry = {
  id: string;
  type: "play" | "pitch" | "substitution" | "game";
  inning: number;
  half: Half;
  batter: string;
  descriptionJa: string;
  code: string;
  pitcherName?: string;
  countAfter?: Count;
  runEvents?: RunEvent[];
  outsAfter: number;
  scoreAfter: {
    away: number;
    home: number;
  };
};

export type PlateAppearance = {
  id: string;
  gameId: string;
  gameDate: string;
  inning: number;
  half: Half;
  batter: string;
  result: HistoryEntry;
  pitches: HistoryEntry[];
};

export type Defense = Record<PositionKey, string>;

export type GameSettings = {
  scheduledInnings: number;
  dhEnabled: boolean;
  mercyEnabled: boolean;
  mercyRuns: number;
  mercyAfterInning: number;
};

export type GameState = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  date: string;
  status: GameStatus;
  endReason?: EndReason;
  startedAt: string;
  updatedAt: string;
  endedAt?: string;
  homeLineup: string[];
  awayLineup: string[];
  homeStartingPitcher: string;
  awayStartingPitcher: string;
  homeLineupPositions: LineupPosition[];
  awayLineupPositions: LineupPosition[];
  settings: GameSettings;
  defense: Record<TeamKey, Defense>;
  inning: number;
  half: Half;
  outs: number;
  earnedOuts: number;
  earnedOutsByPitcher: Record<string, number>;
  count: Count;
  score: {
    away: number;
    home: number;
  };
  bases: Record<BaseKey, Runner | null>;
  currentBatterIndex: {
    away: number;
    home: number;
  };
  history: HistoryEntry[];
};
