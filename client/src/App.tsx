import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { analytics } from "@heycatch/sdk";
import { Icon, LogoMark, EmptyArt, ProgressRing } from "./icons";
import type { IconName, ArtVariant } from "./icons";
import {
  callAction,
  setToken,
  CATEGORIES,
  PRIORITIES,
  money,
  todayStr,
  fmtDate,
} from "./api";
import type {
  AppState,
  AuthState,
  Bill,
  DayResetPlan,
  Dump,
  Member,
  PlanTier,
  RescuePlan,
  SortSuggestion,
  Task,
  UnlockCode,
} from "./api";

type View =
  | "today"
  | "braindump"
  | "rescue"
  | "week"
  | "home"
  | "money"
  | "family"
  | "myself"
  | "pending"
  | "resetday"
  | "weeklyreset"
  | "packages"
  | "household"
  | "help";

const LOCKED_VIEWS: View[] = ["rescue", "week", "home", "money", "family", "myself", "pending", "resetday", "weeklyreset"];

const NAV: { view: View; label: string; icon: IconName; section?: string }[] = [
  { view: "today", label: "Today", icon: "sun", section: "Start here" },
  { view: "braindump", label: "Brain Dump", icon: "cloud" },
  { view: "rescue", label: "Life Rescue", icon: "lifebuoy" },
  { view: "week", label: "My Week", icon: "calendar", section: "Your life" },
  { view: "home", label: "My Home", icon: "home" },
  { view: "money", label: "My Money", icon: "wallet" },
  { view: "family", label: "My Family", icon: "users" },
  { view: "myself", label: "Myself", icon: "leaf" },
  { view: "pending", label: "Pending", icon: "hourglass" },
  { view: "resetday", label: "Reset My Day", icon: "refresh", section: "Resets" },
  { view: "weeklyreset", label: "Weekly Reset", icon: "calendarCheck" },
  { view: "packages", label: "Packages", icon: "package", section: "Account" },
  { view: "household", label: "Household", icon: "sliders" },
  { view: "help", label: "Help", icon: "help" },
];

const MOBILE_NAV: View[] = ["today", "braindump", "rescue", "week", "packages"];

const SUPPORT_EMAIL = "millercoachall@gmail.com";

function useAppState() {
  return useQuery({
    queryKey: ["appstate"],
    queryFn: () => callAction<AppState>("getAppState"),
  });
}

function useAuthState() {
  return useQuery({
    queryKey: ["authstate"],
    queryFn: () => callAction<AuthState>("getAuthState"),
  });
}

function Err({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="error">{message}</div>;
}

// Illustrated empty state — a small spot illustration + an encouraging line.
function EmptyState({ art, title, message }: { art: ArtVariant; title: string; message: string }) {
  return (
    <div className="empty-state">
      <EmptyArt variant={art} />
      <div className="empty-title">{title}</div>
      <p className="muted">{message}</p>
    </div>
  );
}

// Consecutive days (ending today, or yesterday if nothing done today yet)
// with at least one task completed — from tasks already in the app state.
function computeStreak(tasks: Task[]): number {
  const doneDays = new Set(
    tasks
      .filter((t) => t.status === "done" && t.completedAt)
      .map((t) => t.completedAt!.slice(0, 10))
  );
  let streak = 0;
  const d = new Date();
  let key = d.toISOString().slice(0, 10);
  if (!doneDays.has(key)) {
    d.setDate(d.getDate() - 1);
    key = d.toISOString().slice(0, 10);
  }
  while (doneDays.has(key)) {
    streak++;
    d.setDate(d.getDate() - 1);
    key = d.toISOString().slice(0, 10);
  }
  return streak;
}

function LockedScreen({ onGoPackages }: { onGoPackages: () => void }) {
  return (
    <div className="card locked">
      <div className="lock-ico">
        <Icon name="lock" size={44} />
      </div>
      <h2>This section is part of a paid plan</h2>
      <p className="muted">
        Your free plan includes Today and Brain Dump. Unlock everything — Life Rescue, My Week,
        all sections, and both resets — with any Life Reset package.
      </p>
      <button className="btn" onClick={onGoPackages}>
        See packages
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ Auth screen
function AuthScreen() {
  const qc = useQueryClient();
  const auth = useAuthState();
  const [tab, setTab] = useState<"signin" | "join" | "start" | "forgot">("signin");
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [newPin, setNewPin] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(action: string, args: Record<string, unknown>) {
    setError(null);
    setBusy(true);
    try {
      const data = (await callAction(action, args)) as { sessionToken?: string };
      if (data.sessionToken) setToken(data.sessionToken);
      await qc.invalidateQueries({ queryKey: ["authstate"] });
      await qc.invalidateQueries({ queryKey: ["appstate"] });
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-col">
        <div className="auth-hero">
          <div className="logo-mark">
            <LogoMark size={56} />
          </div>
          <span className="eyebrow">Get your life back.</span>
          <h1>Life Reset — the household organizer that helps you catch up.</h1>
          <p className="hero-def">
            Life Reset is a household organizer that turns the chaos in your head into one calm,
            shared plan.
          </p>
          <div className="hero-visual" aria-label="Example: a sorted Today plan in Life Reset">
            <div className="hero-visual-head">
              <span className="hero-visual-title">Today</span>
              <span className="chip">2 done · 2 to go</span>
            </div>
            <div className="hero-task done">
              <span className="hero-check">✓</span>
              <span className="hero-task-title">Pay the electric bill</span>
              <span className="hero-task-meta">Today · Mom</span>
            </div>
            <div className="hero-task done">
              <span className="hero-check">✓</span>
              <span className="hero-task-title">Sign the field trip form</span>
              <span className="hero-task-meta">Today · Dad</span>
            </div>
            <div className="hero-task">
              <span className="hero-check" />
              <span className="hero-task-title">Practice at 5 — cleats in the car</span>
              <span className="hero-task-meta">Today · Everyone</span>
            </div>
            <div className="hero-task">
              <span className="hero-check" />
              <span className="hero-task-title">Groceries for the week</span>
              <span className="hero-task-meta">Tomorrow · Mom</span>
            </div>
          </div>
          <div className="hero-steps">
            <div className="plan-step">
              <span className="step-num first">1</span>
              <div>
                <strong>Capture everything.</strong>
                <p className="muted" style={{ margin: "2px 0 0" }}>
                  Get it out of your head in two minutes.
                </p>
              </div>
            </div>
            <div className="plan-step">
              <span className="step-num">2</span>
              <div>
                <strong>Sort it into one shared plan.</strong>
                <p className="muted" style={{ margin: "2px 0 0" }}>
                  Today, this week, who is doing what.
                </p>
              </div>
            </div>
            <div className="plan-step">
              <span className="step-num">3</span>
              <div>
                <strong>Reset your day.</strong>
                <p className="muted" style={{ margin: "2px 0 0" }}>
                  Pick the next step and let the rest wait.
                </p>
              </div>
            </div>
          </div>
          <div className="hero-before-after">
            <p>
              <strong>Before:</strong> Sunday night, everything lived in your head — and you
              were the only one who knew what Monday needed.
            </p>
            <p>
              <strong>After:</strong> The plan is written down, shared with the whole household,
              and the next step is always obvious.
            </p>
          </div>
        </div>
        <div className="card auth-card">
        <div className="tabs">
          <button className={tab === "signin" ? "active" : ""} onClick={() => setTab("signin")}>
            Sign in
          </button>
          <button className={tab === "join" ? "active" : ""} onClick={() => setTab("join")}>
            Join
          </button>
          <button className={tab === "start" ? "active" : ""} onClick={() => setTab("start")}>
            Start a household
          </button>
          <button className={tab === "forgot" ? "active" : ""} onClick={() => setTab("forgot")}>
            Forgot PIN?
          </button>
        </div>
        <Err message={error} />
        {tab === "signin" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit("login", { username, pin });
            }}
          >
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="Your username" />
            <label>PIN</label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoComplete="current-password"
              placeholder="Your 4–12 digit PIN"
            />
            <div style={{ marginTop: 16 }}>
              <button className="btn" style={{ width: "100%" }} disabled={busy}>
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </div>
            {auth.data?.loginOptions?.length ? (
              <p className="muted" style={{ marginTop: 12 }}>
                Signed in before on this device? Usernames: {auth.data.loginOptions.join(", ")}
              </p>
            ) : null}
          </form>
        )}
        {tab === "join" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit("joinHousehold", { joinCode, name, username, pin });
            }}
          >
            <label>Household join code</label>
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="e.g. MAPLE-42" />
            <label>Your name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="First name" />
            <label>Pick a username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Letters, numbers, _ . -" />
            <label>Pick a PIN</label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="4–12 digits"
            />
            <div style={{ marginTop: 16 }}>
              <button className="btn" style={{ width: "100%" }} disabled={busy}>
                {busy ? "Joining…" : "Join this household"}
              </button>
            </div>
            <p className="muted" style={{ marginTop: 12, textAlign: "center" }}>
              Free forever — no card, no trial. Paid plans are optional later.
            </p>
          </form>
        )}
        {tab === "start" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit("createHousehold", { householdName, name, username, pin });
            }}
          >
            <h2 style={{ textAlign: "left", marginBottom: 4 }}>Create your first household.</h2>
            <p className="muted">
              Start your own private household. You&apos;ll be the admin, and your family can
              join with your join code.
            </p>
            <label>Household name</label>
            <input
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              placeholder="e.g. The Miller Household"
            />
            <label>Your name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="First name" />
            <label>Pick a username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Letters, numbers, _ . -" />
            <label>Pick a PIN</label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="4–12 digits"
            />
            <div style={{ marginTop: 16 }}>
              <button className="btn" style={{ width: "100%" }} disabled={busy}>
                {busy ? "Starting…" : "Start my household"}
              </button>
            </div>
            <p className="muted" style={{ marginTop: 12, textAlign: "center" }}>
              Free forever — no card, no trial. Paid plans are optional later.
            </p>
          </form>
        )}
        {tab === "forgot" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit("resetPinWithJoinCode", { username, joinCode, newPin });
            }}
          >
            <p className="muted">
              Enter your username and your household&apos;s join code, then pick a new PIN. Your
              other devices will be signed out.
            </p>
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your username" />
            <label>Household join code</label>
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Ask your household admin" />
            <label>New PIN</label>
            <input
              type="password"
              inputMode="numeric"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="4–12 digits"
            />
            <div style={{ marginTop: 16 }}>
              <button className="btn" style={{ width: "100%" }} disabled={busy}>
                {busy ? "Resetting…" : "Reset my PIN"}
              </button>
            </div>
          </form>
        )}
        <p className="muted" style={{ marginTop: 16, textAlign: "center" }}>
          Locked out? Email us at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </p>
        </div>
        <SiteFooter />
      </div>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <a href="/">Home</a>
      <span aria-hidden="true">·</span>
      <a href="/about">About</a>
      <span aria-hidden="true">·</span>
      <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      <span aria-hidden="true">·</span>
      <span>Built by Brittany Miller</span>
    </footer>
  );
}

// ------------------------------------------------------------------ shared bits
function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["appstate"] });
    qc.invalidateQueries({ queryKey: ["authstate"] });
  };
}

function TaskRow({
  task,
  state,
  showAssignee = true,
}: {
  task: Task;
  state: AppState;
  showAssignee?: boolean;
}) {
  const invalidate = useInvalidate();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const assignee = state.members.find((m) => m.id === task.assigneeMemberId);
  // Left-edge accent: coral for urgent, sage for home, gold for money.
  const accent =
    task.priority === "high" ? "coral" : task.category === "home" ? "sage" : task.category === "money" ? "gold" : "none";

  async function run(action: string, args: Record<string, unknown>) {
    setError(null);
    try {
      await callAction(action, { id: task.id, ...args });
      invalidate();
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    }
  }

  return (
    <div>
      <div className={`task-row accent-${accent} ${task.status === "done" ? "done" : ""}`}>
        <button
          className="check"
          aria-label={task.status === "done" ? "Mark open" : "Mark done"}
          onClick={() => run("setTaskStatus", { status: task.status === "done" ? "open" : "done" })}
        >
          <svg className="check-svg" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </button>
        <div style={{ minWidth: 0 }}>
          <div className="task-title">{task.title}</div>
          <div className="task-meta">
            <span className={`prio prio-${task.priority}`}>
              <span className="prio-dot" />
              {task.priority}
            </span>
            <span>{task.category}</span>
            {task.estMinutes ? <span>· {task.estMinutes} min </span> : null}
            {task.dueDate ? <span>· due {fmtDate(task.dueDate)}</span> : null}
            {task.waitingOn ? <span>· waiting on {task.waitingOn}</span> : null}
            {showAssignee && assignee ? <span>· {assignee.name}</span> : null}
          </div>
          {task.notes ? <div className="task-meta">{task.notes}</div> : null}
          {editing ? (
            <div style={{ marginTop: 8 }}>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes"
                rows={2}
                style={{ marginTop: 6 }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    run("updateTask", { title, notes: notes || null }).then(() => setEditing(false));
                  }}
                >
                  Save
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
          {error ? <div className="error">{error}</div> : null}
        </div>
        <div className="task-actions">
          <button
            className={`icon-btn ${task.pinned ? "pinned" : ""}`}
            title={task.pinned ? "Unpin from top 3" : "Pin to top 3"}
            onClick={() => run("togglePin", { pinned: !task.pinned })}
          >
            <Icon name="pin" size={19} filled={task.pinned} />
          </button>
          <button className="icon-btn" title="Edit" onClick={() => setEditing(!editing)}>
            <Icon name="pencil" size={18} />
          </button>
          <button
            className="icon-btn"
            title="Delete"
            onClick={() => {
              if (window.confirm("Delete this task?")) run("deleteTask", {});
            }}
          >
            <Icon name="trash" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function AddTaskForm({
  state,
  category,
  dueDate,
}: {
  state: AppState;
  category?: string;
  dueDate?: string;
}) {
  const invalidate = useInvalidate();
  const [title, setTitle] = useState("");
  const [cat, setCat] = useState(category ?? "general");
  const [priority, setPriority] = useState("medium");
  const [due, setDue] = useState(dueDate ?? "");
  const [assignee, setAssignee] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    setBusy(true);
    try {
      await callAction("addTask", {
        title: title.trim(),
        category: cat,
        priority,
        dueDate: due || null,
        assigneeMemberId: assignee ? Number(assignee) : null,
      });
      setTitle("");
      setDue(dueDate ?? "");
      invalidate();
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task…"
          style={{ flex: "1 1 220px" }}
        />
        <button className="btn" disabled={busy}>
          Add
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ flex: "1 1 120px" }}>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ flex: "1 1 110px" }}>
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label} priority
            </option>
          ))}
        </select>
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} style={{ flex: "1 1 140px" }} />
        <select value={assignee} onChange={(e) => setAssignee(e.target.value)} style={{ flex: "1 1 130px" }}>
          <option value="">Anyone</option>
          {state.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      <Err message={error} />
    </form>
  );
}

function TaskList({
  state,
  tasks,
  emptyText,
  emptyTitle,
  art,
  mineOnly,
}: {
  state: AppState;
  tasks: Task[];
  emptyText: string;
  emptyTitle?: string;
  art?: ArtVariant;
  mineOnly: boolean;
}) {
  const visible = useMemo(() => {
    if (!mineOnly) return tasks;
    return tasks.filter((t) => t.assigneeMemberId === state.viewer.id);
  }, [tasks, mineOnly, state.viewer.id]);
  if (!visible.length)
    return <EmptyState art={art ?? "leaf"} title={emptyTitle ?? "All clear"} message={emptyText} />;
  return (
    <div>
      {visible.map((t) => (
        <TaskRow key={t.id} task={t} state={state} />
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Today
function TodayView({
  state,
  mineOnly,
  onGoPackages,
  onGo,
}: {
  state: AppState;
  mineOnly: boolean;
  onGoPackages: () => void;
  onGo: (v: View) => void;
}) {
  const today = todayStr();
  const open = state.tasks.filter((t) => t.status === "open");
  const pinned = state.tasks.filter((t) => t.pinned && t.status === "open");
  const pinnedAll = state.tasks.filter((t) => t.pinned);
  const allTop3Done = pinnedAll.length > 0 && pinned.length === 0;
  const streak = computeStreak(state.tasks);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const startHere =
    pinned[0] ??
    open.filter((t) => t.dueDate && t.dueDate <= today).sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))[0] ??
    open.sort((a, b) => (a.priority === "high" ? -1 : 1))[0];
  const dueSoon = open
    .filter((t) => t.dueDate)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
    .slice(0, 5);
  const donePct =
    state.tasks.length === 0
      ? 0
      : Math.round((state.tasks.filter((t) => t.status === "done").length / state.tasks.length) * 100);

  return (
    <div>
      <div className="greeting">
        <span className="greeting-ico">
          <Icon name="sun" size={24} />
        </span>
        <div>
          <h1 style={{ margin: 0 }}>
            {greeting}, {state.viewer.name}
          </h1>
          <span className="greet-date">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </span>
        </div>
        {streak > 0 ? (
          <span className="streak-chip">
            <Icon name="flame" size={16} />
            {streak}-day streak
          </span>
        ) : (
          <span className="streak-chip streak-start">
            <Icon name="flame" size={16} />
            Start your streak
          </span>
        )}
      </div>

      {allTop3Done ? (
        <div className="celebrate">
          <span className="confetti-dot" style={{ left: "8%", top: "18%", background: "#e07856", animationDelay: "0s" }} />
          <span className="confetti-dot" style={{ left: "88%", top: "24%", background: "#c9a227", animationDelay: "0.5s" }} />
          <span className="confetti-dot" style={{ left: "16%", top: "72%", background: "#3f7d5c", animationDelay: "1s" }} />
          <span className="confetti-dot" style={{ left: "82%", top: "68%", background: "#e07856", animationDelay: "1.4s" }} />
          <span className="confetti-dot" style={{ left: "50%", top: "8%", background: "#c9a227", animationDelay: "0.8s" }} />
          <span className="celebrate-ico">
            <Icon name="sparkles" size={26} />
          </span>
          <div className="celebrate-title">Top 3 — all done!</div>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            That&apos;s the whole list. Take the win — tomorrow starts fresh.
          </p>
        </div>
      ) : null}

      {startHere ? (
        <div className="start-here start-here-hero">
          <small className="hero-eyebrow">Start here — your next step</small>
          <h2 style={{ marginTop: 4 }}>{startHere.title}</h2>
          <p style={{ margin: "4px 0 12px", opacity: 0.9 }}>
            {startHere.estMinutes ? `${startHere.estMinutes} minutes · ` : ""}
            {startHere.category}
            {startHere.dueDate ? ` · due ${fmtDate(startHere.dueDate)}` : ""}
          </p>
          <StartHereButton task={startHere} />
        </div>
      ) : (
        <div className="card">
          <EmptyState
            art="cloud"
            title="Nothing on the list yet"
            message="Start with a Brain Dump — get it all out of your head, then sort it into a plan."
          />
        </div>
      )}

      <div className="glance">
        <ProgressRing pct={donePct} />
        <div className="glance-stats">
          <div className="gstat">
            <div className="num">{state.stats.openCount}</div>
            <div className="lbl">Open tasks</div>
          </div>
          <div className="gstat">
            <div className="num">{state.stats.doneToday}</div>
            <div className="lbl">Done today</div>
          </div>
          <div className="gstat">
            <div className="num">{state.stats.doneThisWeek}</div>
            <div className="lbl">Done this week</div>
          </div>
          <div className="gstat">
            <div className="num">{state.stats.overdueCount}</div>
            <div className="lbl">Overdue</div>
          </div>
        </div>
      </div>

      <QuickActions onGo={onGo} />

      <div className="card">
        <h2>Your top 3 priorities</h2>
        <p className="muted">
          Pin tasks to keep them here. Tap the{" "}
          <span className="inline-ico">
            <Icon name="pin" size={14} />
          </span>{" "}
          on any task to pin it.
        </p>
        {pinned.length ? (
          pinned.map((t) => <TaskRow key={t.id} task={t} state={state} />)
        ) : (
          <EmptyState
            art="leaf"
            title="No pinned tasks yet"
            message="Tap the pin on any task to keep your top 3 here."
          />
        )}
      </div>

      <div className="card">
        <h2>Upcoming deadlines</h2>
        {dueSoon.length ? (
          dueSoon.map((t) => <TaskRow key={t.id} task={t} state={state} />)
        ) : (
          <EmptyState art="sun" title="No deadlines coming up" message="Nice — nothing pressing on the calendar." />
        )}
      </div>

      <AddTaskForm state={state} dueDate={today} />
      <div className="card">
        <h2>Today&apos;s tasks</h2>
        <TaskList
          state={state}
          tasks={open.filter((t) => !t.dueDate || t.dueDate <= today)}
          emptyText="Nothing due today."
          emptyTitle="A clear day"
          art="sun"
          mineOnly={mineOnly}
        />
      </div>
      {state.settings.planTier === "free" ? (
        <div className="card" style={{ textAlign: "center" }}>
          <h2>Want the rest?</h2>
          <p className="muted">
            Life Rescue, My Week, all sections, and both resets unlock with any Life Reset package.
          </p>
          <button className="btn" onClick={onGoPackages}>
            See packages
          </button>
        </div>
      ) : null}
    </div>
  );
}

function StartHereButton({ task }: { task: Task }) {
  const invalidate = useInvalidate();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        className="btn"
        onClick={async () => {
          setError(null);
          try {
            await callAction("setTaskStatus", { id: task.id, status: "done" });
            invalidate();
          } catch (e: any) {
            setError(e?.message || "Something went wrong.");
          }
        }}
      >
        Done — what&apos;s next?
      </button>
      {error ? <div className="error">{error}</div> : null}
    </div>
  );
}

// The three moves people come back for — one tap from Today.
function QuickActions({ onGo }: { onGo: (v: View) => void }) {
  const actions: { view: View; icon: IconName; title: string; desc: string }[] = [
    { view: "braindump", icon: "cloud", title: "Brain Dump", desc: "Get it all out of your head" },
    { view: "rescue", icon: "lifebuoy", title: "Life Rescue", desc: "Overwhelmed? Get a plan in minutes" },
    { view: "week", icon: "calendar", title: "My Week", desc: "See what's coming up" },
  ];
  return (
    <div className="quick-actions">
      {actions.map((a) => (
        <button key={a.view} className="quick-action" onClick={() => onGo(a.view)}>
          <span className="quick-action-ico">
            <Icon name={a.icon} size={24} />
          </span>
          <span className="quick-action-title">{a.title}</span>
          <span className="quick-action-desc">{a.desc}</span>
          <span className="quick-action-arrow">
            <Icon name="arrowRight" size={16} />
          </span>
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Brain Dump
function BrainDumpView({ state }: { state: AppState }) {
  const invalidate = useInvalidate();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sortingId, setSortingId] = useState<number | null>(null);
  const [suggestions, setSuggestions] = useState<SortSuggestion[] | null>(null);
  const [sortingDumpId, setSortingDumpId] = useState<number | null>(null);

  async function saveDump() {
    if (!text.trim()) return;
    setError(null);
    setBusy(true);
    try {
      await callAction("addBrainDump", { rawText: text.trim() });
      setText("");
      invalidate();
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function sortDump(dump: Dump) {
    setError(null);
    setSortingId(dump.id);
    try {
      const data = (await callAction("sortBrainDump", { id: dump.id })) as {
        suggestions: SortSuggestion[];
      };
      setSuggestions(data.suggestions);
      setSortingDumpId(dump.id);
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setSortingId(null);
    }
  }

  function updateSuggestion(i: number, patch: Partial<SortSuggestion>) {
    const cur = suggestions?.[i];
    if (!cur) return;
    const next = [...(suggestions ?? [])];
    next[i] = { ...cur, ...patch };
    setSuggestions(next);
  }

  async function confirm() {
    if (!suggestions || sortingDumpId === null) return;
    setError(null);
    setBusy(true);
    try {
      await callAction("confirmSortedTasks", { dumpId: sortingDumpId, tasks: suggestions });
      setSuggestions(null);
      setSortingDumpId(null);
      invalidate();
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Brain Dump</h1>
      <p className="muted">
        Get everything out of your head. No sorting, no organizing yet — just dump it here.
      </p>
      <div className="card">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Everything on your mind… bills, calls, permission slips, the plumber, all of it."
          rows={5}
        />
        <div style={{ marginTop: 10 }}>
          <button className="btn" onClick={saveDump} disabled={busy || !text.trim()}>
            Save this dump
          </button>
        </div>
        <Err message={error} />
      </div>

      {suggestions && sortingDumpId !== null ? (
        <div className="card">
          <h2>Here&apos;s how it sorts out</h2>
          <p className="muted">Check it over, fix anything, then save. Nothing is final until you say so.</p>
          {suggestions.map((s, i) => (
            <div key={i} style={{ borderBottom: "1px solid var(--line)", padding: "10px 0" }}>
              <input
                value={s.title}
                onChange={(e) => updateSuggestion(i, { title: e.target.value })}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                <select
                  value={s.category}
                  onChange={(e) => updateSuggestion(i, { category: e.target.value })}
                  style={{ flex: "1 1 120px" }}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <select
                  value={s.priority}
                  onChange={(e) => updateSuggestion(i, { priority: e.target.value })}
                  style={{ flex: "1 1 110px" }}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={s.estMinutes ?? ""}
                  placeholder="Minutes"
                  onChange={(e) =>
                    updateSuggestion(i, { estMinutes: e.target.value ? Number(e.target.value) : null })
                  }
                  style={{ flex: "1 1 90px" }}
                />
                <input
                  value={s.waitingOn ?? ""}
                  placeholder="Waiting on…"
                  onChange={(e) => updateSuggestion(i, { waitingOn: e.target.value || null })}
                  style={{ flex: "1 1 130px" }}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSuggestions(suggestions.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn" onClick={confirm} disabled={busy || suggestions.length === 0}>
              Save these tasks
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setSuggestions(null);
                setSortingDumpId(null);
              }}
            >
              Discard
            </button>
          </div>
        </div>
      ) : null}

      <div className="card">
        <h2>Your dumps</h2>
        {state.dumps.length === 0 ? (
          <EmptyState art="cloud" title="No dumps yet" message="Dump everything on your mind — no sorting yet." />
        ) : (
          state.dumps.map((d) => (
            <div key={d.id} style={{ borderBottom: "1px solid var(--line)", padding: "12px 0" }}>
              <div style={{ whiteSpace: "pre-wrap" }}>{d.rawText}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span className="chip">
                  {d.status === "sorted" ? (
                    <>
                      <Icon name="check" size={13} /> Sorted
                    </>
                  ) : (
                    "Unsorted"
                  )}
                </span>
                <span className="muted">{new Date(d.createdAt).toLocaleDateString()}</span>
                {d.status !== "sorted" ? (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => sortDump(d)}
                    disabled={sortingId === d.id}
                  >
                    {sortingId === d.id ? "Sorting…" : "Sort this dump"}
                  </button>
                ) : null}
                <button
                  className="btn-ghost btn-sm"
                  onClick={async () => {
                    if (!window.confirm("Delete this dump?")) return;
                    await callAction("deleteBrainDump", { id: d.id });
                    invalidate();
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Life Rescue
const RESCUE_TIMES = [5, 10, 20, 30, 60, 120];

function LifeRescueView({ state }: { state: AppState }) {
  const [minutes, setMinutes] = useState<number | null>(20);
  const [energy, setEnergy] = useState("low");
  const [whats, setWhats] = useState("");
  const [plan, setPlan] = useState<RescuePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function build() {
    setError(null);
    setBusy(true);
    try {
      const data = (await callAction("lifeRescue", {
        minutesAvailable: minutes,
        energy,
        whatsHappening: whats,
      })) as RescuePlan;
      setPlan(data);
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Life Rescue</h1>
      <p className="muted">
        The day went sideways. Tell us how much time and energy you&apos;ve got, and we&apos;ll make
        a short plan — with a clear first step.
      </p>
      <div className="card">
        <label>How much time do you have?</label>
        <div className="time-chips">
          {RESCUE_TIMES.map((m) => (
            <button key={m} className={minutes === m ? "active" : ""} onClick={() => setMinutes(m)}>
              {m >= 60 ? `${m / 60} hr` : `${m} min`}
            </button>
          ))}
          <button className={minutes === null ? "active" : ""} onClick={() => setMinutes(null)}>
            Flexible
          </button>
        </div>
        <label>How&apos;s your energy?</label>
        <div className="energy-chips">
          {(["low", "medium", "high"] as const).map((e) => (
            <button key={e} className={energy === e ? "active" : ""} onClick={() => setEnergy(e)}>
              {e === "low" ? (
                <>
                  <Icon name="battery" size={16} /> Low
                </>
              ) : e === "medium" ? (
                "Medium"
              ) : (
                <>
                  <Icon name="zap" size={16} /> High
                </>
              )}
            </button>
          ))}
        </div>
        <label>What&apos;s happening? (optional)</label>
        <textarea
          value={whats}
          onChange={(e) => setWhats(e.target.value)}
          rows={3}
          placeholder="The kids are home sick, the electric bill is due, and I have no idea where to start…"
        />
        <div style={{ marginTop: 14 }}>
          <button className="btn" onClick={build} disabled={busy}>
            {busy ? "Building your plan…" : "Build my rescue plan"}
          </button>
        </div>
        <Err message={error} />
      </div>

      {plan ? (
        <div className="card">
          <h2>Your rescue plan</h2>
          <div className="start-here">
            <small className="hero-eyebrow">Do this first</small>
            <h2 style={{ marginTop: 4 }}>{plan.firstStep.title}</h2>
            <p style={{ margin: 0, opacity: 0.9 }}>{plan.firstStep.minutes} minutes</p>
          </div>
          {plan.steps.length ? (
            <>
              <h3>Then</h3>
              {plan.steps.map((s, i) => (
                <div key={i} className="plan-step">
                  <span className="step-num">{i + 2}</span>
                  <div>
                    <div className="task-title">{s.title}</div>
                    <div className="task-meta">{s.minutes} minutes</div>
                  </div>
                </div>
              ))}
            </>
          ) : null}
          {plan.canWait.length ? (
            <>
              <h3 style={{ marginTop: 16 }}>Can wait</h3>
              {plan.canWait.map((s, i) => (
                <div key={i} className="task-meta" style={{ padding: "4px 0" }}>
                  • {s.title}
                </div>
              ))}
            </>
          ) : null}
          <p style={{ marginTop: 16, fontStyle: "italic" }}>{plan.closingLine}</p>
        </div>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ My Week
function MyWeekView({ state, mineOnly }: { state: AppState; mineOnly: boolean }) {
  const days: string[] = [];
  for (let i = 0; i < 7; i++) days.push(todayStr(i));
  const byDay = new Map<string, Task[]>();
  for (const d of days) byDay.set(d, []);
  const noDate: Task[] = [];
  for (const t of state.tasks.filter((t) => t.status === "open")) {
    if (mineOnly && t.assigneeMemberId !== state.viewer.id) continue;
    if (t.dueDate && byDay.has(t.dueDate)) byDay.get(t.dueDate)!.push(t);
    else if (!t.dueDate) noDate.push(t);
  }
  return (
    <div>
      <h1>My Week</h1>
      <p className="muted">What&apos;s due this week, day by day.</p>
      {days.map((d) => {
        const list = byDay.get(d)!;
        if (!list.length) return null;
        return (
          <div key={d} className="card">
            <h2>
              {d === todayStr() ? "Today" : fmtDate(d)} · {d}
            </h2>
            {list.map((t) => (
              <TaskRow key={t.id} task={t} state={state} />
            ))}
          </div>
        );
      })}
      {noDate.length ? (
        <div className="card">
          <h2>No due date yet</h2>
          {noDate.map((t) => (
            <TaskRow key={t.id} task={t} state={state} />
          ))}
        </div>
      ) : null}
      <AddTaskForm state={state} />
    </div>
  );
}

// ------------------------------------------------------------------ Section views
function SectionView({
  state,
  mineOnly,
  category,
  title,
  blurb,
}: {
  state: AppState;
  mineOnly: boolean;
  category: string;
  title: string;
  blurb: string;
}) {
  const tasks = state.tasks.filter((t) => t.category === category);
  const open = tasks.filter((t) => t.status === "open");
  const done = tasks.filter((t) => t.status === "done");
  return (
    <div>
      <h1>{title}</h1>
      <p className="muted">{blurb}</p>
      <AddTaskForm state={state} category={category} />
      <div className="card">
        <h2>To do</h2>
        <TaskList state={state} tasks={open} emptyText="Nothing here. Nice and clear." mineOnly={mineOnly} />
      </div>
      {done.length ? (
        <div className="card">
          <h2>Done</h2>
          <TaskList state={state} tasks={done} emptyText="" mineOnly={mineOnly} />
        </div>
      ) : null}
    </div>
  );
}

function MoneyView({ state, mineOnly }: { state: AppState; mineOnly: boolean }) {
  const invalidate = useInvalidate();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const unpaid = state.bills.filter((b) => !b.paid);
  const paid = state.bills.filter((b) => b.paid);
  const unpaidTotal = unpaid.reduce((s, b) => s + (b.amountCents ?? 0), 0);
  const paidTotal = paid.reduce((s, b) => s + (b.amountCents ?? 0), 0);

  async function addBill() {
    if (!name.trim()) return;
    setError(null);
    try {
      await callAction("addBill", {
        name: name.trim(),
        amountCents: amount ? Math.round(Number(amount) * 100) : null,
        dueDate: due || null,
      });
      setName("");
      setAmount("");
      setDue("");
      invalidate();
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    }
  }

  return (
    <div>
      <h1>My Money</h1>
      <p className="muted">Bills in one place — what&apos;s due, what&apos;s paid, what&apos;s left.</p>
      <div className="stat-grid">
        <div className="stat">
          <div className="num">{money(unpaidTotal)}</div>
          <div className="lbl">Still to pay</div>
        </div>
        <div className="stat">
          <div className="num">{money(paidTotal)}</div>
          <div className="lbl">Paid</div>
        </div>
        <div className="stat">
          <div className="num">{unpaid.length}</div>
          <div className="lbl">Unpaid bills</div>
        </div>
        <div className="stat">
          <div className="num">{state.bills.length}</div>
          <div className="lbl">Total bills</div>
        </div>
      </div>
      <div className="card">
        <h2>Add a bill</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bill name" style={{ flex: "2 1 160px" }} />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount $"
            inputMode="decimal"
            style={{ flex: "1 1 100px" }}
          />
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} style={{ flex: "1 1 140px" }} />
          <button className="btn" onClick={addBill}>
            Add
          </button>
        </div>
        <Err message={error} />
      </div>
      <div className="card">
        <h2>To pay</h2>
        {unpaid.length === 0 ? (
          <EmptyState art="sun" title="All paid up" message="Nothing unpaid right now." />
        ) : (
          unpaid.map((b) => (
            <BillRow key={b.id} bill={b} />
          ))
        )}
      </div>
      {paid.length ? (
        <div className="card">
          <h2>Paid</h2>
          {paid.map((b) => (
            <BillRow key={b.id} bill={b} />
          ))}
        </div>
      ) : null}
      <SectionView state={state} mineOnly={mineOnly} category="money" title="Money tasks" blurb="Money-related tasks — calls, forms, budgets." />
    </div>
  );
}

function BillRow({ bill }: { bill: Bill }) {
  const invalidate = useInvalidate();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <div className={`task-row ${bill.paid ? "done" : ""}`}>
        <button
          className="check"
          aria-label={bill.paid ? "Mark unpaid" : "Mark paid"}
          onClick={async () => {
            try {
              await callAction("setBillPaid", { id: bill.id, paid: !bill.paid });
              invalidate();
            } catch (e: any) {
              setError(e?.message || "Something went wrong.");
            }
          }}
        >
          <svg className="check-svg" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </button>
        <div style={{ minWidth: 0 }}>
          <div className="task-title" style={bill.paid ? { textDecoration: "line-through", color: "var(--muted)" } : undefined}>
            {bill.name}
          </div>
          <div className="task-meta">
            {money(bill.amountCents)}
            {bill.dueDate ? ` · due ${fmtDate(bill.dueDate)}` : ""}
          </div>
          {error ? <div className="error">{error}</div> : null}
        </div>
        <div className="task-actions">
          <button
            className="icon-btn"
            title="Delete"
            onClick={async () => {
              if (!window.confirm("Delete this bill?")) return;
              await callAction("deleteBill", { id: bill.id });
              invalidate();
            }}
          >
            <Icon name="trash" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function FamilyView({ state, mineOnly }: { state: AppState; mineOnly: boolean }) {
  const invalidate = useInvalidate();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <h1>My Family</h1>
      <p className="muted">Everyone in the household, and what each person has on their plate.</p>
      <div className="card">
        <h2>Household members</h2>
        {state.members.map((m) => {
          const mine = state.tasks.filter((t) => t.assigneeMemberId === m.id && t.status === "open");
          return (
            <div key={m.id} style={{ borderBottom: "1px solid var(--line)", padding: "10px 0" }}>
              <div className="task-title">
                {m.name} {m.role === "admin" ? <span className="chip">Admin</span> : null}
              </div>
              <div className="task-meta">
                {m.username ? `@${m.username}` : "No login yet"} · {mine.length} open task{mine.length === 1 ? "" : "s"}
              </div>
            </div>
          );
        })}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a family member by name" />
          <button
            className="btn"
            onClick={async () => {
              if (!name.trim()) return;
              setError(null);
              try {
                await callAction("addMember", { name: name.trim() });
                setName("");
                invalidate();
              } catch (e: any) {
                setError(e?.message || "Something went wrong.");
              }
            }}
          >
            Add
          </button>
        </div>
        <Err message={error} />
        <p className="muted" style={{ marginTop: 10 }}>
          Logins and the join code live under Household settings.
        </p>
      </div>
      <SectionView state={state} mineOnly={mineOnly} category="family" title="Family tasks" blurb="Tasks that involve the whole family." />
    </div>
  );
}

function PendingView({ state, mineOnly }: { state: AppState; mineOnly: boolean }) {
  const tasks = state.tasks.filter((t) => t.category === "pending" || t.waitingOn);
  return (
    <div>
      <h1>Pending</h1>
      <p className="muted">Things waiting on someone — or something — else.</p>
      <div className="card">
        <TaskList
          state={state}
          tasks={tasks.filter((t) => t.status === "open")}
          emptyText="Nothing waiting. Nice."
          emptyTitle="Nothing waiting"
          art="clock"
          mineOnly={mineOnly}
        />
      </div>
      <AddTaskForm state={state} category="pending" />
    </div>
  );
}

// ------------------------------------------------------------------ Reset My Day
function ResetDayView({ state }: { state: AppState }) {
  const invalidate = useInvalidate();
  const [note, setNote] = useState("");
  const [plan, setPlan] = useState<DayResetPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);

  async function build() {
    setError(null);
    setBusy(true);
    setApplied(false);
    try {
      const data = (await callAction("resetMyDay", { note })) as DayResetPlan;
      setPlan(data);
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!plan) return;
    setError(null);
    setBusy(true);
    try {
      await callAction("applyDayReset", {
        taskIds: plan.move.map((m) => m.id),
        dueDate: todayStr(1),
      });
      setApplied(true);
      invalidate();
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const taskById = new Map(state.tasks.map((t) => [t.id, t]));

  return (
    <div>
      <h1>Reset My Day</h1>
      <p className="muted">
        The day went sideways. We&apos;ll keep what still matters today and move the rest to tomorrow.
      </p>
      <div className="card">
        <label>What happened? (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Soccer ran late, the meeting moved, and now everything feels behind…"
        />
        <div style={{ marginTop: 12 }}>
          <button className="btn" onClick={build} disabled={busy}>
            {busy ? "Rebuilding…" : "Rebuild my day"}
          </button>
        </div>
        <Err message={error} />
      </div>
      {plan ? (
        <div className="card">
          <h2>Your new plan</h2>
          <p className="muted">{plan.note}</p>
          <h3>Keep today</h3>
          {plan.keep.length === 0 ? (
            <EmptyState art="leaf" title="Nothing kept" message="A clean slate for today." />
          ) : (
            plan.keep.map((k) => (
              <div key={k.id} className="plan-step">
                <span className="step-num">
                  <Icon name="check" size={16} />
                </span>
                <div>
                  <div className="task-title">{taskById.get(k.id)?.title ?? `Task ${k.id}`}</div>
                  <div className="task-meta">{k.reason}</div>
                </div>
              </div>
            ))
          )}
          <h3 style={{ marginTop: 16 }}>Move to tomorrow</h3>
          {plan.move.length === 0 ? (
            <p className="muted">Nothing to move.</p>
          ) : (
            plan.move.map((m) => (
              <div key={m.id} className="plan-step">
                <span className="step-num" style={{ background: "var(--sage)" }}>
                  <Icon name="arrowRight" size={16} />
                </span>
                <div>
                  <div className="task-title">{taskById.get(m.id)?.title ?? `Task ${m.id}`}</div>
                  <div className="task-meta">{m.reason}</div>
                </div>
              </div>
            ))
          )}
          {applied ? (
            <div className="success">Done — those tasks are moved to tomorrow.</div>
          ) : (
            <div style={{ marginTop: 14 }}>
              <button className="btn" onClick={apply} disabled={busy}>
                Apply this plan
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ Weekly Reset
function WeeklyResetView({ state }: { state: AppState }) {
  const invalidate = useInvalidate();
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const today = todayStr();
  const doneThisWeek = state.tasks.filter((t) => t.status === "done");
  const stale = state.tasks.filter((t) => t.status === "open" && t.dueDate && t.dueDate < today);
  const open = state.tasks.filter((t) => t.status === "open");

  async function run(action: string, args: Record<string, unknown>) {
    setError(null);
    try {
      await callAction(action, args);
      invalidate();
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    }
  }

  return (
    <div>
      <h1>Weekly Reset</h1>
      <p className="muted">Look back, clear what&apos;s stale, and pick next week&apos;s top 3.</p>
      <div className="card">
        <h2>This week, you finished {state.stats.doneThisWeek}</h2>
        {doneThisWeek.length ? (
          doneThisWeek.slice(0, 10).map((t) => (
            <div key={t.id} className="done-line">
              <Icon name="check" size={15} />
              <span className="task-meta" style={{ marginTop: 0 }}>
                {t.title}
              </span>
            </div>
          ))
        ) : (
          <EmptyState
            art="sun"
            title="Nothing finished yet this week"
            message="That's okay — fresh week ahead."
          />
        )}
      </div>
      <div className="card">
        <h2>Stale tasks ({stale.length})</h2>
        <p className="muted">Overdue and still open. Move them to next week or let them go.</p>
        {stale.length === 0 ? (
          <EmptyState art="leaf" title="Nothing stale" message="Overdue and still open — none right now." />
        ) : (
          stale.map((t) => (
            <div key={t.id} className="task-row">
              <div style={{ minWidth: 0 }}>
                <div className="task-title">{t.title}</div>
                <div className="task-meta">due {fmtDate(t.dueDate)}</div>
              </div>
              <div className="task-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => run("applyDayReset", { taskIds: [t.id], dueDate: todayStr(7) })}>
                  Next week
                </button>
                <button
                  className="btn-ghost btn-sm"
                  onClick={() => {
                    if (window.confirm("Delete this task?")) run("deleteTask", { id: t.id });
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="card">
        <h2>Next week&apos;s top 3</h2>
        <p className="muted">Pick up to 3 tasks to pin as next week&apos;s priorities.</p>
        {open.map((t) => (
          <label key={t.id} style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400, margin: "8px 0" }}>
            <input
              type="checkbox"
              style={{ width: "auto" }}
              checked={picked.includes(t.id)}
              onChange={(e) => {
                if (e.target.checked) setPicked([...picked, t.id].slice(0, 3));
                else setPicked(picked.filter((x) => x !== t.id));
              }}
              disabled={!picked.includes(t.id) && picked.length >= 3}
            />
            {t.title}
          </label>
        ))}
        <button
          className="btn"
          disabled={picked.length === 0}
          onClick={() => run("setTopPriorities", { ids: picked })}
        >
          Set as top 3
        </button>
        <Err message={error} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Packages
const PACKAGES: {
  tier: PlanTier;
  name: string;
  price: string;
  blurb: string;
  features: string[];
  urlKey: "squareEssentialsUrl" | "squareCompleteUrl" | "squareVipUrl";
  featured?: boolean;
}[] = [
  {
    tier: "essentials",
    name: "Essentials",
    price: "$297",
    blurb: "The starter organization system.",
    features: [
      "Full Life Reset app — every section unlocked",
      "Brain Dump + smart sorting",
      "Life Rescue and both resets",
      "My Week, Home, Money, Family, Myself, Pending",
    ],
    urlKey: "squareEssentialsUrl",
  },
  {
    tier: "complete",
    name: "Complete",
    price: "$997",
    blurb: "A personal reset, done with you.",
    features: [
      "Everything in Essentials",
      "Personal intake and life inventory",
      "Custom dashboard and categories",
      "Prioritized task and deadline map",
      "Personalized 7-day rescue plan",
      "Home, family, work, and bill framework",
      "30 days of support",
    ],
    urlKey: "squareCompleteUrl",
    featured: true,
  },
  {
    tier: "vip",
    name: "VIP",
    price: "$1,997",
    blurb: "The full overhaul, with us beside you.",
    features: [
      "Everything in Complete",
      "Expanded personalization",
      "90 days of support",
      "Defined boundaries, so the reset sticks",
    ],
    urlKey: "squareVipUrl",
  },
];

function PackagesView({ state }: { state: AppState }) {
  const invalidate = useInvalidate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const current = state.settings.planTier;

  async function redeem() {
    if (!code.trim()) return;
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const data = (await callAction("redeemUnlockCode", { code: code.trim() })) as {
        planTier: PlanTier;
      };
      setSuccess(`Unlocked! Your household is now on ${data.planTier}.`);
      setCode("");
      invalidate();
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Packages</h1>
      <p className="muted">
        {current === "free"
          ? "One-time payment, no subscription — pick the level of support that's right for your family."
          : `You're on ${current}.`}
      </p>
      <div className="tier-strip">
        <span className="eyebrow">Included in every package</span>
        <div className="tier-strip-items">
          <span className="done-line">
            <Icon name="check" size={14} /> Every section unlocked
          </span>
          <span className="done-line">
            <Icon name="check" size={14} /> Brain Dump + smart sorting
          </span>
          <span className="done-line">
            <Icon name="check" size={14} /> Life Rescue + both resets
          </span>
          <span className="done-line">
            <Icon name="check" size={14} /> Your whole household
          </span>
        </div>
      </div>
      <div className="price-cards">
        {PACKAGES.map((p) => {
          const url = state.settings[p.urlKey];
          const isCurrent = current === p.tier;
          return (
            <div key={p.tier} className={`price-card ${p.featured ? "featured" : ""}`}>
              {p.featured ? <span className="featured-badge">Most popular</span> : null}
              <h2 style={{ marginBottom: 2 }}>{p.name}</h2>
              <div className="price">{p.price}</div>
              <p className="muted">one-time</p>
              <p>{p.blurb}</p>
              <ul>
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              {isCurrent ? (
                <span className="chip chip-paid">
                  <Icon name="check" size={13} /> Your plan
                </span>
              ) : url ? (
                <a className="btn" href={url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                  Buy {p.name} — {p.price}
                </a>
              ) : (
                <button className="btn" disabled>
                  Checkout link coming soon
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="assurance-row">
        Secure checkout via Square · Your unlock code arrives by email · Questions?{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
      <div className="card" style={{ marginTop: 16 }}>
        <h2>Already paid? Redeem your code</h2>
        <p className="muted">
          Your unlock code arrives by email right after checkout. Three quick steps and
          you&apos;re in:
        </p>
        <ol className="redeem-steps">
          <li>Check your email for your one-time unlock code.</li>
          <li>Paste it below and tap Unlock my plan.</li>
          <li>Your plan flips on instantly — everything unlocks.</li>
        </ol>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. LR-ABCD-1234"
            style={{ flex: "1 1 200px" }}
          />
          <button className="btn" onClick={redeem} disabled={busy || !code.trim()}>
            Unlock my plan
          </button>
        </div>
        <Err message={error} />
        {success ? <div className="success">{success}</div> : null}
        <p className="muted" style={{ marginTop: 10 }}>
          Codes are single-use and tied to your household. No code yet, or it doesn&apos;t
          work? Write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and
          we&apos;ll sort it out.
        </p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Household
function HouseholdView({ state }: { state: AppState }) {
  const invalidate = useInvalidate();
  const qc = useQueryClient();
  const viewer = state.viewer;
  const isAdmin = viewer.role === "admin";
  const isSeller = state.settings.isSeller;
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [householdName, setHouseholdName] = useState(state.settings.householdName);
  const [joinCode, setJoinCode] = useState(state.settings.joinCode ?? "");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [loginForms, setLoginForms] = useState<Record<number, { username: string; pin: string }>>({});
  const [codeTier, setCodeTier] = useState("essentials");
  const [codeNote, setCodeNote] = useState("");
  const [busy, setBusy] = useState(false);

  const codesQuery = useQuery({
    queryKey: ["unlockcodes"],
    queryFn: () => callAction<{ codes: UnlockCode[] }>("listUnlockCodes"),
    enabled: isSeller && isAdmin,
  });

  async function run(action: string, args: Record<string, unknown>, msg?: string) {
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      const data = (await callAction(action, args)) as any;
      if (msg) setSuccess(msg);
      invalidate();
      return data;
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Household</h1>
      <p className="muted">
        {state.settings.householdName} · {state.settings.planTier} plan · signed in as {viewer.name}
        {isAdmin ? " (admin)" : ""}
      </p>

      <div className="card">
        <h2>Your plan</h2>
        <p>
          <span className={`chip ${state.settings.planTier === "free" ? "chip-free" : "chip-paid"}`}>
            {state.settings.planTier}
          </span>
        </p>
        {state.settings.planTier === "free" ? (
          <p className="muted">Unlock a paid plan from Packages with your unlock code after checkout.</p>
        ) : null}
      </div>

      {isAdmin ? (
        <div className="card">
          <h2>Household name</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={householdName} onChange={(e) => setHouseholdName(e.target.value)} />
            <button
              className="btn"
              onClick={() => run("updateHousehold", { householdName }, "Household name saved.")}
              disabled={busy}
            >
              Save
            </button>
          </div>
        </div>
      ) : null}

      <div className="card">
        <h2>Family members</h2>
        {state.members.map((m: Member) => {
          const form = loginForms[m.id] ?? { username: m.username ?? "", pin: "" };
          return (
            <div key={m.id} style={{ borderBottom: "1px solid var(--line)", padding: "12px 0" }}>
              <div className="task-title">
                {m.name} {m.role === "admin" ? <span className="chip">Admin</span> : null}
              </div>
              <div className="task-meta">
                {m.username ? `@${m.username} · login on` : "No login yet"}
              </div>
              {isAdmin && m.id !== viewer.id ? (
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <input
                    value={form.username}
                    onChange={(e) =>
                      setLoginForms({ ...loginForms, [m.id]: { ...form, username: e.target.value } })
                    }
                    placeholder="Username"
                    style={{ flex: "1 1 120px" }}
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    value={form.pin}
                    onChange={(e) =>
                      setLoginForms({ ...loginForms, [m.id]: { ...form, pin: e.target.value } })
                    }
                    placeholder="PIN (4–12)"
                    style={{ flex: "1 1 110px" }}
                  />
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      run(
                        "setMemberLogin",
                        { memberId: m.id, username: form.username, ...(form.pin ? { pin: form.pin } : {}) },
                        `Login saved for ${m.name}.`
                      )
                    }
                  >
                    {m.hasLogin ? "Update login" : "Set login"}
                  </button>
                  {m.hasLogin ? (
                    <button
                      className="btn-ghost btn-sm"
                      onClick={() => {
                        if (window.confirm(`Remove ${m.name}'s login? They'll be signed out everywhere.`))
                          run("removeMemberLogin", { memberId: m.id }, `${m.name}'s login removed.`);
                      }}
                    >
                      Remove login
                    </button>
                  ) : null}
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => {
                      if (window.confirm(`Remove ${m.name} from the household?`))
                        run("deleteMember", { id: m.id }, `${m.name} removed.`);
                    }}
                  >
                    Remove member
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {isAdmin ? (
        <div className="card">
          <h2>Join code</h2>
          <p className="muted">
            Family members open the app on their own phone, tap Join, and enter this code.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="e.g. MAPLE-42"
              style={{ flex: "1 1 160px" }}
            />
            <button
              className="btn"
              onClick={() => run("setJoinCode", { joinCode }, "Join code saved.")}
              disabled={busy}
            >
              Save code
            </button>
            {state.settings.joinCode ? (
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setJoinCode("");
                  run("setJoinCode", { joinCode: "" }, "Join code cleared.");
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="card">
        <h2>Change my PIN</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            type="password"
            inputMode="numeric"
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value)}
            placeholder="Current PIN"
            style={{ flex: "1 1 130px" }}
          />
          <input
            type="password"
            inputMode="numeric"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            placeholder="New PIN"
            style={{ flex: "1 1 130px" }}
          />
          <button
            className="btn"
            onClick={async () => {
              const ok = await run("changeMyPin", { currentPin, newPin }, "PIN changed.");
              if (ok) {
                setCurrentPin("");
                setNewPin("");
              }
            }}
            disabled={busy}
          >
            Change PIN
          </button>
        </div>
      </div>

      {isSeller && isAdmin ? (
        <div className="card">
          <h2>Buyer unlock codes</h2>
          <p className="muted">
            After a Square payment comes in, make a one-time code for the package bought and send it
            to the buyer. They enter it under Packages.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={codeTier} onChange={(e) => setCodeTier(e.target.value)} style={{ flex: "1 1 130px" }}>
              <option value="essentials">Essentials — $297</option>
              <option value="complete">Complete — $997</option>
              <option value="vip">VIP — $1,997</option>
            </select>
            <input
              value={codeNote}
              onChange={(e) => setCodeNote(e.target.value)}
              placeholder="Who is it for? (optional)"
              style={{ flex: "2 1 160px" }}
            />
            <button
              className="btn"
              onClick={async () => {
                const data = (await run("createUnlockCode", { tier: codeTier, note: codeNote || undefined })) as {
                  code?: string;
                } | null;
                if (data?.code) {
                  setSuccess(`Code created: ${data.code} — send it to the buyer.`);
                  setCodeNote("");
                  qc.invalidateQueries({ queryKey: ["unlockcodes"] });
                }
              }}
              disabled={busy}
            >
              Create code
            </button>
          </div>
          {codesQuery.data?.codes.length ? (
            <div style={{ marginTop: 12 }}>
              {codesQuery.data.codes.map((c) => (
                <div key={c.id} style={{ borderBottom: "1px solid var(--line)", padding: "8px 0" }}>
                  <div className="task-title">
                    {c.code} <span className="chip">{c.tier}</span>{" "}
                    {c.redeemed ? (
                      <span className="tag">
                        <Icon name="check" size={12} /> Used
                      </span>
                    ) : (
                      <span className="tag">Unused</span>
                    )}
                  </div>
                  <div className="task-meta">
                    {c.note ? `${c.note} · ` : ""}
                    {c.redeemed
                      ? `Redeemed by ${c.redeemedByHouseholdName ?? "a household"}${c.redeemedAt ? ` on ${new Date(c.redeemedAt).toLocaleDateString()}` : ""}`
                      : `Created ${new Date(c.createdAt).toLocaleDateString()}`}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted" style={{ marginTop: 10 }}>
              No codes yet.
            </p>
          )}
        </div>
      ) : null}

      <Err message={error} />
      {success ? <div className="success">{success}</div> : null}

      <div className="card">
        <button
          className="btn btn-secondary"
          onClick={async () => {
            await callAction("logout", {});
            analytics.resetIdentity();
            setToken(null);
            invalidate();
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Help
function HelpView() {
  return (
    <div>
      <h1>Help</h1>
      <p className="muted">Stuck on something? We&apos;re here.</p>
      <div className="card" style={{ textAlign: "center" }}>
        <h2>Email us</h2>
        <p className="muted">Tell us what&apos;s happening and what you were trying to do.</p>
        <a className="btn" href={`mailto:${SUPPORT_EMAIL}`} style={{ textDecoration: "none" }}>
          {SUPPORT_EMAIL}
        </a>
        <p className="muted" style={{ marginTop: 12 }}>
          What helps: your household name, what screen you were on, and what happened.
        </p>
      </div>
      <div className="card">
        <h2>Quick answers</h2>
        <h3>Forgot your PIN?</h3>
        <p className="muted">
          On the sign-in screen, tap &quot;Forgot PIN?&quot; Enter your username and your
          household&apos;s join code, then pick a new PIN. Your other devices will be signed out.
        </p>
        <h3>Joining on a new phone?</h3>
        <p className="muted">
          Open the app, tap Join, and enter your household&apos;s join code — ask your household
          admin for it. Then pick your own username and PIN.
        </p>
        <h3>Save the app to your phone</h3>
        <p className="muted">
          iPhone: open the link in Safari, tap Share, then &quot;Add to Home Screen.&quot;
          Android: open the link in Chrome, tap the three dots, then &quot;Add to Home screen.&quot;
        </p>
        <h3>Package or payment questions</h3>
        <p className="muted">
          Email us at {SUPPORT_EMAIL}. After checkout you&apos;ll get a one-time unlock code — enter
          it under Packages, &quot;Already paid?&quot;, and your plan flips on.
        </p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ App shell
export default function App() {
  const auth = useAuthState();
  const [view, setView] = useState<View>("today");
  const [mineOnly, setMineOnly] = useState(false);

  if (auth.isPending) {
    return (
      <div className="auth-wrap">
        <p className="muted">Loading Life Reset…</p>
      </div>
    );
  }
  if (!auth.data?.currentMember) {
    return <AuthScreen />;
  }

  return <AuthedApp view={view} setView={setView} mineOnly={mineOnly} setMineOnly={setMineOnly} />;
}

function WelcomeOverlay({ onStart, onDismiss }: { onStart: () => void; onDismiss: () => void }) {
  return (
    <div className="welcome-overlay" role="dialog" aria-label="Welcome to Life Reset">
      <div className="card welcome-card">
        <span className="welcome-mark">
          <LogoMark size={44} />
        </span>
        <span className="eyebrow">Welcome to Life Reset</span>
        <h2 style={{ fontSize: 26 }}>Get your life back.</h2>
        <p className="muted">
          Life Reset turns the chaos in your head into one calm, clear plan — for your whole
          household.
        </p>
        <div className="welcome-step">
          <span className="step-num">1</span>
          <div>
            <strong>Start with a Brain Dump.</strong>
            <p className="muted" style={{ margin: "2px 0 0" }}>
              Get it all out — it takes two minutes — and we&apos;ll help you sort it into a
              plan.
            </p>
          </div>
        </div>
        <button className="btn" onClick={onStart} style={{ width: "100%" }}>
          Start my Brain Dump
        </button>
        <button className="btn btn-ghost" onClick={onDismiss} style={{ width: "100%" }}>
          Take a look around first
        </button>
      </div>
    </div>
  );
}

function AuthedApp({
  view,
  setView,
  mineOnly,
  setMineOnly,
}: {
  view: View;
  setView: (v: View) => void;
  mineOnly: boolean;
  setMineOnly: (b: boolean) => void;
}) {
  const app = useAppState();
  const [showWelcome, setShowWelcome] = useState(true);

  // HeyCatch identity: attach this member (stable id) + current plan whenever
  // the signed-in viewer or the plan changes. Runs once per change, not per render.
  const viewerId = app.data?.viewer.id;
  const viewerName = app.data?.viewer.name;
  const planTier = app.data?.settings.planTier;
  useEffect(() => {
    if (!viewerId) return;
    analytics.setIdentity(`member-${viewerId}`, { name: viewerName, plan: planTier });
  }, [viewerId, viewerName, planTier]);

  if (app.isPending) {
    return (
      <div className="auth-wrap">
        <p className="muted">Loading your household…</p>
      </div>
    );
  }
  if (app.isError || !app.data) {
    return (
      <div className="auth-wrap">
        <div className="card auth-card">
          <h2>Couldn&apos;t load your household</h2>
          <p className="muted">{(app.error as any)?.message || "Something went wrong."}</p>
          <button
            className="btn"
            onClick={() => {
              setToken(null);
              window.location.reload();
            }}
          >
            Sign out and try again
          </button>
        </div>
      </div>
    );
  }

  const state = app.data;
  const isFree = state.settings.planTier === "free";
  const isAdmin = state.viewer.role === "admin";
  const goPackages = () => setView("packages");
  // Brand-new household: nothing created yet — show the one-screen welcome.
  const isNewHousehold =
    state.tasks.length === 0 && state.dumps.length === 0 && state.bills.length === 0;

  let content: React.ReactNode;
  if (isFree && LOCKED_VIEWS.includes(view)) {
    content = <LockedScreen onGoPackages={goPackages} />;
  } else if (view === "today") {
    content = <TodayView state={state} mineOnly={mineOnly} onGoPackages={goPackages} onGo={setView} />;
  } else if (view === "braindump") {
    content = <BrainDumpView state={state} />;
  } else if (view === "rescue") {
    content = <LifeRescueView state={state} />;
  } else if (view === "week") {
    content = <MyWeekView state={state} mineOnly={mineOnly} />;
  } else if (view === "home") {
    content = <SectionView state={state} mineOnly={mineOnly} category="home" title="My Home" blurb="The house, the chores, the stuff that keeps home running." />;
  } else if (view === "money") {
    content = <MoneyView state={state} mineOnly={mineOnly} />;
  } else if (view === "family") {
    content = <FamilyView state={state} mineOnly={mineOnly} />;
  } else if (view === "myself") {
    content = <SectionView state={state} mineOnly={mineOnly} category="myself" title="Myself" blurb="You — rest, health, learning, the things that fill you back up." />;
  } else if (view === "pending") {
    content = <PendingView state={state} mineOnly={mineOnly} />;
  } else if (view === "resetday") {
    content = <ResetDayView state={state} />;
  } else if (view === "weeklyreset") {
    content = <WeeklyResetView state={state} />;
  } else if (view === "packages") {
    content = <PackagesView state={state} />;
  } else if (view === "household") {
    content = <HouseholdView state={state} />;
  } else {
    content = <HelpView />;
  }

  let currentSection = "";
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <LogoMark size={30} />
          </span>
          LIFE RESET
        </div>
        <div className="brand-sub">Get your life back.</div>
        {NAV.map((item) => {
          if (item.section && item.section !== currentSection) {
            currentSection = item.section;
            return (
              <div key={`sec-${item.section}`}>
                <div className="nav-section">{item.section}</div>
                <NavButton key={item.view} item={item} active={view === item.view} locked={isFree && LOCKED_VIEWS.includes(item.view)} onClick={() => setView(item.view)} />
              </div>
            );
          }
          return (
            <NavButton key={item.view} item={item} active={view === item.view} locked={isFree && LOCKED_VIEWS.includes(item.view)} onClick={() => setView(item.view)} />
          );
        })}
        <div style={{ flex: 1 }} />
        <div className="nav-section">{state.settings.householdName}</div>
        <div style={{ padding: "0 12px", fontSize: 13, color: "var(--sage)" }}>
          {state.viewer.name} · {state.settings.planTier} plan
        </div>
      </aside>

      <main className="main">
        {!isAdmin ? (
          <div className="topbar">
            <span className="muted">Viewing:</span>
            <div className="toggle-row">
              <button className={mineOnly ? "active" : ""} onClick={() => setMineOnly(true)}>
                Mine
              </button>
              <button className={!mineOnly ? "active" : ""} onClick={() => setMineOnly(false)}>
                Everyone
              </button>
            </div>
            <div className="spacer" />
            <span className="chip">{state.settings.planTier}</span>
          </div>
        ) : (
          <div className="topbar">
            <div className="spacer" />
            <span className="chip">{state.settings.planTier}</span>
          </div>
        )}
        {content}
        <SiteFooter />
      </main>

      <nav className="mobile-nav">
        {MOBILE_NAV.map((v) => {
          const item = NAV.find((n) => n.view === v)!;
          return (
            <button key={v} className={view === v ? "active" : ""} onClick={() => setView(v)}>
              <span className="nav-ico">
                <Icon name={item.icon} size={22} />
              </span>
              {item.label}
            </button>
          );
        })}
        <button onClick={() => setView(view === "household" ? "today" : "household")}>
          <span className="nav-ico">
            <Icon name="dots" size={20} />
          </span>
          More
        </button>
      </nav>

      <button className="fab" aria-label="Quick Brain Dump" onClick={() => setView("braindump")}>
        <Icon name="plus" size={28} />
      </button>

      {isNewHousehold && showWelcome ? (
        <WelcomeOverlay
          onStart={() => {
            setShowWelcome(false);
            setView("braindump");
          }}
          onDismiss={() => setShowWelcome(false)}
        />
      ) : null}
    </div>
  );
}

function NavButton({
  item,
  active,
  locked,
  onClick,
}: {
  item: (typeof NAV)[number];
  active: boolean;
  locked: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>
      <span className="nav-ico">
        <Icon name={item.icon} size={20} />
      </span>
      {item.label}
      {locked ? (
        <span className="lock">
          <Icon name="lock" size={13} />
        </span>
      ) : null}
    </button>
  );
}
