import { makeId, makeRecoveryCode, makeShortCode, normalizeGame, nowString } from "@/lib/gameLogic";
import type { AppUser, GameState, TeamProfile } from "@/types/baseball";

export const STORAGE_KEY = "scoretap-baseball-game";
export const GAME_LIST_KEY = "scoretap-baseball-games";
export const TEAM_LIST_KEY = "scoretap-baseball-teams";
export const USER_LIST_KEY = "scoretap-baseball-users";
export const CURRENT_USER_KEY = "scoretap-baseball-current-user";

export function readStoredGames(): GameState[] {
  try {
    const raw = window.localStorage.getItem(GAME_LIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<GameState>[];
    return Array.isArray(parsed) ? parsed.map(normalizeGame) : [];
  } catch {
    window.localStorage.removeItem(GAME_LIST_KEY);
    return [];
  }
}

export function readStoredTeams(): TeamProfile[] {
  try {
    const raw = window.localStorage.getItem(TEAM_LIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TeamProfile[];
    return Array.isArray(parsed)
      ? parsed
          .filter((team) => team.name)
          .map((team) => ({
            id: team.id || makeId(),
            name: team.name,
            players: Array.isArray(team.players) ? team.players.filter(Boolean) : [],
            inviteCode: team.inviteCode || `TAP-${makeShortCode(6)}`,
            ownerUserId: team.ownerUserId,
            memberUserIds: Array.isArray(team.memberUserIds) ? team.memberUserIds : team.ownerUserId ? [team.ownerUserId] : [],
            roles: team.roles ?? (team.ownerUserId ? { [team.ownerUserId]: "admin" } : {}),
          }))
      : [];
  } catch {
    window.localStorage.removeItem(TEAM_LIST_KEY);
    return [];
  }
}

export function readStoredUsers(): AppUser[] {
  try {
    const raw = window.localStorage.getItem(USER_LIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AppUser[];
    return Array.isArray(parsed)
      ? parsed
          .filter((user) => user.internalUserId && user.loginId)
          .map((user) => ({
            ...user,
            displayName: user.displayName || user.loginId,
            recoveryCode: user.recoveryCode || makeRecoveryCode(),
            createdAt: user.createdAt || nowString(),
          }))
      : [];
  } catch {
    window.localStorage.removeItem(USER_LIST_KEY);
    return [];
  }
}

export function upsertStoredGame(game: GameState, existing: GameState[]) {
  const updatedGame = { ...game, updatedAt: nowString() };
  const rest = existing.filter((item) => item.id !== updatedGame.id);
  return [updatedGame, ...rest].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
