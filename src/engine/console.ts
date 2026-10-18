// An identity admin console, like the account pages in Entra ID or Google
// Workspace admin: users, their sign-in sessions, mailbox rules and MFA method.
// The player fixes a compromised account by doing the steps, and the case
// checks the result and the order they were done in.

export type MfaMethod = "push" | "number" | "sms" | "off";

export const MFA_LABEL: Record<MfaMethod, string> = {
  push: "Push notification (approve or deny)",
  number: "Push with number matching",
  sms: "Text message code",
  off: "Off",
};

export interface ConsoleSession {
  id: string;
  device: string;
  ip: string;
  place: string;
  since: string;
}

export interface ConsoleRule {
  id: string;
  name: string;
  summary: string;
}

export interface ConsoleUser {
  upn: string;
  name: string;
  role: string;
  mfa: MfaMethod;
  sessions: ConsoleSession[];
  rules: ConsoleRule[];
  blocked?: boolean;
  deleted?: boolean;
  passwordReset?: boolean;
}

export type ConsoleAction =
  | { type: "revoke"; upn: string }
  | { type: "reset"; upn: string }
  | { type: "delete-rule"; upn: string; rule: string }
  | { type: "mfa"; upn: string; method: MfaMethod }
  | { type: "block"; upn: string; on: boolean }
  | { type: "delete-user"; upn: string };

export interface ConsoleState {
  users: ConsoleUser[];
  log: { action: ConsoleAction; note: string; warn?: boolean }[];
}

/** Someone who still holds a user's password, and comes back if they can. */
export interface ConsoleIntruder {
  upn: string;
  ip: string;
}

export type ConsoleGoal =
  | { kind: "password-reset"; upn: string; label: string }
  | { kind: "no-sessions"; upn: string; label: string }
  | { kind: "reset-before-revoke"; upn: string; label: string }
  | { kind: "rule-removed"; upn: string; rule: string; label: string }
  | { kind: "rule-kept"; upn: string; rule: string; label: string }
  | { kind: "mfa"; upn: string; method: MfaMethod; label: string }
  | { kind: "only-touched"; upn: string; label: string } // and never blocked or deleted
  | { kind: "blocked"; upn: string; label: string } // sign-in blocked, account kept
  | { kind: "untouched"; upn: string; label: string } // this account left exactly as it was
  | { kind: "none-deleted"; upn: string; label: string }; // no account deleted anywhere

export function initConsole(users: readonly ConsoleUser[]): ConsoleState {
  return { users: JSON.parse(JSON.stringify(users)) as ConsoleUser[], log: [] };
}

function find(state: ConsoleState, upn: string): ConsoleUser {
  const u = state.users.find((x) => x.upn === upn);
  if (!u) throw new Error(`no user ${upn}`);
  return u;
}

/** Do one admin action. Returns what the console says about it. */
export function act(state: ConsoleState, action: ConsoleAction, intruder?: ConsoleIntruder): string {
  const u = find(state, action.upn);
  let note: string;
  let warn = false;
  if (u.deleted) {
    note = `${u.upn} has been deleted. There is nothing left to change.`;
    state.log.push({ action, note, warn: true });
    return note;
  }
  switch (action.type) {
    case "revoke": {
      const n = u.sessions.length;
      u.sessions = [];
      note = `Signed ${u.upn} out of ${n} session${n === 1 ? "" : "s"}. Every device has to sign in again.`;
      // with the old password still working, the intruder simply tries again
      if (intruder && intruder.upn === u.upn && !u.passwordReset) {
        note += ` Moments later: a new sign-in attempt for ${u.upn} from ${intruder.ip}, with the right password. An MFA prompt went to the user's phone.`;
        warn = true;
      }
      break;
    }
    case "reset":
      u.passwordReset = true;
      note = `Password reset for ${u.upn}. A temporary password went to their manager, to be changed at next sign-in. Existing sessions stay signed in until they are revoked.`;
      break;
    case "delete-rule": {
      const r = u.rules.find((x) => x.id === action.rule);
      u.rules = u.rules.filter((x) => x.id !== action.rule);
      note = r ? `Deleted the mailbox rule "${r.name}".` : "That rule was already gone.";
      break;
    }
    case "mfa":
      u.mfa = action.method;
      note = `MFA for ${u.upn} is now: ${MFA_LABEL[action.method]}.`;
      warn = action.method === "off";
      break;
    case "block":
      u.blocked = action.on;
      note = action.on ? `Sign-in blocked for ${u.upn}. The account cannot be used until it is unblocked.` : `Sign-in allowed again for ${u.upn}.`;
      break;
    case "delete-user":
      u.deleted = true;
      u.sessions = [];
      note = `Deleted ${u.upn}. The mailbox, files and history are gone with it.`;
      warn = true;
      break;
  }
  state.log.push({ action, note, warn });
  return note;
}

export function goalMet(state: ConsoleState, goal: ConsoleGoal, start: readonly ConsoleUser[]): boolean {
  if (goal.kind === "none-deleted") return !state.users.some((x) => x.deleted);
  const u = state.users.find((x) => x.upn === goal.upn);
  if (!u || u.deleted) return false;
  const firstReset = state.log.findIndex((l) => l.action.type === "reset" && l.action.upn === goal.upn);
  switch (goal.kind) {
    case "password-reset":
      return !!u.passwordReset;
    case "no-sessions":
      return u.sessions.length === 0;
    case "reset-before-revoke": {
      const revokes = state.log.flatMap((l, i) => (l.action.type === "revoke" && l.action.upn === goal.upn ? [i] : []));
      return firstReset >= 0 && revokes.length > 0 && revokes.every((i) => i > firstReset);
    }
    case "rule-removed":
      return !u.rules.some((r) => r.id === goal.rule);
    case "rule-kept":
      return u.rules.some((r) => r.id === goal.rule);
    case "mfa":
      return u.mfa === goal.method;
    case "blocked":
      return !!u.blocked;
    case "untouched":
      return JSON.stringify(u) === JSON.stringify(start.find((x) => x.upn === goal.upn));
    case "only-touched": {
      if (state.users.some((x) => x.blocked || x.deleted)) return false;
      return state.users.every((x) => x.upn === goal.upn || JSON.stringify(x) === JSON.stringify(start.find((s) => s.upn === x.upn)));
    }
  }
}

export function goalsMet(state: ConsoleState, goals: readonly ConsoleGoal[], start: readonly ConsoleUser[]): boolean {
  return goals.every((g) => goalMet(state, g, start));
}
