"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import {
  actionLabels,
  addEarnedOutsByPitcher,
  applyPitch,
  applyPlay,
  baseLabel,
  battingTeam,
  clearHalfInning,
  countLabel,
  currentBatter,
  defaultNames,
  defaultLineupPositions,
  defaultSettings,
  endReasonLabel,
  fieldingTeam,
  fieldPositions,
  finishGame,
  finishGameIfNeeded,
  halfLabel,
  hashPassword,
  lineupPositionLabels,
  lineupPositionOptions,
  loginIdToCloudEmail,
  makeDefense,
  makeHistoryEntry,
  makeId,
  makeInitialGame,
  makeInviteCode,
  makeLoginId,
  makeRecoveryCode,
  makeRunEvent,
  makeShortCode,
  nextBase,
  normalizeGame,
  nowString,
  pitchLabels,
  positionLabels,
  scoreCodes,
  teamName,
  winnerLabel,
} from "@/lib/gameLogic";
import {
  formatAverage,
  formatDecimal,
  formatInnings,
  formatPercent,
  pitcherStats,
  pitchSummary,
  playerPlateAppearances,
  playerStats,
  teamGames,
  teamRecord,
} from "@/lib/stats";
import {
  CURRENT_USER_KEY,
  GAME_LIST_KEY,
  STORAGE_KEY,
  TEAM_LIST_KEY,
  USER_LIST_KEY,
  readUndoStack,
  readStoredGames,
  readStoredTeams,
  readStoredUsers,
  upsertStoredGame,
  writeUndoStack,
} from "@/lib/storage";
import type {
  ActionKey,
  AppUser,
  BaseKey,
  EndReason,
  GameSettings,
  GameState,
  LineupPosition,
  PitchKey,
  PositionKey,
  RunEvent,
  RunnerAction,
  TeamKey,
  TeamProfile,
  ViewMode,
} from "@/types/baseball";

function CountDots({ label, active, total, color }: { label: string; active: number; total: number; color: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="w-5 text-sm font-black text-slate-500">{label}</span>
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, index) => (
          <span
            className={`h-4 w-4 rounded-full border border-slate-300 ${index < active ? color : "bg-slate-100"}`}
            key={`${label}-${index}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [game, setGame] = useState<GameState>(() => makeInitialGame());
  const [undoStack, setUndoStack] = useState<GameState[]>([]);
  const [games, setGames] = useState<GameState[]>([]);
  const [teams, setTeams] = useState<TeamProfile[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [ready, setReady] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<PositionKey | null>("SS");
  const [selectedBase, setSelectedBase] = useState<BaseKey | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("home");
  const [subName, setSubName] = useState("");
  const [battingSubName, setBattingSubName] = useState("");
  const [teamNameInput, setTeamNameInput] = useState("");
  const [teamPlayersInput, setTeamPlayersInput] = useState<string[]>([]);
  const [memberNameInput, setMemberNameInput] = useState("");
  const [editingTeamId, setEditingTeamId] = useState("");
  const [openTeamMenuId, setOpenTeamMenuId] = useState("");
  const [openGameMenuId, setOpenGameMenuId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedPlayerName, setSelectedPlayerName] = useState("");
  const [selectedPlateAppearanceId, setSelectedPlateAppearanceId] = useState("");
  const [loginIdInput, setLoginIdInput] = useState("");
  const [loginPasswordInput, setLoginPasswordInput] = useState("");
  const [newLoginIdInput, setNewLoginIdInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [cloudStatus, setCloudStatus] = useState("ローカル保存");
  const [issuedAccount, setIssuedAccount] = useState<{ loginId: string; password: string; recoveryCode: string } | null>(null);
  const currentUser = users.find((user) => user.internalUserId === currentUserId) ?? null;

  useEffect(() => {
    const storedGames = readStoredGames();
    const storedUsers = readStoredUsers();
    const storedCurrentUserId = window.localStorage.getItem(CURRENT_USER_KEY) || "";
    setGames(storedGames);
    setUsers(storedUsers);
    setUndoStack(readUndoStack());
    setCurrentUserId(storedUsers.some((user) => user.internalUserId === storedCurrentUserId) ? storedCurrentUserId : "");
    setTeams(readStoredTeams());
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = normalizeGame(JSON.parse(saved) as Partial<GameState>);
        setGame(parsed);
        setViewMode("home");
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setReady(true);
    void restoreCloudSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
    if (game.homeTeam || game.awayTeam || game.history.length > 0) {
      setGames((current) => {
        const nextGames = upsertStoredGame(game, current);
        window.localStorage.setItem(GAME_LIST_KEY, JSON.stringify(nextGames));
        return nextGames;
      });
    }
    void saveCloudState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, ready]);

  useEffect(() => {
    if (!ready || !currentUser) return;
    void saveCloudState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, games, currentUserId, ready]);

  const currentTeam = battingTeam(game);
  const defenseTeam = fieldingTeam(game);
  const batter = currentBatter(game);
  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? null;
  const selectedRunner = selectedBase ? game.bases[selectedBase] : null;
  const selectedDefender = selectedPosition ? game.defense[defenseTeam][selectedPosition] : "";
  const canUndoGame = undoStack.some((snapshot) => snapshot.id === game.id);
  const requiresPosition = useMemo(
    () => new Set<ActionKey>(["groundOut", "flyOut", "error", "sacBunt", "sacFly", "doublePlay"]),
    [],
  );

  async function restoreCloudSession() {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setCloudStatus("ローカル保存");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setCloudStatus("クラウド未ログイン");
      return;
    }

    const { data: profile } = await supabase
      .from("scoretap_profiles")
      .select("id, login_id, display_name, recovery_code, created_at")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      setCloudStatus("クラウドプロフィール未設定");
      return;
    }

    const cloudUser: AppUser = {
      internalUserId: profile.id,
      loginId: profile.login_id,
      displayName: profile.display_name,
      passwordHash: "",
      recoveryCode: profile.recovery_code,
      createdAt: profile.created_at,
    };
    const nextUsers = [cloudUser, ...readStoredUsers().filter((user) => user.internalUserId !== cloudUser.internalUserId)];
    persistUsers(nextUsers);
    setCurrentUserId(cloudUser.internalUserId);
    window.localStorage.setItem(CURRENT_USER_KEY, cloudUser.internalUserId);

    const { data: cloudState } = await supabase
      .from("scoretap_cloud_state")
      .select("teams, games, current_game")
      .eq("user_id", userId)
      .maybeSingle();

    if (cloudState) {
      const nextTeams = Array.isArray(cloudState.teams) ? (cloudState.teams as TeamProfile[]) : [];
      const nextGames = Array.isArray(cloudState.games) ? (cloudState.games as GameState[]).map(normalizeGame) : [];
      setTeams(nextTeams);
      setGames(nextGames);
      window.localStorage.setItem(TEAM_LIST_KEY, JSON.stringify(nextTeams));
      window.localStorage.setItem(GAME_LIST_KEY, JSON.stringify(nextGames));
      if (cloudState.current_game) {
        const nextGame = normalizeGame(cloudState.current_game as Partial<GameState>);
        setGame(nextGame);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextGame));
      }
    }

    setCloudStatus("クラウド同期中");
  }

  async function saveCloudState() {
    const supabase = getSupabaseClient();
    if (!supabase || !currentUser) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) return;

    const { error } = await supabase.from("scoretap_cloud_state").upsert({
      user_id: userId,
      teams,
      games,
      current_game: game,
    });

    setCloudStatus(error ? "クラウド保存エラー" : "クラウド同期中");
  }

  function persistUsers(nextUsers: AppUser[]) {
    setUsers(nextUsers);
    window.localStorage.setItem(USER_LIST_KEY, JSON.stringify(nextUsers));
  }

  function cloneGameState(snapshot: GameState) {
    return normalizeGame(JSON.parse(JSON.stringify(snapshot)) as Partial<GameState>);
  }

  function pushUndoSnapshot(snapshot: GameState) {
    const nextSnapshot = cloneGameState(snapshot);
    setUndoStack((current) => {
      const nextStack = [nextSnapshot, ...current].slice(0, 20);
      writeUndoStack(nextStack);
      return nextStack;
    });
  }

  function restorePreviousGameState() {
    const snapshotIndex = undoStack.findIndex((snapshot) => snapshot.id === game.id);
    if (snapshotIndex < 0) return;
    const snapshot = undoStack[snapshotIndex];
    const nextStack = undoStack.filter((_, index) => index !== snapshotIndex);
    setGame(snapshot);
    setUndoStack(nextStack);
    writeUndoStack(nextStack);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    setViewMode(snapshot.status === "draft" ? "setup" : "score");
    setSelectedBase(null);
    setAuthMessage("1つ前の状態に戻しました。");
  }

  async function issueAccount() {
    const password = makeShortCode(8).toLowerCase();
    const loginId = makeLoginId(users);
    const recoveryCode = makeRecoveryCode();
    const supabase = getSupabaseClient();
    let internalUserId = makeId();

    if (supabase) {
      setCloudStatus("クラウド登録中");
      const { data, error } = await supabase.auth.signUp({
        email: loginIdToCloudEmail(loginId),
        password,
        options: {
          data: {
            login_id: loginId,
            display_name: "ScoreTapユーザー",
          },
        },
      });

      if (error || !data.user) {
        setAuthMessage(error?.message || "クラウド登録に失敗しました。");
        setCloudStatus("クラウド登録エラー");
        return;
      }

      internalUserId = data.user.id;

      const { error: profileError } = await supabase.from("scoretap_profiles").upsert({
        id: internalUserId,
        login_id: loginId,
        display_name: "ScoreTapユーザー",
        recovery_code: recoveryCode,
      });

      if (profileError) {
        setAuthMessage("プロフィール保存に失敗しました。Supabase Authのメール確認をOFFにしているか確認してください。");
        setCloudStatus("クラウド登録エラー");
        return;
      }

      await supabase.from("scoretap_cloud_state").upsert({
        user_id: internalUserId,
        teams,
        games,
        current_game: game,
      });
    }

    const nextUser: AppUser = {
      internalUserId,
      loginId,
      displayName: "ScoreTapユーザー",
      passwordHash: supabase ? "" : hashPassword(password),
      recoveryCode,
      createdAt: nowString(),
    };
    const nextUsers = [nextUser, ...users];
    persistUsers(nextUsers);
    setCurrentUserId(nextUser.internalUserId);
    window.localStorage.setItem(CURRENT_USER_KEY, nextUser.internalUserId);
    setIssuedAccount({ loginId: nextUser.loginId, password, recoveryCode: nextUser.recoveryCode });
    setCloudStatus(supabase ? "クラウド同期中" : "ローカル保存");
    setAuthMessage("");
  }

  async function loginAccount() {
    const loginId = loginIdInput.trim();
    const password = loginPasswordInput.trim();
    const supabase = getSupabaseClient();

    if (supabase) {
      setCloudStatus("クラウドログイン中");
      const { error } = await supabase.auth.signInWithPassword({
        email: loginIdToCloudEmail(loginId),
        password,
      });
      if (error) {
        setAuthMessage("IDまたはパスワードが違います。");
        setCloudStatus("クラウドログインエラー");
        return;
      }
      await restoreCloudSession();
      setLoginIdInput("");
      setLoginPasswordInput("");
      setAuthMessage("クラウドにログインしました。");
      return;
    }

    const user = users.find((item) => item.loginId === loginId && item.passwordHash === hashPassword(password));
    if (!user) {
      setAuthMessage("IDまたはパスワードが違います。");
      return;
    }
    setCurrentUserId(user.internalUserId);
    window.localStorage.setItem(CURRENT_USER_KEY, user.internalUserId);
    setLoginIdInput("");
    setLoginPasswordInput("");
    setAuthMessage(`${user.displayName}でログインしました。`);
  }

  async function logoutAccount() {
    const supabase = getSupabaseClient();
    if (supabase) await supabase.auth.signOut();
    setCurrentUserId("");
    window.localStorage.removeItem(CURRENT_USER_KEY);
    setIssuedAccount(null);
    setCloudStatus(supabase ? "クラウド未ログイン" : "ローカル保存");
    setAuthMessage("ログアウトしました。");
  }

  async function changeLoginId() {
    if (!currentUser) return;
    const nextLoginId = newLoginIdInput.trim();
    if (nextLoginId.length < 4) {
      setAuthMessage("IDは4文字以上で設定してください。");
      return;
    }
    if (users.some((user) => user.loginId === nextLoginId && user.internalUserId !== currentUser.internalUserId)) {
      setAuthMessage("そのIDはすでに使われています。");
      return;
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      const { error: authError } = await supabase.auth.updateUser({ email: loginIdToCloudEmail(nextLoginId) });
      if (authError) {
        setAuthMessage(authError.message);
        return;
      }
      const { error: profileError } = await supabase
        .from("scoretap_profiles")
        .update({ login_id: nextLoginId })
        .eq("id", currentUser.internalUserId);
      if (profileError) {
        setAuthMessage(profileError.message);
        return;
      }
    }

    const nextUsers = users.map((user) =>
      user.internalUserId === currentUser.internalUserId ? { ...user, loginId: nextLoginId } : user,
    );
    persistUsers(nextUsers);
    setNewLoginIdInput("");
    setAuthMessage(`ログインIDを${nextLoginId}に変更しました。`);
  }

  async function updateAccountSettings() {
    if (!currentUser) return;
    const nextDisplayName = displayNameInput.trim() || currentUser.displayName;
    const nextPassword = newPasswordInput.trim();
    if (nextPassword && nextPassword.length < 4) {
      setAuthMessage("新しいパスワードは4文字以上で設定してください。");
      return;
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      const updatePayload: { password?: string; data: { display_name: string } } = {
        data: { display_name: nextDisplayName },
      };
      if (nextPassword) updatePayload.password = nextPassword;
      const { error: authError } = await supabase.auth.updateUser(updatePayload);
      if (authError) {
        setAuthMessage(authError.message);
        return;
      }
      const { error: profileError } = await supabase
        .from("scoretap_profiles")
        .update({ display_name: nextDisplayName })
        .eq("id", currentUser.internalUserId);
      if (profileError) {
        setAuthMessage(profileError.message);
        return;
      }
    }

    const nextUsers = users.map((user) =>
      user.internalUserId === currentUser.internalUserId
        ? {
            ...user,
            displayName: nextDisplayName,
            passwordHash: nextPassword ? hashPassword(nextPassword) : user.passwordHash,
          }
        : user,
    );
    persistUsers(nextUsers);
    setDisplayNameInput("");
    setNewPasswordInput("");
    setAuthMessage("アカウント設定を更新しました。");
  }

  function joinTeamByInviteCode() {
    if (!currentUser) {
      setAuthMessage("チームに参加するには先にログインしてください。");
      return;
    }
    const code = inviteCodeInput.trim().toUpperCase();
    const target = teams.find((team) => team.inviteCode === code);
    if (!target) {
      setAuthMessage("招待コードが見つかりません。");
      return;
    }
    const nextTeams = teams.map((team) =>
      team.id === target.id
        ? {
            ...team,
            memberUserIds: Array.from(new Set([...team.memberUserIds, currentUser.internalUserId])),
            roles: { ...team.roles, [currentUser.internalUserId]: team.roles[currentUser.internalUserId] ?? "viewer" },
          }
        : team,
    );
    setTeams(nextTeams);
    window.localStorage.setItem(TEAM_LIST_KEY, JSON.stringify(nextTeams));
    setInviteCodeInput("");
    setAuthMessage(`${target.name}に参加しました。最初の権限は閲覧者です。`);
  }

  function updateLineup(team: TeamKey, index: number, value: string) {
    setGame((current) => {
      const key = team === "home" ? "homeLineup" : "awayLineup";
      const positionKey = team === "home" ? "homeLineupPositions" : "awayLineupPositions";
      const pitcherKey = team === "home" ? "homeStartingPitcher" : "awayStartingPitcher";
      const nextLineup = [...current[key]];
      nextLineup[index] = value;
      return {
        ...current,
        [key]: nextLineup,
        defense: {
          ...current.defense,
          [team]: makeDefense(nextLineup, current[positionKey], current[pitcherKey]),
        },
      };
    });
  }

  function updateLineupPosition(team: TeamKey, index: number, value: LineupPosition) {
    setGame((current) => {
      const lineupKey = team === "home" ? "homeLineup" : "awayLineup";
      const positionKey = team === "home" ? "homeLineupPositions" : "awayLineupPositions";
      const pitcherKey = team === "home" ? "homeStartingPitcher" : "awayStartingPitcher";
      const nextPositions = [...current[positionKey]];
      nextPositions[index] = value;

      return {
        ...current,
        [positionKey]: nextPositions,
        defense: {
          ...current.defense,
          [team]: makeDefense(current[lineupKey], nextPositions, current[pitcherKey]),
        },
      };
    });
  }

  function updateStartingPitcher(team: TeamKey, value: string) {
    setGame((current) => {
      const lineupKey = team === "home" ? "homeLineup" : "awayLineup";
      const positionKey = team === "home" ? "homeLineupPositions" : "awayLineupPositions";
      const pitcherKey = team === "home" ? "homeStartingPitcher" : "awayStartingPitcher";

      return {
        ...current,
        [pitcherKey]: value,
        defense: {
          ...current.defense,
          [team]: makeDefense(current[lineupKey], current[positionKey], value),
        },
      };
    });
  }

  function updateSettings(nextSettings: Partial<GameSettings>) {
    setGame((current) => ({
      ...current,
      settings: {
        ...current.settings,
        ...nextSettings,
      },
      awayLineupPositions:
        nextSettings.dhEnabled === false
          ? current.awayLineupPositions.map((position, index) => (position === "DH" ? defaultLineupPositions[index] : position))
          : current.awayLineupPositions,
      homeLineupPositions:
        nextSettings.dhEnabled === false
          ? current.homeLineupPositions.map((position, index) => (position === "DH" ? defaultLineupPositions[index] : position))
          : current.homeLineupPositions,
      defense:
        nextSettings.dhEnabled === false
          ? {
              away: makeDefense(
                current.awayLineup,
                current.awayLineupPositions.map((position, index) =>
                  position === "DH" ? defaultLineupPositions[index] : position,
                ),
                "",
              ),
              home: makeDefense(
                current.homeLineup,
                current.homeLineupPositions.map((position, index) =>
                  position === "DH" ? defaultLineupPositions[index] : position,
                ),
                "",
              ),
            }
          : current.defense,
    }));
  }

  function record(action: ActionKey) {
    if (game.status === "completed") return;
    pushUndoSnapshot(game);
    setGame((current) => applyPlay(current, action, requiresPosition.has(action) ? selectedPosition : null));
  }

  function recordPitch(pitch: PitchKey) {
    if (game.status === "completed") return;
    pushUndoSnapshot(game);
    setGame((current) => applyPitch(current, pitch));
  }

  function placeCurrentBatterOnFirst() {
    if (game.status === "completed" || game.bases.first) return;
    pushUndoSnapshot(game);
    setGame((current) => {
      if (current.status === "completed") return current;
      return {
        ...current,
        bases: {
          ...current.bases,
          first: {
            name: currentBatter(current),
            team: battingTeam(current),
            responsiblePitcher: current.defense[fieldingTeam(current)].P,
          },
        },
      };
    });
    setSelectedBase("first");
  }

  function operateSelectedRunner(action: RunnerAction) {
    if (!selectedBase || !selectedRunner || game.status === "completed") return;
    pushUndoSnapshot(game);

    setGame((current) => {
      if (current.status === "completed") return current;
      const runner = current.bases[selectedBase];
      if (!runner) return current;

      let nextOuts = current.outs;
      let nextEarnedOuts = current.earnedOuts;
      let nextEarnedOutsByPitcher = current.earnedOutsByPitcher;
      let nextScore = current.score;
      const nextBases = { ...current.bases, [selectedBase]: null };
      let descriptionJa = "";
      let code = "ADV";
      let runEvents: RunEvent[] = [];

      if (action === "out" || action === "caughtStealing") {
        nextOuts += 1;
        nextEarnedOuts += 1;
        nextEarnedOutsByPitcher = addEarnedOutsByPitcher(current, 1);
        descriptionJa = action === "caughtStealing" ? `${runner.name}が盗塁失敗でアウト` : `${runner.name}が走塁アウト`;
        code = action === "caughtStealing" ? "CS" : "OOB";
      } else {
        const destination = action === "score" ? "home" : nextBase(selectedBase);
        const isPassedBall = action === "passedBall";
        const isWildPitch = action === "wildPitch";
        if (destination === "home") {
          nextScore = {
            ...current.score,
            [runner.team]: current.score[runner.team] + 1,
          };
          runEvents = [
            makeRunEvent(
              current,
              runner,
              action === "steal" ? "ホームスチールで得点" : isWildPitch ? "暴投で得点" : isPassedBall ? "捕逸で得点" : "走塁で得点",
              isPassedBall,
            ),
          ];
          descriptionJa =
            action === "steal"
              ? `${runner.name}がホームスチール成功`
              : isWildPitch
                ? `${runner.name}が暴投でホームイン`
                : isPassedBall
                  ? `${runner.name}が捕逸でホームイン`
                  : `${runner.name}がホームイン`;
          code = action === "steal" ? "SBH" : isWildPitch ? "WP" : isPassedBall ? "PB" : "R";
        } else {
          nextBases[destination] = isPassedBall ? { ...runner, earnedResponsible: false } : runner;
          descriptionJa =
            action === "steal"
              ? `${runner.name}が${baseLabel(destination)}へ盗塁成功`
              : isWildPitch
                ? `${runner.name}が暴投で${baseLabel(destination)}へ進塁`
                : isPassedBall
                  ? `${runner.name}が捕逸で${baseLabel(destination)}へ進塁`
              : `${runner.name}が${baseLabel(destination)}へ進塁`;
          code = action === "steal" ? "SB" : isWildPitch ? "WP" : isPassedBall ? "PB" : "ADV";
        }
      }

      const inningState = clearHalfInning(
        { ...current, bases: nextBases, score: nextScore, earnedOutsByPitcher: nextEarnedOutsByPitcher },
        nextOuts,
        nextEarnedOuts,
      );
      const entry = makeHistoryEntry(current, {
        type: "play",
        descriptionJa,
        code,
        runEvents,
        outsAfter: inningState.outs,
        scoreAfter: nextScore,
      });

      return finishGameIfNeeded({
        ...current,
        ...inningState,
        score: nextScore,
        history: [entry, ...current.history],
      });
    });

    setSelectedBase(null);
  }

  function adjustScore(team: TeamKey, amount: number) {
    if (game.status === "completed") return;
    pushUndoSnapshot(game);
    setGame((current) => {
      if (current.status === "completed") return current;
      return {
        ...current,
        score: {
          ...current.score,
          [team]: Math.max(0, current.score[team] + amount),
        },
      };
    });
  }

  function saveTeamProfile() {
    const name = teamNameInput.trim();
    const players = teamPlayersInput.map((player) => player.trim()).filter(Boolean);
    if (!name) return;

    const nextTeam: TeamProfile = {
      id: editingTeamId || makeId(),
      name,
      players,
      inviteCode: editingTeamId
        ? teams.find((team) => team.id === editingTeamId)?.inviteCode || makeInviteCode(teams)
        : makeInviteCode(teams),
      ownerUserId: editingTeamId ? teams.find((team) => team.id === editingTeamId)?.ownerUserId : currentUser?.internalUserId,
      memberUserIds: editingTeamId
        ? teams.find((team) => team.id === editingTeamId)?.memberUserIds || []
        : currentUser
          ? [currentUser.internalUserId]
          : [],
      roles: editingTeamId
        ? teams.find((team) => team.id === editingTeamId)?.roles || {}
        : currentUser
          ? { [currentUser.internalUserId]: "admin" }
          : {},
    };

    setTeams((current) => {
      const nextTeams = [nextTeam, ...current.filter((team) => team.id !== nextTeam.id && team.name !== name)];
      window.localStorage.setItem(TEAM_LIST_KEY, JSON.stringify(nextTeams));
      return nextTeams;
    });
    setTeamNameInput("");
    setTeamPlayersInput([]);
    setMemberNameInput("");
    setEditingTeamId("");
    setOpenTeamMenuId("");
  }

  function editTeamProfile(team: TeamProfile) {
    setEditingTeamId(team.id);
    setTeamNameInput(team.name);
    setTeamPlayersInput(team.players);
    setMemberNameInput("");
    setOpenTeamMenuId("");
  }

  function deleteTeamProfile(teamId: string) {
    const target = teams.find((team) => team.id === teamId);
    if (!target) return;
    if (!window.confirm(`${target.name}を削除しますか？試合記録は残ります。`)) return;

    setTeams((current) => {
      const nextTeams = current.filter((team) => team.id !== teamId);
      window.localStorage.setItem(TEAM_LIST_KEY, JSON.stringify(nextTeams));
      return nextTeams;
    });
    if (selectedTeamId === teamId) {
      setSelectedTeamId("");
      setSelectedPlayerName("");
      setViewMode("home");
    }
    if (editingTeamId === teamId) {
      setEditingTeamId("");
      setTeamNameInput("");
      setTeamPlayersInput([]);
      setMemberNameInput("");
    }
  }

  function addMemberName() {
    const name = memberNameInput.trim();
    if (!name) return;
    setTeamPlayersInput((current) => (current.includes(name) ? current : [...current, name]));
    setMemberNameInput("");
  }

  function removeMemberName(name: string) {
    setTeamPlayersInput((current) => current.filter((player) => player !== name));
  }

  function deleteStoredGame(gameId: string) {
    const target = games.find((item) => item.id === gameId);
    if (!target) return;
    if (!window.confirm(`${target.awayTeam || "先攻未設定"} vs ${target.homeTeam || "後攻未設定"} の試合記録を削除しますか？`)) {
      return;
    }

    setGames((current) => {
      const nextGames = current.filter((item) => item.id !== gameId);
      window.localStorage.setItem(GAME_LIST_KEY, JSON.stringify(nextGames));
      return nextGames;
    });
    if (game.id === gameId) {
      const next = makeInitialGame();
      setGame(next);
      setUndoStack([]);
      writeUndoStack([]);
      window.localStorage.removeItem(STORAGE_KEY);
      setViewMode("home");
    }
  }

  function undoGameEnd() {
    if (game.status !== "completed") return;
    pushUndoSnapshot(game);
    setGame((current) => {
      if (current.status !== "completed") return current;
      return {
        ...current,
        status: "inProgress",
        endReason: undefined,
        endedAt: undefined,
        history: current.history.filter((entry, index) => !(index === 0 && entry.type === "game")),
      };
    });
  }

  function applyTeamProfile(side: TeamKey, profileId: string) {
    const profile = teams.find((team) => team.id === profileId);
    if (!profile) return;

    setGame((current) => {
      const lineup = [...defaultNames].map((fallback, index) => profile.players[index] || fallback);
      const lineupKey = side === "home" ? "homeLineup" : "awayLineup";
      const positionKey = side === "home" ? "homeLineupPositions" : "awayLineupPositions";
      const pitcherKey = side === "home" ? "homeStartingPitcher" : "awayStartingPitcher";
      const teamKey = side === "home" ? "homeTeam" : "awayTeam";

      return {
        ...current,
        [teamKey]: profile.name,
        [lineupKey]: lineup,
        defense: {
          ...current.defense,
          [side]: makeDefense(lineup, current[positionKey], current[pitcherKey] || profile.players[0] || ""),
        },
      };
    });
  }

  function openTeamDetail(teamId: string) {
    setSelectedTeamId(teamId);
    setSelectedPlayerName("");
    setViewMode("teamDetail");
  }

  function openPlayerDetail(playerName: string) {
    setSelectedPlayerName(playerName);
    setSelectedPlateAppearanceId("");
    setViewMode("playerDetail");
  }

  function recordSubstitution() {
    const nextName = subName.trim();
    if (!selectedPosition || !nextName || game.status === "completed") return;
    pushUndoSnapshot(game);

    setGame((current) => {
      if (current.status === "completed") return current;
      const team = fieldingTeam(current);
      const oldName = current.defense[team][selectedPosition];
      const descriptionJa = `${teamName(current, team)}: ${positionLabels[selectedPosition]}を${oldName}から${nextName}に交代`;
      const entry = makeHistoryEntry(current, {
        type: "substitution",
        descriptionJa,
        code: `SUB ${scoreCodes[selectedPosition]}`,
      });

      return {
        ...current,
        earnedOutsByPitcher:
          selectedPosition === "P"
            ? {
                ...current.earnedOutsByPitcher,
                [nextName]: current.outs,
              }
            : current.earnedOutsByPitcher,
        defense: {
          ...current.defense,
          [team]: {
            ...current.defense[team],
            [selectedPosition]: nextName,
          },
        },
        history: [entry, ...current.history],
      };
    });
    setSubName("");
  }

  function recordBattingSubstitution() {
    const nextName = battingSubName.trim();
    if (!nextName || game.status === "completed") return;
    pushUndoSnapshot(game);

    setGame((current) => {
      if (current.status === "completed") return current;
      const team = battingTeam(current);
      const lineupKey = team === "away" ? "awayLineup" : "homeLineup";
      const lineupIndex = current.currentBatterIndex[team] % 9;
      const oldName = current[lineupKey][lineupIndex];
      const nextLineup = [...current[lineupKey]];
      nextLineup[lineupIndex] = nextName;
      const descriptionJa = `${teamName(current, team)}: ${lineupIndex + 1}番を${oldName}から${nextName}に交代`;
      const entry = makeHistoryEntry(current, {
        type: "substitution",
        batter: nextName,
        descriptionJa,
        code: "PH",
      });

      return {
        ...current,
        [lineupKey]: nextLineup,
        history: [entry, ...current.history],
      };
    });
    setBattingSubName("");
  }

  function resetCount() {
    if (game.status === "completed") return;
    pushUndoSnapshot(game);
    setGame((current) => ({ ...current, count: { balls: 0, strikes: 0 } }));
  }

  function createNewGame() {
    const next = makeInitialGame();
    setGame(next);
    setUndoStack([]);
    writeUndoStack([]);
    setSubName("");
    setBattingSubName("");
    setSelectedPosition("SS");
    setSelectedBase(null);
    setViewMode("setup");
  }

  function openGame(savedGame: GameState) {
    const nextGame = normalizeGame(savedGame);
    setGame(nextGame);
    if (nextGame.id !== game.id) {
      setUndoStack([]);
      writeUndoStack([]);
    }
    setSubName("");
    setBattingSubName("");
    setSelectedPosition("SS");
    setSelectedBase(null);
    setViewMode(savedGame.status === "draft" ? "setup" : "score");
  }

  function startGame() {
    pushUndoSnapshot(game);
    setGame((current) => ({
      ...current,
      status: "inProgress",
      startedAt: current.startedAt || nowString(),
      updatedAt: nowString(),
    }));
    setViewMode("score");
  }

  function endCurrentGame(reason: EndReason) {
    if (game.status === "completed") return;
    const message = reason === "called" ? "コールド終了にしますか？" : "試合終了にしますか？";
    if (!window.confirm(message)) return;
    pushUndoSnapshot(game);
    setGame((current) => finishGame(current, reason));
  }

  function resetGame() {
    if (!window.confirm("入力中の試合をリセットしますか？")) return;
    const next = makeInitialGame();
    setGame(next);
    setUndoStack([]);
    writeUndoStack([]);
    setViewMode("home");
    window.localStorage.removeItem(STORAGE_KEY);
  }

  if (!ready) {
    return <main className="min-h-dvh p-4" />;
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 lg:px-8">
      <header className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-green-800">ScoreTap Baseball</p>
          <h1 className="text-2xl font-black tracking-normal text-slate-950 sm:text-3xl">
            1球ごとにつける野球スコア
          </h1>
        </div>
        {viewMode !== "home" && (
          <button
            className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm"
            onClick={() => setViewMode("home")}
          >
            ホーム
          </button>
        )}
      </header>

      {viewMode === "home" ? (
        <section className="grid gap-4">
          <div className="rounded-lg bg-white p-4 shadow-panel sm:p-6">
            {issuedAccount ? (
              <div className="grid gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-950">初期情報を発行しました</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    次の3つを控えてください。確認するとアプリを使い始められます。
                  </p>
                </div>
                <div className="grid gap-2 rounded-md bg-amber-50 p-4">
                  <div>
                    <p className="text-xs font-black text-amber-800">ログインID</p>
                    <p className="text-lg font-black text-slate-950">{issuedAccount.loginId}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black text-amber-800">初期パスワード</p>
                    <p className="text-lg font-black text-slate-950">{issuedAccount.password}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black text-amber-800">復旧コード</p>
                    <p className="text-lg font-black text-slate-950">{issuedAccount.recoveryCode}</p>
                  </div>
                </div>
                <p className="rounded-md bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-600">
                  初期パスワードと復旧コードは、あとからこの画面では再表示しません。ログイン後の設定でID、表示名、パスワードを変更できます。
                </p>
                <button
                  className="min-h-12 rounded-md bg-green-700 px-4 text-sm font-black text-white"
                  onClick={() => setIssuedAccount(null)}
                >
                  控えたので始める
                </button>
              </div>
            ) : (
              <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950">{currentUser ? "アカウント設定" : "ログイン"}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {currentUser
                    ? "ID、表示名、パスワードはここで変更できます。"
                    : "発行済みのIDとパスワードでログインします。"}
                </p>
                <p className="mt-1 text-xs font-black text-green-800">保存状態: {cloudStatus}</p>
              </div>
              {currentUser && (
                <button
                  className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-black text-slate-700"
                  onClick={logoutAccount}
                >
                  ログアウト
                </button>
              )}
            </div>
            {currentUser ? (
              <div className="mt-4 grid gap-3">
                <div className="rounded-md bg-green-50 p-3">
                  <p className="text-xs font-black text-green-800">ログイン中</p>
                  <p className="mt-1 text-base font-black text-slate-950">
                    {currentUser.displayName} / ID: {currentUser.loginId}
                  </p>
                  <p className="mt-1 text-xs font-bold text-green-800">
                    復旧コードは初回発行時に控えたものを使います。
                  </p>
                  </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    className="min-h-12 rounded-md border border-slate-300 px-3 text-base"
                    placeholder="新しいログインID"
                    value={newLoginIdInput}
                    onChange={(event) => setNewLoginIdInput(event.target.value)}
                  />
                  <button
                    className="min-h-12 rounded-md bg-slate-950 px-4 text-sm font-black text-white disabled:bg-slate-300"
                    disabled={!newLoginIdInput.trim()}
                    onClick={changeLoginId}
                  >
                    ID変更
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className="min-h-12 rounded-md border border-slate-300 px-3 text-base"
                    placeholder="表示名"
                    value={displayNameInput}
                    onChange={(event) => setDisplayNameInput(event.target.value)}
                  />
                  <input
                    className="min-h-12 rounded-md border border-slate-300 px-3 text-base"
                    placeholder="新しいパスワード"
                    type="password"
                    value={newPasswordInput}
                    onChange={(event) => setNewPasswordInput(event.target.value)}
                  />
                </div>
                <button
                  className="min-h-12 rounded-md bg-slate-950 px-4 text-sm font-black text-white disabled:bg-slate-300"
                  disabled={!displayNameInput.trim() && !newPasswordInput.trim()}
                  onClick={updateAccountSettings}
                >
                  設定を保存
                </button>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    className="min-h-12 rounded-md border border-slate-300 px-3 text-base uppercase"
                    placeholder="チーム招待コード"
                    value={inviteCodeInput}
                    onChange={(event) => setInviteCodeInput(event.target.value)}
                  />
                  <button
                    className="min-h-12 rounded-md bg-green-700 px-4 text-sm font-black text-white disabled:bg-slate-300"
                    disabled={!inviteCodeInput.trim()}
                    onClick={joinTeamByInviteCode}
                  >
                    参加
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 grid gap-3">
                <input
                  className="min-h-12 rounded-md border border-slate-300 px-3 text-base"
                  placeholder="ログインID"
                  value={loginIdInput}
                  onChange={(event) => setLoginIdInput(event.target.value)}
                />
                <input
                  className="min-h-12 rounded-md border border-slate-300 px-3 text-base"
                  placeholder="パスワード"
                  type="password"
                  value={loginPasswordInput}
                  onChange={(event) => setLoginPasswordInput(event.target.value)}
                />
                <button
                  className="min-h-12 rounded-md bg-slate-950 px-4 text-sm font-black text-white disabled:bg-slate-300"
                  disabled={!loginIdInput.trim() || !loginPasswordInput.trim()}
                  onClick={loginAccount}
                >
                  ログイン
                </button>
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-sm font-black text-slate-950">はじめて使う場合</p>
                  <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                    ボタンを押すと、初期IDと初期パスワードが発行されます。ログイン後に設定から変更できます。
                  </p>
                  <button
                    className="mt-3 min-h-12 w-full rounded-md bg-green-700 px-4 text-sm font-black text-white"
                    onClick={issueAccount}
                  >
                    IDと初期パスワードを発行
                  </button>
                </div>
              </div>
            )}
            {authMessage && <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm font-bold text-amber-800">{authMessage}</p>}
            <p className="mt-3 text-xs font-bold leading-5 text-slate-500">
              ログインすると、試合記録やチーム情報をクラウドに同期できます。初期パスワードと復旧コードは必ず控えてください。
            </p>
              </>
            )}
          </div>

          {currentUser && (
            <>
          <div className="rounded-lg bg-white p-5 shadow-panel sm:p-6">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <h2 className="text-xl font-black text-slate-950">ホーム</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  新しい試合記録を作るか、保存済みの試合結果を開きます。
                </p>
              </div>
              <button
                className="min-h-[3.25rem] rounded-md bg-green-700 px-5 py-4 text-base font-black text-white shadow-sm"
                onClick={createNewGame}
              >
                新しい試合記録を作る
              </button>
            </div>
          </div>

          <div className="rounded-lg bg-white p-4 shadow-panel sm:p-6">
            <h2 className="mb-3 text-lg font-black text-slate-950">試合結果一覧</h2>
            {games.length === 0 ? (
              <p className="rounded-md bg-slate-50 p-4 text-sm font-bold text-slate-500">
                まだ保存された試合はありません。
              </p>
            ) : (
              <ol className="grid gap-3">
                {games.map((savedGame) => (
                  <li
                    key={savedGame.id}
                    className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-500">
                        {savedGame.date} / {savedGame.status === "completed" ? endReasonLabel(savedGame.endReason) : "記録中"}
                      </p>
                      <p className="mt-1 truncate text-base font-black text-slate-950">
                        {savedGame.awayTeam || "先攻未設定"} {savedGame.score.away} - {savedGame.score.home}{" "}
                        {savedGame.homeTeam || "後攻未設定"}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-600">
                        {savedGame.status === "completed"
                          ? winnerLabel(savedGame)
                          : `${savedGame.inning}回${halfLabel(savedGame.half)} / アウト ${savedGame.outs}`}
                      </p>
                    </div>
                    <div className="relative flex items-center gap-2">
                      <button
                        className="min-h-11 rounded-md bg-slate-950 px-4 text-sm font-black text-white"
                        onClick={() => openGame(savedGame)}
                      >
                        開く
                      </button>
                      <button
                        className="grid h-11 w-11 place-items-center rounded-md border border-slate-300 bg-white text-lg font-black text-slate-700"
                        onClick={() => setOpenGameMenuId((current) => (current === savedGame.id ? "" : savedGame.id))}
                        aria-label="試合操作"
                      >
                        ⋯
                      </button>
                      {openGameMenuId === savedGame.id && (
                        <div className="absolute right-0 top-12 z-10 grid min-w-32 gap-1 rounded-md border border-slate-200 bg-white p-1 shadow-panel">
                          <button
                            className="rounded-md px-3 py-2 text-left text-sm font-black text-red-700 hover:bg-red-50"
                            onClick={() => deleteStoredGame(savedGame.id)}
                          >
                            削除
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="rounded-lg bg-white p-4 shadow-panel sm:p-6">
            <div className="mb-3">
              <h2 className="text-lg font-black text-slate-950">チーム・メンバー登録</h2>
              <p className="mt-1 text-sm font-bold text-slate-500">
                チームごとにメンバーを保存します。巨人と阪神のように、別チームは別カードで管理されます。
              </p>
            </div>
            {editingTeamId && (
              <p className="mb-3 rounded-md bg-amber-50 p-3 text-sm font-bold text-amber-800">
                {teamNameInput || "選択中のチーム"}を編集中です。保存するとこのチームだけ上書きされます。
              </p>
            )}
            <div className="grid gap-3">
              <input
                className="min-h-12 rounded-md border border-slate-300 px-3 text-base"
                placeholder="チーム名 例: 巨人"
                value={teamNameInput}
                onChange={(event) => setTeamNameInput(event.target.value)}
              />
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  className="min-h-12 rounded-md border border-slate-300 px-3 text-base"
                  placeholder="メンバー名"
                  value={memberNameInput}
                  onChange={(event) => setMemberNameInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addMemberName();
                    }
                  }}
                />
                <button
                  className="min-h-12 rounded-md bg-slate-950 px-4 text-sm font-black text-white disabled:bg-slate-300"
                  disabled={!memberNameInput.trim()}
                  onClick={addMemberName}
                >
                  追加
                </button>
              </div>
              {teamPlayersInput.length > 0 && (
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-black text-slate-500">
                    {teamNameInput.trim() || "このチーム"}に登録する選手
                  </p>
                  <div className="flex flex-wrap gap-2">
                  {teamPlayersInput.map((player) => (
                    <button
                      key={player}
                      className="rounded-md bg-white px-3 py-2 text-sm font-black text-slate-800 shadow-sm"
                      onClick={() => removeMemberName(player)}
                    >
                      {player} ×
                    </button>
                  ))}
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  className="min-h-12 flex-1 rounded-md bg-green-700 px-4 text-sm font-black text-white disabled:bg-slate-300"
                  disabled={!teamNameInput.trim()}
                  onClick={saveTeamProfile}
                >
                  {editingTeamId ? "チームを更新" : "チームを保存"}
                </button>
                {editingTeamId && (
                  <button
                    className="min-h-12 rounded-md border border-slate-300 bg-white px-4 text-sm font-black text-slate-700"
                    onClick={() => {
                      setEditingTeamId("");
                      setTeamNameInput("");
                      setTeamPlayersInput([]);
                      setMemberNameInput("");
                    }}
                  >
                    キャンセル
                  </button>
                )}
              </div>
            </div>
            {teams.length > 0 && (
              <div className="mt-5 grid gap-3">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                      <p className="text-base font-black text-slate-950">{team.name}</p>
                      <p className="text-xs font-bold text-slate-500">
                        {team.players.length}人登録 / 招待コード {team.inviteCode}
                      </p>
                      </div>
                      <div className="relative flex gap-2">
                        <button
                          className="min-h-10 rounded-md bg-slate-950 px-3 text-xs font-black text-white"
                          onClick={() => openTeamDetail(team.id)}
                        >
                          詳細
                        </button>
                        <button
                          className="grid h-10 w-10 place-items-center rounded-md border border-slate-300 bg-white text-lg font-black text-slate-700"
                          onClick={() => setOpenTeamMenuId((current) => (current === team.id ? "" : team.id))}
                          aria-label="チーム操作"
                        >
                          ⋯
                        </button>
                        {openTeamMenuId === team.id && (
                          <div className="absolute right-0 top-11 z-10 grid min-w-32 gap-1 rounded-md border border-slate-200 bg-white p-1 shadow-panel">
                            <button
                              className="rounded-md px-3 py-2 text-left text-sm font-black text-slate-700 hover:bg-slate-50"
                              onClick={() => editTeamProfile(team)}
                            >
                              編集
                            </button>
                            <button
                              className="rounded-md px-3 py-2 text-left text-sm font-black text-red-700 hover:bg-red-50"
                              onClick={() => deleteTeamProfile(team.id)}
                            >
                              削除
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {team.players.slice(0, 8).map((player) => (
                        <span key={player} className="rounded-md bg-white px-2 py-1 text-xs font-black text-slate-700">
                          {player}
                        </span>
                      ))}
                      {team.players.length > 8 && (
                        <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-slate-500">
                          +{team.players.length - 8}
                        </span>
                      )}
                      {team.players.length === 0 && (
                        <span className="text-xs font-bold text-slate-500">まだ選手が登録されていません。</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-xs font-black text-slate-700"
                        onClick={() => applyTeamProfile("away", team.id)}
                      >
                        先攻に使う
                      </button>
                      <button
                        className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-xs font-black text-slate-700"
                        onClick={() => applyTeamProfile("home", team.id)}
                      >
                        後攻に使う
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
            </>
          )}
        </section>
      ) : viewMode === "teamDetail" && selectedTeam ? (
        <section className="grid gap-4">
          <div className="rounded-lg bg-white p-4 shadow-panel sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-green-800">チーム詳細</p>
                <h2 className="text-2xl font-black text-slate-950">{selectedTeam.name}</h2>
              </div>
              <button
                className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-black text-slate-700"
                onClick={() => setViewMode("home")}
              >
                一覧へ
              </button>
            </div>
            {(() => {
              const record = teamRecord(games, selectedTeam.name);
              const relatedGames = teamGames(games, selectedTeam.name);
              const joinedUsers = selectedTeam.memberUserIds
                .map((userId) => users.find((user) => user.internalUserId === userId))
                .filter((user): user is AppUser => Boolean(user));
              return (
                <div className="mt-4 grid gap-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-slate-100 p-3">
                      <p className="text-xs font-bold text-slate-500">試合</p>
                      <p className="text-2xl font-black text-slate-950">{relatedGames.length}</p>
                    </div>
                    <div className="rounded-md bg-slate-100 p-3">
                      <p className="text-xs font-bold text-slate-500">勝敗</p>
                      <p className="text-xl font-black text-slate-950">
                        {record.wins}勝{record.losses}敗
                      </p>
                    </div>
                    <div className="rounded-md bg-slate-100 p-3">
                      <p className="text-xs font-bold text-slate-500">引分</p>
                      <p className="text-2xl font-black text-slate-950">{record.draws}</p>
                    </div>
                  </div>
                  <div className="rounded-md bg-green-50 p-3">
                    <p className="text-xs font-black text-green-800">招待コード</p>
                    <p className="mt-1 text-lg font-black text-slate-950">{selectedTeam.inviteCode}</p>
                    <p className="mt-1 text-xs font-bold text-green-800">
                      参加中: {joinedUsers.length ? joinedUsers.map((user) => user.displayName).join("、") : "未ログイン運用"}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="rounded-lg bg-white p-4 shadow-panel sm:p-6">
            <h3 className="mb-3 text-lg font-black text-slate-950">選手一覧</h3>
            {selectedTeam.players.length === 0 ? (
              <p className="rounded-md bg-slate-50 p-4 text-sm font-bold text-slate-500">
                まだメンバーが登録されていません。
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {selectedTeam.players.map((player) => {
                  const stats = playerStats(games, selectedTeam.name, player);
                  const hits = stats.singles + stats.doubles + stats.triples + stats.homeRuns;
                  const atBats = Math.max(
                    0,
                    stats.pa - stats.walks - stats.hitByPitch - stats.sacrificeBunts - stats.sacrificeFlies,
                  );
                  const obpDenominator = atBats + stats.walks + stats.hitByPitch + stats.sacrificeFlies;
                  const totalBases = stats.singles + stats.doubles * 2 + stats.triples * 3 + stats.homeRuns * 4;
                  const ops = (hits + stats.walks + stats.hitByPitch) / obpDenominator + totalBases / atBats;
                  return (
                    <button
                      key={player}
                      className="rounded-md border border-slate-200 bg-slate-50 p-3 text-left"
                      onClick={() => openPlayerDetail(player)}
                    >
                      <p className="text-base font-black text-slate-950">{player}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {stats.games}試合 / 打率 {formatAverage(hits / atBats)} / OPS {formatAverage(ops)} / HR {stats.homeRuns}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      ) : viewMode === "playerDetail" && selectedTeam ? (
        <section className="grid gap-4">
          <div className="rounded-lg bg-white p-4 shadow-panel sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-green-800">{selectedTeam.name}</p>
                <h2 className="text-2xl font-black text-slate-950">{selectedPlayerName}</h2>
              </div>
              <button
                className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-black text-slate-700"
                onClick={() => setViewMode("teamDetail")}
              >
                チームへ
              </button>
            </div>
            {(() => {
              const stats = playerStats(games, selectedTeam.name, selectedPlayerName);
              const appearances = playerPlateAppearances(games, selectedTeam.name, selectedPlayerName);
              const hits = stats.singles + stats.doubles + stats.triples + stats.homeRuns;
              const atBats = Math.max(0, stats.pa - stats.walks - stats.hitByPitch - stats.sacrificeBunts - stats.sacrificeFlies);
              const onBaseDenominator = atBats + stats.walks + stats.hitByPitch + stats.sacrificeFlies;
              const totalBases = stats.singles + stats.doubles * 2 + stats.triples * 3 + stats.homeRuns * 4;
              const battingAverage = hits / atBats;
              const onBasePercentage = (hits + stats.walks + stats.hitByPitch) / onBaseDenominator;
              const sluggingPercentage = totalBases / atBats;
              const ops = onBasePercentage + sluggingPercentage;
              const pitchesPerPa = stats.pa ? stats.pitchesSeen / stats.pa : 0;
              const walkRate = stats.pa ? stats.walks / stats.pa : 0;
              const strikeoutRate = stats.pa ? stats.strikeouts / stats.pa : 0;
              const walkToStrikeout = stats.strikeouts ? (stats.walks / stats.strikeouts).toFixed(2) : stats.walks ? "∞" : "0.00";
              const foulPerPa = stats.pa ? stats.fouls / stats.pa : 0;
              const statTiles = [
                ["試合", stats.games],
                ["打席", stats.pa],
                ["打数", atBats],
                ["打率", formatAverage(battingAverage)],
                ["出塁率", formatAverage(onBasePercentage)],
                ["長打率", formatAverage(sluggingPercentage)],
                ["OPS", formatAverage(ops)],
                ["安打", hits],
                ["二塁打", stats.doubles],
                ["三塁打", stats.triples],
                ["本塁打", stats.homeRuns],
                ["四球", stats.walks],
                ["死球", stats.hitByPitch],
                ["三振", stats.strikeouts],
                ["犠打", stats.sacrificeBunts],
                ["犠飛", stats.sacrificeFlies],
                ["盗塁", stats.stolenBases],
                ["盗塁死", stats.caughtStealing],
                ["P/PA", pitchesPerPa.toFixed(1)],
                ["BB%", formatPercent(walkRate)],
                ["K%", formatPercent(strikeoutRate)],
                ["BB/K", walkToStrikeout],
                ["F/PA", foulPerPa.toFixed(1)],
              ];
              return (
                <>
                  <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {statTiles.map(([label, value]) => (
                      <div className="rounded-md bg-slate-100 p-2 text-center" key={label}>
                        <p className="text-[11px] font-bold text-slate-500">{label}</p>
                        <p className="text-base font-black text-slate-950">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-md bg-green-50 p-3">
	                    <p className="text-sm font-black text-green-900">打席の傾向</p>
	                    <p className="mt-1 text-sm font-bold leading-6 text-green-800">
	                      {appearances.length}打席で平均{pitchesPerPa.toFixed(1)}球。BB%は{formatPercent(walkRate)}、
	                      K%は{formatPercent(strikeoutRate)}、ファウルは1打席あたり{foulPerPa.toFixed(1)}球です。
	                    </p>
                  </div>
                  <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
                    OPSは出塁率と長打率を足した総合的な打力の目安です。P/PAは1打席あたり球数、F/PAは1打席あたりファウル数です。
                  </p>
                </>
              );
            })()}
          </div>

          <div className="rounded-lg bg-white p-4 shadow-panel sm:p-6">
            <h3 className="mb-3 text-lg font-black text-slate-950">投手データ</h3>
            {(() => {
              const pitching = pitcherStats(games, selectedTeam.name, selectedPlayerName);
              if (pitching.games === 0) {
                return (
                  <p className="rounded-md bg-slate-50 p-4 text-sm font-bold text-slate-500">
                    投手としての登板データはまだありません。
                  </p>
                );
              }

              const strikeoutRate = pitching.battersFaced ? pitching.strikeouts / pitching.battersFaced : 0;
              const walkRate = pitching.battersFaced ? pitching.walks / pitching.battersFaced : 0;
              const inningsPitched = pitching.outs / 3;
              const era = inningsPitched ? (pitching.earnedRuns * 9) / inningsPitched : 0;
              const runAverage = inningsPitched ? (pitching.runsAllowed * 9) / inningsPitched : 0;
              const whip = inningsPitched ? (pitching.walks + pitching.hitsAllowed) / inningsPitched : 0;
              const strikeoutToWalk = pitching.walks
                ? (pitching.strikeouts / pitching.walks).toFixed(2)
                : pitching.strikeouts
                  ? "∞"
                  : "0.00";
              const pitchTiles = [
                ["登板", pitching.games],
                ["投球回", formatInnings(pitching.outs)],
                ["防御率", formatDecimal(era)],
                ["RA/9", formatDecimal(runAverage)],
                ["WHIP", formatDecimal(whip)],
                ["K/BB", strikeoutToWalk],
                ["K%", formatPercent(strikeoutRate)],
                ["BB%", formatPercent(walkRate)],
                ["BF", pitching.battersFaced],
                ["球数", pitching.pitches],
                ["P/BF", pitching.battersFaced ? (pitching.pitches / pitching.battersFaced).toFixed(1) : "0.0"],
                ["被安打", pitching.hitsAllowed],
                ["被本塁打", pitching.homeRunsAllowed],
                ["四球", pitching.walks],
                ["死球", pitching.hitByPitch],
                ["奪三振", pitching.strikeouts],
                ["失点", pitching.runsAllowed],
                ["自責点", pitching.earnedRuns],
              ];

              return (
                <>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {pitchTiles.map(([label, value]) => (
                      <div className="rounded-md bg-slate-100 p-2 text-center" key={label}>
                        <p className="text-[11px] font-bold text-slate-500">{label}</p>
                        <p className="text-base font-black text-slate-950">{value}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 rounded-md bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
                    防御率は自責点 x 9 ÷ 投球回で計算。エラー出塁、捕逸、エラーがなければ3アウト後の得点は非自責として扱います。
                  </p>
                  <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
                    WHIPは1投球回あたりに出した安打と四球の数です。RA/9は自責点に限らず、全失点を9回あたりに直した数字です。
                    BFは対戦打者、P/BFは1打者あたり球数です。
                  </p>
                </>
              );
            })()}
          </div>

          <div className="rounded-lg bg-white p-4 shadow-panel sm:p-6">
            <h3 className="mb-3 text-lg font-black text-slate-950">関連プレー</h3>
            <ol className="grid max-h-[28rem] gap-2 overflow-auto">
              {playerPlateAppearances(games, selectedTeam.name, selectedPlayerName).map((appearance) => {
                const summary = pitchSummary(appearance);
                return (
                  <li key={appearance.id}>
                    <button
                      className={`w-full rounded-md border p-3 text-left ${
                        selectedPlateAppearanceId === appearance.id
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-950"
                      }`}
                      onClick={() =>
                        setSelectedPlateAppearanceId((current) => (current === appearance.id ? "" : appearance.id))
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p
                            className={`text-xs font-black ${
                              selectedPlateAppearanceId === appearance.id ? "text-slate-300" : "text-slate-500"
                            }`}
                          >
                            {appearance.gameDate} / {appearance.inning}回{halfLabel(appearance.half)}
                          </p>
                          <p className="mt-1 text-sm font-black">{appearance.result.descriptionJa}</p>
                          <p
                            className={`mt-1 text-xs font-bold ${
                              selectedPlateAppearanceId === appearance.id ? "text-slate-300" : "text-slate-500"
                            }`}
                          >
                            {appearance.result.code}
                          </p>
                        </div>
                        <p className="shrink-0 rounded-md bg-white px-2 py-1 text-sm font-black text-green-800">
                          {summary.total}球
                        </p>
                      </div>
                    </button>
                    {selectedPlateAppearanceId === appearance.id && (
                      <div className="mt-2 rounded-md border border-slate-200 bg-white p-3">
	              <div className="grid grid-cols-4 gap-2 text-center">
                          <div className="rounded-md bg-slate-100 p-2">
                            <p className="text-[11px] font-bold text-slate-500">球数</p>
                            <p className="text-lg font-black text-slate-950">{summary.total}</p>
                          </div>
                          <div className="rounded-md bg-slate-100 p-2">
                            <p className="text-[11px] font-bold text-slate-500">ボール</p>
                            <p className="text-lg font-black text-slate-950">{summary.balls}</p>
                          </div>
                          <div className="rounded-md bg-slate-100 p-2">
                            <p className="text-[11px] font-bold text-slate-500">ファウル</p>
                            <p className="text-lg font-black text-slate-950">{summary.fouls}</p>
                          </div>
                          <div className="rounded-md bg-slate-100 p-2">
                            <p className="text-[11px] font-bold text-slate-500">空振り</p>
                            <p className="text-lg font-black text-slate-950">{summary.swingingStrikes}</p>
                          </div>
                        </div>
                        {appearance.pitches.length === 0 ? (
                          <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm font-bold text-slate-500">
                            この打席の1球記録はありません。
                          </p>
                        ) : (
                          <ol className="mt-3 grid gap-2">
                            {appearance.pitches.map((pitch, index) => (
                              <li
                                className="grid grid-cols-[3rem_1fr_auto] items-center gap-2 rounded-md bg-slate-50 p-2"
                                key={pitch.id}
                              >
                                <p className="text-sm font-black text-slate-500">{index + 1}球目</p>
                                <p className="text-sm font-black text-slate-950">{pitch.descriptionJa}</p>
                                <p className="text-xs font-bold text-slate-500">
                                  {pitch.countAfter ? countLabel(pitch.countAfter) : ""}
                                </p>
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      ) : viewMode === "setup" ? (
        <section className="rounded-lg bg-white p-4 shadow-panel sm:p-6">
          <div className="mb-5">
            <h2 className="text-xl font-black text-slate-950">試合を作成</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              打順と守備位置を登録できます。試合中の選手交代はスコア画面でも変更できます。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm font-bold text-slate-700">
              日付
              <input
                type="date"
                className="min-h-12 rounded-md border border-slate-300 px-3 text-base"
                value={game.date}
                onChange={(event) => setGame({ ...game, date: event.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm font-bold text-slate-700">
              先攻チーム
              <input
                className="min-h-12 rounded-md border border-slate-300 px-3 text-base"
                placeholder="ビジター"
                value={game.awayTeam}
                onChange={(event) => setGame({ ...game, awayTeam: event.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm font-bold text-slate-700">
              後攻チーム
              <input
                className="min-h-12 rounded-md border border-slate-300 px-3 text-base"
                placeholder="ホーム"
                value={game.homeTeam}
                onChange={(event) => setGame({ ...game, homeTeam: event.target.value })}
              />
            </label>
          </div>

          {teams.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-bold text-slate-700">
                登録チームを先攻に使う
                <select
                  className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-base"
                  defaultValue=""
                  onChange={(event) => applyTeamProfile("away", event.target.value)}
                >
                  <option value="" disabled>
                    選択
                  </option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-bold text-slate-700">
                登録チームを後攻に使う
                <select
                  className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-base"
                  defaultValue=""
                  onChange={(event) => applyTeamProfile("home", event.target.value)}
                >
                  <option value="" disabled>
                    選択
                  </option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(["away", "home"] as const).map((side) => {
              const lineup = side === "away" ? game.awayLineup : game.homeLineup;
              const name = side === "away" ? game.awayTeam : game.homeTeam;
              return (
                <div key={side} className="rounded-md bg-slate-50 p-3">
                  <p className="text-xs font-black text-slate-500">{side === "away" ? "先攻" : "後攻"}</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{name || "チーム未設定"}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {lineup.slice(0, 9).map((player, index) => (
                      <span key={`${side}-${index}-${player}`} className="rounded-md bg-white px-2 py-1 text-xs font-black text-slate-700">
                        {index + 1}. {player}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-3 text-sm font-black text-slate-800">試合設定</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-1 text-sm font-bold text-slate-700">
                予定イニング
                <select
                  className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-base"
                  value={game.settings.scheduledInnings}
                  onChange={(event) => updateSettings({ scheduledInnings: Number(event.target.value) })}
                >
                  <option value={5}>5回</option>
                  <option value={6}>6回</option>
                  <option value={7}>7回</option>
                  <option value={9}>9回</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-bold text-slate-700">
                コールド点差
                <select
                  className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-base disabled:bg-slate-100"
                  value={game.settings.mercyRuns}
                  disabled={!game.settings.mercyEnabled}
                  onChange={(event) => updateSettings({ mercyRuns: Number(event.target.value) })}
                >
                  <option value={7}>7点差</option>
                  <option value={10}>10点差</option>
                  <option value={15}>15点差</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm font-bold text-slate-700">
                コールド適用
                <select
                  className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-base disabled:bg-slate-100"
                  value={game.settings.mercyAfterInning}
                  disabled={!game.settings.mercyEnabled}
                  onChange={(event) => updateSettings({ mercyAfterInning: Number(event.target.value) })}
                >
                  <option value={3}>3回以降</option>
                  <option value={4}>4回以降</option>
                  <option value={5}>5回以降</option>
                  <option value={7}>7回以降</option>
                </select>
              </label>
              <div className="grid gap-2 rounded-md bg-white p-3">
                <label className="flex min-h-8 items-center gap-2 text-sm font-bold text-slate-700">
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={game.settings.dhEnabled}
                    onChange={(event) => updateSettings({ dhEnabled: event.target.checked })}
                  />
                  DH制
                </label>
                <label className="flex min-h-8 items-center gap-2 text-sm font-bold text-slate-700">
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={game.settings.mercyEnabled}
                    onChange={(event) => updateSettings({ mercyEnabled: event.target.checked })}
                  />
                  コールドあり
                </label>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {(["away", "home"] as const).map((team) => (
              <div key={team} className="grid gap-4">
                <div>
                  <h3 className="mb-2 text-sm font-black text-slate-800">
                    {team === "away" ? "先攻" : "後攻"}のスタメン
                  </h3>
                  <div className="grid gap-2">
                    {(team === "away" ? game.awayLineup : game.homeLineup).map((name, index) => (
                      <label
                        className="grid grid-cols-[3rem_1fr_6rem] items-center gap-2 text-sm font-bold text-slate-600"
                        key={`${team}-${index}`}
                      >
                        {index + 1}番
                        <input
                          className="min-h-11 rounded-md border border-slate-300 px-3 text-base font-medium text-slate-900"
                          value={name}
                          onChange={(event) => updateLineup(team, index, event.target.value)}
                        />
                        <select
                          className="min-h-11 rounded-md border border-slate-300 bg-white px-2 text-sm font-bold text-slate-800"
                          value={(team === "away" ? game.awayLineupPositions : game.homeLineupPositions)[index]}
                          onChange={(event) => updateLineupPosition(team, index, event.target.value as LineupPosition)}
                        >
                          {lineupPositionOptions.map((position) => (
                            <option
                              key={position}
                              value={position}
                              disabled={position === "DH" && !game.settings.dhEnabled}
                            >
                              {lineupPositionLabels[position]}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
                <p className="rounded-md bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-600">
                  守備位置は打順の右側で選べます。DHを使う場合は「試合設定」でDH制をオンにしてください。
                </p>
                {game.settings.dhEnabled && (
                  <label className="grid gap-1 text-sm font-bold text-slate-700">
                    DH時の投手
                    <input
                      className="min-h-11 rounded-md border border-slate-300 px-3 text-base"
                      placeholder="投手名"
                      value={team === "away" ? game.awayStartingPitcher : game.homeStartingPitcher}
                      onChange={(event) => updateStartingPitcher(team, event.target.value)}
                    />
                  </label>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              className="min-h-[3.25rem] flex-1 rounded-md bg-green-700 px-5 py-4 text-base font-black text-white shadow-sm disabled:bg-slate-300"
              disabled={!game.homeTeam || !game.awayTeam}
              onClick={startGame}
            >
              スコア入力を開始
            </button>
            <button
              className="min-h-[3.25rem] rounded-md border border-red-200 bg-red-50 px-5 py-4 text-base font-black text-red-700"
              onClick={resetGame}
            >
              リセット
            </button>
          </div>
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_0.92fr]">
          <section className="grid gap-4">
            <div className="sticky top-0 z-30 -mx-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-slate-200 bg-white/95 px-4 py-2 text-sm shadow-sm backdrop-blur sm:hidden">
              <div className="min-w-0">
                <p className="font-black text-slate-950">
                  {game.inning}回{halfLabel(game.half)} / {game.outs}死
                </p>
                <p className="truncate text-xs font-bold text-slate-500">打者 {batter}</p>
              </div>
              <div className="rounded-md bg-slate-950 px-2 py-1 text-center font-black text-white">
                {game.score.away}-{game.score.home}
              </div>
              <div className="min-w-0 text-right">
                <p className="font-black text-slate-950">B{game.count.balls} S{game.count.strikes}</p>
                <p className="truncate text-xs font-bold text-slate-500">
                  {game.bases.first ? "1" : "-"}
                  {game.bases.second ? "2" : "-"}
                  {game.bases.third ? "3" : "-"}
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-white p-4 shadow-panel">
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-md bg-slate-100 p-3">
                  <p className="text-xs font-bold text-slate-500">イニング</p>
                  <p className="text-xl font-black text-slate-950">
                    {game.inning}回{halfLabel(game.half)}
                  </p>
                </div>
                <div className="rounded-md bg-slate-100 p-3">
                  <p className="text-xs font-bold text-slate-500">アウト</p>
                  <p className="text-2xl font-black text-slate-950">{game.outs}</p>
                </div>
                <div className="rounded-md bg-slate-100 p-3">
                  <p className="text-xs font-bold text-slate-500">カウント</p>
                  <p className="text-2xl font-black text-slate-950">{countLabel(game.count)}</p>
                </div>
                <div className="rounded-md bg-slate-100 p-3">
                  <p className="text-xs font-bold text-slate-500">打者</p>
                  <p className="truncate text-base font-black text-slate-950">{batter}</p>
                </div>
	              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-lg bg-slate-100 p-4">
                  <p className="mb-3 text-xs font-black text-slate-500">BSO</p>
                  <div className="grid gap-2">
                    <CountDots label="B" active={game.count.balls} total={3} color="bg-green-500" />
                    <CountDots label="S" active={game.count.strikes} total={2} color="bg-amber-400" />
                    <CountDots label="O" active={game.outs} total={2} color="bg-red-500" />
                  </div>
                </div>

                <div className="rounded-lg bg-slate-100 p-4">
                  <p className="mb-2 text-xs font-black text-slate-500">塁状況</p>
                  <div className="relative mx-auto h-32 w-32">
                    <button
                      className={`absolute left-1/2 top-1 h-12 w-12 -translate-x-1/2 rotate-45 rounded-md border-2 ${
                        game.bases.second ? "border-amber-500 bg-amber-300" : "border-slate-300 bg-white"
                      } ${selectedBase === "second" ? "ring-4 ring-slate-950/20" : ""}`}
                      onClick={() => setSelectedBase("second")}
                      aria-label="二塁"
                    >
                      <span className="-rotate-45 block text-[10px] font-black text-slate-800">
                        {game.bases.second ? game.bases.second.name.slice(0, 2) : "2B"}
                      </span>
                    </button>
                    <button
                      className={`absolute right-1 top-1/2 h-12 w-12 -translate-y-1/2 rotate-45 rounded-md border-2 ${
                        game.bases.first ? "border-amber-500 bg-amber-300" : "border-slate-300 bg-white"
                      } ${selectedBase === "first" ? "ring-4 ring-slate-950/20" : ""}`}
                      onClick={() => setSelectedBase("first")}
                      aria-label="一塁"
                    >
                      <span className="-rotate-45 block text-[10px] font-black text-slate-800">
                        {game.bases.first ? game.bases.first.name.slice(0, 2) : "1B"}
                      </span>
                    </button>
                    <button
                      className={`absolute left-1 top-1/2 h-12 w-12 -translate-y-1/2 rotate-45 rounded-md border-2 ${
                        game.bases.third ? "border-amber-500 bg-amber-300" : "border-slate-300 bg-white"
                      } ${selectedBase === "third" ? "ring-4 ring-slate-950/20" : ""}`}
                      onClick={() => setSelectedBase("third")}
                      aria-label="三塁"
                    >
                      <span className="-rotate-45 block text-[10px] font-black text-slate-800">
                        {game.bases.third ? game.bases.third.name.slice(0, 2) : "3B"}
                      </span>
                    </button>
                    <div className="absolute bottom-1 left-1/2 grid h-10 w-10 -translate-x-1/2 rotate-45 place-items-center rounded-md border-2 border-slate-300 bg-white">
                      <span className="-rotate-45 text-[10px] font-black text-slate-500">H</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg bg-slate-950 p-4 text-white">
                <div className="min-w-0 text-right">
                  <p className="truncate text-sm font-bold text-slate-300">{game.awayTeam}</p>
                  <p className="text-4xl font-black">{game.score.away}</p>
                </div>
                <div className="text-sm font-black text-slate-500">-</div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-300">{game.homeTeam}</p>
                  <p className="text-4xl font-black">{game.score.home}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {(["first", "second", "third"] as const).map((base) => (
                  <button
                    key={base}
                    className={`min-h-16 rounded-md border p-2 text-center transition ${
                      selectedBase === base
                        ? "border-slate-950 bg-slate-950 text-white"
                        : game.bases[base]
                          ? "border-amber-400 bg-amber-100 text-slate-950"
                          : "border-slate-200 bg-slate-50 text-slate-950"
                    }`}
                    onClick={() => setSelectedBase(base)}
                  >
                    <p className={`text-xs font-black ${selectedBase === base ? "text-slate-300" : "text-slate-500"}`}>
                      {baseLabel(base)}
                    </p>
                    <p className="mt-1 truncate text-sm font-black">
                      {game.bases[base]?.name || "空き"}
                    </p>
                  </button>
                ))}
              </div>

              <p className="mt-3 text-sm font-bold text-green-800">
                攻撃中: {teamName(game, currentTeam)} / 守備: {teamName(game, defenseTeam)}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                {game.settings.scheduledInnings}回制 / {game.settings.dhEnabled ? "DHあり" : "DHなし"} /{" "}
                {game.settings.mercyEnabled
                  ? `${game.settings.mercyAfterInning}回以降 ${game.settings.mercyRuns}点差コールド`
                  : "コールドなし"}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"
                  disabled={!canUndoGame}
                  onClick={restorePreviousGameState}
                >
                  1つ戻す
                </button>
                <button
                  className="min-h-10 rounded-md border border-amber-300 bg-amber-50 px-3 text-sm font-black text-amber-800 disabled:bg-slate-100 disabled:text-slate-400"
                  disabled={game.status !== "completed"}
                  onClick={undoGameEnd}
                >
                  試合終了を取り消す
                </button>
              </div>
              {game.status === "completed" ? (
                <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3">
                  <p className="text-sm font-black text-green-900">
                    試合終了: {winnerLabel(game)}
                  </p>
                  <p className="mt-1 text-xs font-bold text-green-800">
                    {endReasonLabel(game.endReason)} / 最終スコア {game.score.away}-{game.score.home}
                  </p>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    className="min-h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-black text-slate-700"
                    onClick={() => endCurrentGame("manual")}
                  >
                    試合終了
                  </button>
                  <button
                    className="min-h-11 rounded-md border border-red-200 bg-red-50 px-3 text-sm font-black text-red-700"
                    onClick={() => endCurrentGame("called")}
                  >
                    コールド終了
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-lg bg-white p-4 shadow-panel">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-black text-slate-950">1球ごとに記録</h2>
                <button
                  className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"
                  disabled={game.status === "completed"}
                  onClick={resetCount}
                >
                  カウント修正
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(Object.keys(pitchLabels) as PitchKey[]).map((pitch) => (
                  <button
                    key={pitch}
                    className="min-h-16 rounded-md bg-amber-500 px-3 py-3 text-base font-black text-slate-950 shadow-sm active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400"
                    disabled={game.status === "completed"}
                    onClick={() => recordPitch(pitch)}
                  >
                    {pitchLabels[pitch].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 shadow-panel">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-slate-950">ランナー操作</h2>
                  <p className="mt-1 text-sm font-bold text-slate-500">
                    {selectedRunner && selectedBase
                      ? `${baseLabel(selectedBase)}の${selectedRunner.name}を操作`
                      : "塁上のランナーをタップ"}
                  </p>
                </div>
                <button
                  className="min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"
                  disabled={game.status === "completed" || Boolean(game.bases.first)}
                  onClick={placeCurrentBatterOnFirst}
                >
                  打者を一塁へ
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button
                  className="min-h-12 rounded-md bg-amber-500 px-3 text-sm font-black text-slate-950 disabled:bg-slate-200 disabled:text-slate-400"
                  disabled={game.status === "completed" || !selectedRunner}
                  onClick={() => operateSelectedRunner("steal")}
                >
                  盗塁
                </button>
                <button
                  className="min-h-12 rounded-md bg-green-700 px-3 text-sm font-black text-white disabled:bg-slate-300"
                  disabled={game.status === "completed" || !selectedRunner}
                  onClick={() => operateSelectedRunner("advance")}
                >
                  進塁
                </button>
                <button
                  className="min-h-12 rounded-md bg-slate-950 px-3 text-sm font-black text-white disabled:bg-slate-300"
                  disabled={game.status === "completed" || !selectedRunner}
                  onClick={() => operateSelectedRunner("score")}
                >
                  ホームへ
                </button>
                <button
                  className="min-h-12 rounded-md bg-blue-600 px-3 text-sm font-black text-white disabled:bg-slate-300"
                  disabled={game.status === "completed" || !selectedRunner}
                  onClick={() => operateSelectedRunner("wildPitch")}
                >
                  暴投
                </button>
                <button
                  className="min-h-12 rounded-md bg-purple-600 px-3 text-sm font-black text-white disabled:bg-slate-300"
                  disabled={game.status === "completed" || !selectedRunner}
                  onClick={() => operateSelectedRunner("passedBall")}
                >
                  捕逸
                </button>
                <button
                  className="min-h-12 rounded-md border border-red-200 bg-red-50 px-3 text-sm font-black text-red-700 disabled:bg-slate-100 disabled:text-slate-400"
                  disabled={game.status === "completed" || !selectedRunner}
                  onClick={() => operateSelectedRunner("caughtStealing")}
                >
                  盗塁死
                </button>
                <button
                  className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"
                  disabled={game.status === "completed" || !selectedRunner}
                  onClick={() => operateSelectedRunner("out")}
                >
                  アウト
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(["away", "home"] as const).map((team) => (
                  <div className="rounded-md bg-slate-50 p-2" key={team}>
                    <p className="truncate text-xs font-black text-slate-500">{teamName(game, team)}</p>
                    <div className="mt-2 grid grid-cols-[1fr_1fr] gap-2">
                      <button
                        className="min-h-10 rounded-md border border-slate-300 bg-white text-sm font-black text-slate-700 disabled:bg-slate-100"
                        disabled={game.status === "completed"}
                        onClick={() => adjustScore(team, -1)}
                      >
                        -1
                      </button>
                      <button
                        className="min-h-10 rounded-md bg-slate-950 text-sm font-black text-white disabled:bg-slate-300"
                        disabled={game.status === "completed"}
                        onClick={() => adjustScore(team, 1)}
                      >
                        +1
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 shadow-panel">
              <h2 className="mb-3 text-lg font-black text-slate-950">打席結果を記録</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(Object.keys(actionLabels) as ActionKey[])
                  .filter((action) => action !== "strikeout")
                  .map((action) => (
                  <button
                    key={action}
                    className="min-h-16 rounded-md bg-green-700 px-3 py-3 text-base font-black text-white shadow-sm active:scale-[0.99] disabled:bg-slate-300"
                    disabled={game.status === "completed"}
                    onClick={() => record(action)}
                  >
                    {actionLabels[action]}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-4">
            <div className="rounded-lg bg-white p-4 shadow-panel">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-black text-slate-950">守備位置をタップ</h2>
                <p className="rounded-md bg-green-100 px-3 py-1 text-sm font-black text-green-900">
                  {selectedPosition ? `${selectedPosition}: ${selectedDefender}` : "未選択"}
                </p>
              </div>
              <div className="relative mx-auto aspect-square max-w-md overflow-hidden rounded-lg bg-field-grass">
                <div className="absolute left-1/2 top-[47%] h-[47%] w-[47%] -translate-x-1/2 rotate-45 rounded-md bg-field-clay" />
                <div className="absolute left-1/2 top-[51%] h-[39%] w-[39%] -translate-x-1/2 rotate-45 rounded-sm border-4 border-field-chalk/90" />
                <div className="absolute left-1/2 top-[69%] h-[13%] w-[13%] -translate-x-1/2 rounded-full bg-field-clay" />
                {fieldPositions.map((position) => (
                  <button
                    key={position.key}
                    className={`absolute ${position.className} grid h-14 w-14 place-items-center rounded-md border-2 px-1 text-center text-xs font-black shadow-sm transition ${
                      selectedPosition === position.key
                        ? "border-white bg-slate-950 text-white"
                        : "border-white/80 bg-white text-slate-950"
                    }`}
                    onClick={() => setSelectedPosition(position.key)}
                    aria-label={positionLabels[position.key]}
                  >
                    <span>{position.key}</span>
                    <span className="block max-w-12 truncate text-[10px] leading-3">
                      {game.defense[defenseTeam][position.key]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 shadow-panel">
              <h2 className="mb-3 text-lg font-black text-slate-950">守備交代</h2>
              <div className="grid gap-2">
                <p className="text-sm font-bold text-slate-600">
                  {teamName(game, defenseTeam)} の {selectedPosition ? positionLabels[selectedPosition] : "守備位置"}:
                  <span className="ml-1 text-slate-950">{selectedDefender || "未登録"}</span>
                </p>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input
                    className="min-h-12 rounded-md border border-slate-300 px-3 text-base"
                    placeholder="交代後の選手名"
                    value={subName}
                    disabled={game.status === "completed"}
                    onChange={(event) => setSubName(event.target.value)}
                  />
                  <button
                    className="min-h-12 rounded-md bg-slate-950 px-4 text-sm font-black text-white disabled:bg-slate-300"
                    disabled={game.status === "completed" || !selectedPosition || !subName.trim()}
                    onClick={recordSubstitution}
                  >
                    交代
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 shadow-panel">
              <h2 className="mb-3 text-lg font-black text-slate-950">攻撃側の交代</h2>
              <div className="grid gap-2">
                <p className="text-sm font-bold text-slate-600">
                  {teamName(game, currentTeam)} の現在の打者:
                  <span className="ml-1 text-slate-950">{batter}</span>
                </p>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input
                    className="min-h-12 rounded-md border border-slate-300 px-3 text-base"
                    placeholder="代打・交代後の選手名"
                    value={battingSubName}
                    disabled={game.status === "completed"}
                    onChange={(event) => setBattingSubName(event.target.value)}
                  />
                  <button
                    className="min-h-12 rounded-md bg-slate-950 px-4 text-sm font-black text-white disabled:bg-slate-300"
                    disabled={game.status === "completed" || !battingSubName.trim()}
                    onClick={recordBattingSubstitution}
                  >
                    交代
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 shadow-panel">
              <h2 className="mb-3 text-lg font-black text-slate-950">履歴</h2>
              {game.history.length === 0 ? (
                <p className="rounded-md bg-slate-50 p-4 text-sm font-bold text-slate-500">
                  まだ記録はありません。
                </p>
              ) : (
                <ol className="grid max-h-[32rem] gap-2 overflow-auto pr-1">
                  {game.history.map((entry) => (
                    <li key={entry.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-500">
                            {entry.inning}回{halfLabel(entry.half)} / {entry.batter}
                          </p>
                          <p className="mt-1 text-sm font-black text-slate-950">{entry.descriptionJa}</p>
                          {entry.countAfter && (
                            <p className="mt-1 text-xs font-bold text-slate-500">
                              カウント {countLabel(entry.countAfter)}
                            </p>
                          )}
                          {entry.runEvents?.length ? (
                            <p className="mt-1 text-xs font-bold text-slate-500">
                              得点 {entry.runEvents.length} / 自責点 {entry.runEvents.filter((run) => run.earned).length}
                            </p>
                          ) : null}
                        </div>
                        <div className="shrink-0 rounded-md bg-white px-2 py-1 text-sm font-black text-green-800">
                          {entry.code}
                        </div>
                      </div>
                      <p className="mt-2 text-xs font-bold text-slate-500">
                        スコア {entry.scoreAfter.away}-{entry.scoreAfter.home} / アウト {entry.outsAfter}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
