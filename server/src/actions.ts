import { z } from "zod";
import { getDb, nowIso, todayStr, TIER_RANK, type PlanTier } from "./db";
import {
  getViewer,
  requireViewer,
  hashPin,
  newSalt,
  verifyPin,
  createSession,
  findMemberByUsername,
  deleteSessionsForMember,
  type Viewer,
  type MemberRow,
} from "./auth";
import { sortBrainDump as aiSortBrainDump, lifeRescue as aiLifeRescue, resetMyDay as aiResetMyDay, type TaskInput } from "./ai";

const CATEGORIES = ["home", "money", "family", "myself", "pending", "general"] as const;
const PRIORITIES = ["high", "medium", "low"] as const;
const TIERS = ["free", "essentials", "complete", "vip"] as const;

const usernameSchema = z
  .string()
  .min(3)
  .max(40)
  .regex(/^[A-Za-z0-9_.-]+$/, "Usernames can only use letters, numbers, _ . -");
const pinSchema = z.string().min(4).max(12);
const idSchema = z.number().int();
const sessionTokenSchema = z.string().max(200).optional();

function err(message: string): never {
  throw new Error(message);
}

interface SettingsRow {
  id: number;
  householdName: string;
  planTier: PlanTier;
  joinCode: string | null;
  squareEssentialsUrl: string | null;
  squareCompleteUrl: string | null;
  squareVipUrl: string | null;
  isSeller: number;
  createdAt: string;
}

function getSettings(householdId: number): SettingsRow {
  const db = getDb();
  const row = db.query("SELECT * FROM settings WHERE id = ?").get(householdId) as SettingsRow | null;
  if (!row) err("Household not found.");
  return row;
}

function getSellerSettings(): SettingsRow {
  return getSettings(1);
}

function requireAdmin(viewer: Viewer): void {
  if (viewer.member.role !== "admin") err("Only the household admin can do that.");
}

function requireSellerAdmin(viewer: Viewer): SettingsRow {
  requireAdmin(viewer);
  const settings = getSettings(viewer.householdId);
  if (!settings.isSeller) err("Only the seller household can do that.");
  return settings;
}

function requirePaid(viewer: Viewer, featureName: string): void {
  const settings = getSettings(viewer.householdId);
  if (TIER_RANK[settings.planTier] === 0) {
    err(`${featureName} is part of a paid plan. See Packages to unlock it.`);
  }
}

function publicMember(m: MemberRow) {
  return {
    id: m.id,
    name: m.name,
    username: m.username,
    hasLogin: !!(m.username && m.pinHash),
    role: m.role,
  };
}

function publicTask(t: any) {
  return {
    id: t.id,
    title: t.title,
    category: t.category,
    priority: t.priority,
    estMinutes: t.estMinutes,
    waitingOn: t.waitingOn,
    notes: t.notes,
    dueDate: t.dueDate,
    assigneeMemberId: t.assigneeMemberId,
    pinned: !!t.pinned,
    status: t.status,
    completedAt: t.completedAt,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

function getTaskOrFail(id: number, householdId: number) {
  const db = getDb();
  const t = db.query("SELECT * FROM tasks WHERE id = ?").get(id) as any | null;
  if (!t || t.householdId !== householdId) err("That task no longer exists.");
  return t;
}

function getBillOrFail(id: number, householdId: number) {
  const db = getDb();
  const b = db.query("SELECT * FROM bills WHERE id = ?").get(id) as any | null;
  if (!b || b.householdId !== householdId) err("That bill no longer exists.");
  return b;
}

function getDumpOrFail(id: number, householdId: number) {
  const db = getDb();
  const d = db.query("SELECT * FROM brain_dumps WHERE id = ?").get(id) as any | null;
  if (!d || d.householdId !== householdId) err("That brain dump no longer exists.");
  return d;
}

function getMemberOrFail(id: number, householdId: number): MemberRow {
  const db = getDb();
  const m = db.query("SELECT * FROM members WHERE id = ?").get(id) as MemberRow | null;
  if (!m || m.householdId !== householdId) err("That family member no longer exists.");
  return m;
}

function taskInput(t: any): TaskInput {
  return {
    id: t.id,
    title: t.title,
    category: t.category,
    priority: t.priority,
    estMinutes: t.estMinutes,
    dueDate: t.dueDate,
    waitingOn: t.waitingOn,
  };
}

// ---------------------------------------------------------------- getAppState
function getAppState(args: any) {
  const viewer = requireViewer(args.sessionToken);
  const db = getDb();
  const settings = getSettings(viewer.householdId);
  const members = (db
    .query("SELECT * FROM members WHERE householdId = ? ORDER BY id")
    .all(viewer.householdId) as MemberRow[]).map(publicMember);
  const tasks = (db
    .query("SELECT * FROM tasks WHERE householdId = ? ORDER BY id")
    .all(viewer.householdId) as any[]).map(publicTask);
  const bills = db
    .query("SELECT * FROM bills WHERE householdId = ? ORDER BY dueDate, id")
    .all(viewer.householdId) as any[];
  const dumps = db
    .query("SELECT * FROM brain_dumps WHERE householdId = ? ORDER BY id DESC")
    .all(viewer.householdId) as any[];
  const today = todayStr();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const openCount = tasks.filter((t) => t.status === "open").length;
  const doneToday = tasks.filter(
    (t) => t.status === "done" && t.completedAt && t.completedAt.slice(0, 10) === today
  ).length;
  const doneThisWeek = tasks.filter(
    (t) => t.status === "done" && t.completedAt && t.completedAt >= weekAgo
  ).length;
  const overdueCount = tasks.filter(
    (t) => t.status === "open" && t.dueDate && t.dueDate < today
  ).length;
  return {
    settings: {
      id: settings.id,
      householdName: settings.householdName,
      planTier: settings.planTier,
      joinCode: settings.joinCode,
      squareEssentialsUrl: settings.squareEssentialsUrl,
      squareCompleteUrl: settings.squareCompleteUrl,
      squareVipUrl: settings.squareVipUrl,
      isSeller: !!settings.isSeller,
    },
    members,
    tasks,
    bills: bills.map((b) => ({
      id: b.id,
      name: b.name,
      amountCents: b.amountCents,
      dueDate: b.dueDate,
      paid: !!b.paid,
      createdAt: b.createdAt,
    })),
    dumps: dumps.map((d) => ({
      id: d.id,
      rawText: d.rawText,
      status: d.status,
      createdAt: d.createdAt,
    })),
    stats: { openCount, doneToday, doneThisWeek, overdueCount },
    viewer: {
      id: viewer.member.id,
      name: viewer.member.name,
      username: viewer.member.username,
      role: viewer.member.role,
      householdId: viewer.householdId,
    },
  };
}

// ---------------------------------------------------------------- getAuthState
function getAuthState(args: any) {
  const db = getDb();
  const viewer = getViewer(args.sessionToken);
  const seller = getSellerSettings();
  if (viewer) {
    return {
      currentMember: {
        id: viewer.member.id,
        name: viewer.member.name,
        username: viewer.member.username,
        role: viewer.member.role,
        householdId: viewer.householdId,
        householdName: getSettings(viewer.householdId).householdName,
      },
      householdName: getSettings(viewer.householdId).householdName,
      loginOptions: [],
      loginsEnabled: true,
    };
  }
  const withLogins = db
    .query("SELECT username FROM members WHERE username IS NOT NULL AND pinHash IS NOT NULL ORDER BY username")
    .all() as { username: string }[];
  return {
    currentMember: null,
    householdName: seller.householdName,
    loginOptions: withLogins.map((r) => r.username),
    loginsEnabled: withLogins.length > 0,
  };
}

// ---------------------------------------------------------------- auth actions
function createHousehold(args: any) {
  const schema = z.object({
    householdName: z.string().min(1).max(80),
    name: z.string().min(1).max(60),
    username: usernameSchema,
    pin: pinSchema,
  });
  const { householdName, name, username, pin } = schema.parse(args);
  const db = getDb();
  const taken = findMemberByUsername(username);
  if (taken) err("That username is already taken. Try another one.");
  const seller = getSellerSettings();
  const now = nowIso();
  // The first household ever created claims the seeded seller household (id 1),
  // which is the only household that can issue unlock codes. Later households
  // get their own fresh settings row with the seller's Square links copied in.
  const sellerMemberCount = db
    .query("SELECT COUNT(*) AS n FROM members WHERE householdId = 1")
    .get() as { n: number };
  let householdId: number;
  if (sellerMemberCount.n === 0) {
    db.query("UPDATE settings SET householdName = ? WHERE id = 1").run(householdName);
    householdId = 1;
  } else {
    const result = db
      .query(
        `INSERT INTO settings (householdName, planTier, joinCode, squareEssentialsUrl, squareCompleteUrl, squareVipUrl, isSeller, createdAt)
         VALUES (?, 'free', NULL, ?, ?, ?, 0, ?)`
      )
      .run(householdName, seller.squareEssentialsUrl, seller.squareCompleteUrl, seller.squareVipUrl, now);
    householdId = Number(result.lastInsertRowid);
  }
  const salt = newSalt();
  const m = db
    .query(
      `INSERT INTO members (householdId, name, username, pinHash, pinSalt, role, createdAt)
       VALUES (?, ?, ?, ?, ?, 'admin', ?)`
    )
    .run(householdId, name, username, hashPin(pin, salt), salt, now);
  const memberId = Number(m.lastInsertRowid);
  const sessionToken = createSession(memberId, householdId);
  return { sessionToken, householdId, memberId };
}

function login(args: any) {
  const schema = z.object({ username: z.string().min(1).max(40), pin: pinSchema });
  const { username, pin } = schema.parse(args);
  const member = findMemberByUsername(username);
  if (!member || !verifyPin(pin, member)) {
    err("That username and PIN don't match.");
  }
  const sessionToken = createSession(member.id, member.householdId);
  return {
    sessionToken,
    member: publicMember(member),
    householdId: member.householdId,
    householdName: getSettings(member.householdId).householdName,
  };
}

function joinHousehold(args: any) {
  const schema = z.object({
    joinCode: z.string().min(1).max(20),
    name: z.string().min(1).max(60),
    username: usernameSchema,
    pin: pinSchema,
  });
  const { joinCode, name, username, pin } = schema.parse(args);
  const db = getDb();
  const household = db
    .query("SELECT * FROM settings WHERE joinCode IS NOT NULL AND lower(joinCode) = lower(?)")
    .get(joinCode) as SettingsRow | null;
  if (!household) err("That join code doesn't match any household. Check it and try again.");
  const taken = findMemberByUsername(username);
  if (taken) err("That username is already taken. Try another one.");
  const salt = newSalt();
  const now = nowIso();
  const m = db
    .query(
      `INSERT INTO members (householdId, name, username, pinHash, pinSalt, role, createdAt)
       VALUES (?, ?, ?, ?, ?, 'member', ?)`
    )
    .run(household.id, name, username, hashPin(pin, salt), salt, now);
  const memberId = Number(m.lastInsertRowid);
  const sessionToken = createSession(memberId, household.id);
  const created = db.query("SELECT * FROM members WHERE id = ?").get(memberId) as MemberRow;
  return {
    sessionToken,
    member: publicMember(created),
    householdId: household.id,
    householdName: household.householdName,
  };
}

function logout(args: any) {
  const db = getDb();
  if (args.sessionToken) {
    db.query("DELETE FROM sessions WHERE token = ?").run(args.sessionToken);
  }
  return {};
}

function changeMyPin(args: any) {
  const schema = z.object({ currentPin: pinSchema, newPin: pinSchema, sessionToken: sessionTokenSchema });
  const { currentPin, newPin } = schema.parse(args);
  const viewer = requireViewer(args.sessionToken);
  if (!verifyPin(currentPin, viewer.member)) err("Your current PIN doesn't match.");
  const db = getDb();
  const salt = newSalt();
  db.query("UPDATE members SET pinHash = ?, pinSalt = ? WHERE id = ?").run(
    hashPin(newPin, salt),
    salt,
    viewer.member.id
  );
  return {};
}

function resetPinWithJoinCode(args: any) {
  const schema = z.object({
    username: z.string().min(1).max(40),
    joinCode: z.string().min(1).max(20),
    newPin: pinSchema,
  });
  const { username, joinCode, newPin } = schema.parse(args);
  const db = getDb();
  const member = findMemberByUsername(username);
  if (!member) err("That username and join code don't match.");
  const settings = getSettings(member.householdId);
  if (
    !settings.joinCode ||
    settings.joinCode.toLowerCase() !== joinCode.toLowerCase()
  ) {
    err("That username and join code don't match.");
  }
  const salt = newSalt();
  db.query("UPDATE members SET pinHash = ?, pinSalt = ? WHERE id = ?").run(
    hashPin(newPin, salt),
    salt,
    member.id
  );
  deleteSessionsForMember(member.id);
  const sessionToken = createSession(member.id, member.householdId);
  return { sessionToken };
}

// ---------------------------------------------------------------- members
function addMember(args: any) {
  const schema = z.object({ name: z.string().min(1).max(60), sessionToken: sessionTokenSchema });
  const { name } = schema.parse(args);
  const viewer = requireViewer(args.sessionToken);
  const db = getDb();
  const now = nowIso();
  const r = db
    .query("INSERT INTO members (householdId, name, username, pinHash, pinSalt, role, createdAt) VALUES (?, ?, NULL, NULL, NULL, 'member', ?)")
    .run(viewer.householdId, name, now);
  return { id: Number(r.lastInsertRowid) };
}

function deleteMember(args: any) {
  const schema = z.object({ id: idSchema, sessionToken: sessionTokenSchema });
  const { id } = schema.parse(args);
  const viewer = requireViewer(args.sessionToken);
  requireAdmin(viewer);
  const member = getMemberOrFail(id, viewer.householdId);
  if (member.id === viewer.member.id) err("You can't remove yourself from your own household.");
  const db = getDb();
  db.query("UPDATE tasks SET assigneeMemberId = NULL WHERE assigneeMemberId = ?").run(id);
  db.query("DELETE FROM sessions WHERE memberId = ?").run(id);
  db.query("DELETE FROM members WHERE id = ?").run(id);
  return {};
}

function setMemberLogin(args: any) {
  const schema = z.object({
    memberId: idSchema,
    username: usernameSchema,
    pin: pinSchema.optional(),
    sessionToken: sessionTokenSchema,
  });
  const { memberId, username, pin } = schema.parse(args);
  const viewer = requireViewer(args.sessionToken);
  requireAdmin(viewer);
  const member = getMemberOrFail(memberId, viewer.householdId);
  const db = getDb();
  const taken = db
    .query("SELECT id FROM members WHERE lower(username) = lower(?) AND id != ?")
    .get(username, memberId) as { id: number } | null;
  if (taken) err("That username is already taken. Try another one.");
  if (pin) {
    const salt = newSalt();
    db.query("UPDATE members SET username = ?, pinHash = ?, pinSalt = ? WHERE id = ?").run(
      username,
      hashPin(pin, salt),
      salt,
      memberId
    );
  } else {
    if (!member.pinHash) err("Set a PIN for this login first.");
    db.query("UPDATE members SET username = ? WHERE id = ?").run(username, memberId);
  }
  return { id: memberId, username };
}

function removeMemberLogin(args: any) {
  const schema = z.object({ memberId: idSchema, sessionToken: sessionTokenSchema });
  const { memberId } = schema.parse(args);
  const viewer = requireViewer(args.sessionToken);
  requireAdmin(viewer);
  const member = getMemberOrFail(memberId, viewer.householdId);
  if (member.id === viewer.member.id) err("You can't remove your own login.");
  const db = getDb();
  db.query("UPDATE members SET username = NULL, pinHash = NULL, pinSalt = NULL WHERE id = ?").run(memberId);
  db.query("DELETE FROM sessions WHERE memberId = ?").run(memberId);
  return {};
}

function setJoinCode(args: any) {
  const schema = z.object({ joinCode: z.string().max(20), sessionToken: sessionTokenSchema });
  const { joinCode } = schema.parse(args);
  const viewer = requireViewer(args.sessionToken);
  requireAdmin(viewer);
  const db = getDb();
  const code = joinCode.trim();
  if (code) {
    const clash = db
      .query("SELECT id FROM settings WHERE joinCode IS NOT NULL AND lower(joinCode) = lower(?) AND id != ?")
      .get(code, viewer.householdId) as { id: number } | null;
    if (clash) err("That join code is already in use by another household. Pick a different one.");
    db.query("UPDATE settings SET joinCode = ? WHERE id = ?").run(code, viewer.householdId);
    return { joinCode: code };
  }
  db.query("UPDATE settings SET joinCode = NULL WHERE id = ?").run(viewer.householdId);
  return { joinCode: null };
}

function updateHousehold(args: any) {
  const schema = z.object({ householdName: z.string().min(1).max(80), sessionToken: sessionTokenSchema });
  const { householdName } = schema.parse(args);
  const viewer = requireViewer(args.sessionToken);
  requireAdmin(viewer);
  const db = getDb();
  db.query("UPDATE settings SET householdName = ? WHERE id = ?").run(householdName, viewer.householdId);
  return { householdName };
}

function setSquareLink(args: any) {
  const schema = z.object({
    pkg: z.enum(["essentials", "complete", "vip"]),
    url: z.string().max(500),
    sessionToken: sessionTokenSchema,
  });
  const { pkg, url } = schema.parse(args);
  const viewer = requireViewer(args.sessionToken);
  requireSellerAdmin(viewer);
  const db = getDb();
  const col =
    pkg === "essentials"
      ? "squareEssentialsUrl"
      : pkg === "complete"
        ? "squareCompleteUrl"
        : "squareVipUrl";
  const value = url.trim() === "" ? null : url.trim();
  db.query(`UPDATE settings SET ${col} = ? WHERE id = ?`).run(value, viewer.householdId);
  return { pkg, url: value };
}

// ---------------------------------------------------------------- tasks
const taskFields = {
  title: z.string().min(1).max(200),
  category: z.enum(CATEGORIES).default("general"),
  priority: z.enum(PRIORITIES).default("medium"),
  estMinutes: z.number().int().gt(0).max(1440).nullable().optional(),
  waitingOn: z.string().max(200).nullable().optional(),
  notes: z.string().max(1000).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  assigneeMemberId: z.number().int().nullable().optional(),
};

function addTask(args: any) {
  const schema = z.object({ ...taskFields, sessionToken: sessionTokenSchema });
  const parsed = schema.parse(args);
  const viewer = requireViewer(args.sessionToken);
  if (parsed.assigneeMemberId) {
    getMemberOrFail(parsed.assigneeMemberId, viewer.householdId);
  }
  const db = getDb();
  const now = nowIso();
  const r = db
    .query(
      `INSERT INTO tasks (householdId, title, category, priority, estMinutes, waitingOn, notes, dueDate, assigneeMemberId, pinned, status, completedAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'open', NULL, ?, ?)`
    )
    .run(
      viewer.householdId,
      parsed.title,
      parsed.category,
      parsed.priority,
      parsed.estMinutes ?? null,
      parsed.waitingOn ?? null,
      parsed.notes ?? null,
      parsed.dueDate ?? null,
      parsed.assigneeMemberId ?? null,
      now,
      now
    );
  return { id: Number(r.lastInsertRowid) };
}

function updateTask(args: any) {
  const schema = z.object({
    id: idSchema,
    title: z.string().min(1).max(200).optional(),
    category: z.enum(CATEGORIES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    estMinutes: z.number().int().gt(0).max(1440).nullable().optional(),
    waitingOn: z.string().max(200).nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    assigneeMemberId: z.number().int().nullable().optional(),
    sessionToken: sessionTokenSchema,
  });
  const parsed = schema.parse(args);
  const viewer = requireViewer(args.sessionToken);
  getTaskOrFail(parsed.id, viewer.householdId);
  if (parsed.assigneeMemberId) {
    getMemberOrFail(parsed.assigneeMemberId, viewer.householdId);
  }
  const db = getDb();
  const sets: string[] = [];
  const values: any[] = [];
  const fields = ["title", "category", "priority", "estMinutes", "waitingOn", "notes", "dueDate", "assigneeMemberId"] as const;
  for (const f of fields) {
    if (parsed[f] !== undefined) {
      sets.push(`${f} = ?`);
      values.push(parsed[f]);
    }
  }
  if (sets.length) {
    sets.push("updatedAt = ?");
    values.push(nowIso());
    db.query(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(...values, parsed.id);
  }
  return { id: parsed.id };
}

function deleteTask(args: any) {
  const schema = z.object({ id: idSchema, sessionToken: sessionTokenSchema });
  const { id } = schema.parse(args);
  const viewer = requireViewer(args.sessionToken);
  getTaskOrFail(id, viewer.householdId);
  getDb().query("DELETE FROM tasks WHERE id = ?").run(id);
  return {};
}

function setTaskStatus(args: any) {
  const schema = z.object({
    id: idSchema,
    status: z.enum(["open", "done"]),
    sessionToken: sessionTokenSchema,
  });
  const { id, status } = schema.parse(args);
  const viewer = requireViewer(args.sessionToken);
  getTaskOrFail(id, viewer.householdId);
  const db = getDb();
  const completedAt = status === "done" ? nowIso() : null;
  db.query("UPDATE tasks SET status = ?, completedAt = ?, updatedAt = ? WHERE id = ?").run(
    status,
    completedAt,
    nowIso(),
    id
  );
  return { id, status, completedAt };
}

function togglePin(args: any) {
  const schema = z.object({ id: idSchema, pinned: z.boolean(), sessionToken: sessionTokenSchema });
  const { id, pinned } = schema.parse(args);
  const viewer = requireViewer(args.sessionToken);
  getTaskOrFail(id, viewer.householdId);
  getDb().query("UPDATE tasks SET pinned = ?, updatedAt = ? WHERE id = ?").run(pinned ? 1 : 0, nowIso(), id);
  return { id, pinned };
}

function setTopPriorities(args: any) {
  const schema = z.object({
    ids: z.array(z.number().int()).max(10),
    sessionToken: sessionTokenSchema,
  });
  const { ids } = schema.parse(args);
  const viewer = requireViewer(args.sessionToken);
  const db = getDb();
  for (const id of ids) getTaskOrFail(id, viewer.householdId);
  db.query("UPDATE tasks SET pinned = 0 WHERE householdId = ?").run(viewer.householdId);
  for (const id of ids) {
    db.query("UPDATE tasks SET pinned = 1, updatedAt = ? WHERE id = ?").run(nowIso(), id);
  }
  return { pinnedIds: ids };
}

// ---------------------------------------------------------------- bills
function addBill(args: any) {
  const schema = z.object({
    name: z.string().min(1).max(120),
    amountCents: z.number().int().min(0).max(100000000).nullable().optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    sessionToken: sessionTokenSchema,
  });
  const parsed = schema.parse(args);
  const viewer = requireViewer(args.sessionToken);
  const db = getDb();
  const r = db
    .query("INSERT INTO bills (householdId, name, amountCents, dueDate, paid, createdAt) VALUES (?, ?, ?, ?, 0, ?)")
    .run(viewer.householdId, parsed.name, parsed.amountCents ?? null, parsed.dueDate ?? null, nowIso());
  return { id: Number(r.lastInsertRowid) };
}

function deleteBill(args: any) {
  const schema = z.object({ id: idSchema, sessionToken: sessionTokenSchema });
  const { id } = schema.parse(args);
  const viewer = requireViewer(args.sessionToken);
  getBillOrFail(id, viewer.householdId);
  getDb().query("DELETE FROM bills WHERE id = ?").run(id);
  return {};
}

function setBillPaid(args: any) {
  const schema = z.object({ id: idSchema, paid: z.boolean(), sessionToken: sessionTokenSchema });
  const { id, paid } = schema.parse(args);
  const viewer = requireViewer(args.sessionToken);
  getBillOrFail(id, viewer.householdId);
  getDb().query("UPDATE bills SET paid = ? WHERE id = ?").run(paid ? 1 : 0, id);
  return { id, paid };
}

// ---------------------------------------------------------------- brain dumps
function addBrainDump(args: any) {
  const schema = z.object({ rawText: z.string().min(1).max(5000), sessionToken: sessionTokenSchema });
  const { rawText } = schema.parse(args);
  const viewer = requireViewer(args.sessionToken);
  const db = getDb();
  const r = db
    .query("INSERT INTO brain_dumps (householdId, rawText, status, createdAt) VALUES (?, ?, 'unsorted', ?)")
    .run(viewer.householdId, rawText, nowIso());
  return { id: Number(r.lastInsertRowid) };
}

function deleteBrainDump(args: any) {
  const schema = z.object({ id: idSchema, sessionToken: sessionTokenSchema });
  const { id } = schema.parse(args);
  const viewer = requireViewer(args.sessionToken);
  getDumpOrFail(id, viewer.householdId);
  getDb().query("DELETE FROM brain_dumps WHERE id = ?").run(id);
  return {};
}

function sortBrainDump(args: any) {
  const schema = z.object({ id: idSchema, sessionToken: sessionTokenSchema });
  const { id } = schema.parse(args);
  const viewer = requireViewer(args.sessionToken);
  const dump = getDumpOrFail(id, viewer.householdId);
  return aiSortBrainDump(dump.rawText);
}

const confirmTaskSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  estMinutes: z.number().int().gt(0).max(1440).nullable(),
  waitingOn: z.string().max(200).nullable(),
});

function confirmSortedTasks(args: any) {
  const schema = z.object({
    dumpId: idSchema,
    tasks: z.array(confirmTaskSchema).min(1).max(50),
    sessionToken: sessionTokenSchema,
  });
  const { dumpId, tasks } = schema.parse(args);
  const viewer = requireViewer(args.sessionToken);
  getDumpOrFail(dumpId, viewer.householdId);
  const db = getDb();
  const now = nowIso();
  const createdIds: number[] = [];
  for (const t of tasks) {
    const r = db
      .query(
        `INSERT INTO tasks (householdId, title, category, priority, estMinutes, waitingOn, notes, dueDate, assigneeMemberId, pinned, status, completedAt, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 0, 'open', NULL, ?, ?)`
      )
      .run(viewer.householdId, t.title, t.category, t.priority, t.estMinutes, t.waitingOn, now, now);
    createdIds.push(Number(r.lastInsertRowid));
  }
  db.query("UPDATE brain_dumps SET status = 'sorted' WHERE id = ?").run(dumpId);
  return { createdIds };
}

// ---------------------------------------------------------------- AI actions (proposals only)
function lifeRescue(args: any) {
  const schema = z.object({
    minutesAvailable: z.number().int().gt(0).max(1440).nullable(),
    energy: z.enum(["low", "medium", "high"]),
    whatsHappening: z.string().max(2000).default(""),
    sessionToken: sessionTokenSchema,
  });
  const { minutesAvailable, energy, whatsHappening } = schema.parse(args);
  const viewer = requireViewer(args.sessionToken);
  requirePaid(viewer, "Life Rescue");
  const db = getDb();
  const tasks = db
    .query("SELECT * FROM tasks WHERE householdId = ? AND status = 'open' ORDER BY id")
    .all(viewer.householdId) as any[];
  return aiLifeRescue(
    tasks.map(taskInput),
    minutesAvailable,
    energy,
    whatsHappening
  );
}

function resetMyDay(args: any) {
  const schema = z.object({ note: z.string().max(2000).default(""), sessionToken: sessionTokenSchema });
  const { note } = schema.parse(args);
  const viewer = requireViewer(args.sessionToken);
  requirePaid(viewer, "Reset My Day");
  const db = getDb();
  const today = todayStr();
  const tasks = db
    .query(
      "SELECT * FROM tasks WHERE householdId = ? AND status = 'open' AND (dueDate IS NULL OR dueDate <= ?) ORDER BY dueDate, id"
    )
    .all(viewer.householdId, today) as any[];
  return aiResetMyDay(tasks.map(taskInput), note);
}

function applyDayReset(args: any) {
  const schema = z.object({
    taskIds: z.array(z.number().int()).max(100),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sessionToken: sessionTokenSchema,
  });
  const { taskIds, dueDate } = schema.parse(args);
  const viewer = requireViewer(args.sessionToken);
  const db = getDb();
  for (const id of taskIds) getTaskOrFail(id, viewer.householdId);
  for (const id of taskIds) {
    db.query("UPDATE tasks SET dueDate = ?, updatedAt = ? WHERE id = ?").run(dueDate, nowIso(), id);
  }
  return { movedIds: taskIds, dueDate };
}

// ---------------------------------------------------------------- unlock codes
const UNLOCK_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateUnlockCode(): string {
  const db = getDb();
  for (let attempt = 0; attempt < 20; attempt++) {
    let part = "";
    for (let i = 0; i < 8; i++) {
      part += UNLOCK_ALPHABET[Math.floor(Math.random() * UNLOCK_ALPHABET.length)];
    }
    const code = `LR-${part.slice(0, 4)}-${part.slice(4)}`;
    const exists = db.query("SELECT id FROM unlock_codes WHERE code = ?").get(code);
    if (!exists) return code;
  }
  err("Could not generate a unique code. Try again.");
}

function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function createUnlockCode(args: any) {
  const schema = z.object({
    tier: z.enum(["essentials", "complete", "vip"]),
    note: z.string().max(120).optional(),
    sessionToken: sessionTokenSchema,
  });
  const { tier, note } = schema.parse(args);
  const viewer = requireViewer(args.sessionToken);
  requireSellerAdmin(viewer);
  const db = getDb();
  const code = generateUnlockCode();
  const r = db
    .query(
      `INSERT INTO unlock_codes (code, tier, note, issuedByHouseholdId, redeemedByHouseholdId, redeemedAt, createdAt)
       VALUES (?, ?, ?, ?, NULL, NULL, ?)`
    )
    .run(code, tier, note ?? null, viewer.householdId, nowIso());
  return { id: Number(r.lastInsertRowid), code, tier };
}

function listUnlockCodes(args: any) {
  const viewer = requireViewer(args.sessionToken);
  requireSellerAdmin(viewer);
  const db = getDb();
  const rows = db
    .query(
      `SELECT uc.*, s.householdName AS redeemedByHouseholdName
       FROM unlock_codes uc
       LEFT JOIN settings s ON s.id = uc.redeemedByHouseholdId
       WHERE uc.issuedByHouseholdId = ?
       ORDER BY uc.id DESC`
    )
    .all(viewer.householdId) as any[];
  return {
    codes: rows.map((r) => ({
      id: r.id,
      code: r.code,
      tier: r.tier,
      note: r.note,
      redeemed: !!r.redeemedByHouseholdId,
      redeemedByHouseholdName: r.redeemedByHouseholdName,
      redeemedAt: r.redeemedAt,
      createdAt: r.createdAt,
    })),
  };
}

function redeemUnlockCode(args: any) {
  const schema = z.object({ code: z.string().min(1).max(40), sessionToken: sessionTokenSchema });
  const { code } = schema.parse(args);
  const viewer = requireViewer(args.sessionToken);
  const db = getDb();
  const normalized = normalizeCode(code);
  const row = db
    .query("SELECT * FROM unlock_codes WHERE replace(code, '-', '') = ?")
    .get(normalized) as any | null;
  if (!row) err("That code doesn't match any unlock code. Check it and try again.");
  if (row.redeemedByHouseholdId) err("That code has already been used.");
  const settings = getSettings(viewer.householdId);
  const currentRank = TIER_RANK[settings.planTier];
  const codeRank = TIER_RANK[row.tier as PlanTier];
  if (currentRank >= codeRank) {
    err(
      `Your household is already on ${settings.planTier} or higher, so this code isn't needed — and it hasn't been used.`
    );
  }
  db.query("UPDATE settings SET planTier = ? WHERE id = ?").run(row.tier, viewer.householdId);
  db.query(
    "UPDATE unlock_codes SET redeemedByHouseholdId = ?, redeemedAt = ? WHERE id = ?"
  ).run(viewer.householdId, nowIso(), row.id);
  return { planTier: row.tier as PlanTier, alreadyHadTier: false };
}

// ---------------------------------------------------------------- dispatch
const ACTIONS: Record<string, (args: any) => unknown | Promise<unknown>> = {
  getAppState,
  getAuthState,
  createHousehold,
  login,
  joinHousehold,
  logout,
  changeMyPin,
  resetPinWithJoinCode,
  addMember,
  deleteMember,
  setMemberLogin,
  removeMemberLogin,
  setJoinCode,
  updateHousehold,
  setSquareLink,
  addTask,
  updateTask,
  deleteTask,
  setTaskStatus,
  togglePin,
  setTopPriorities,
  addBill,
  deleteBill,
  setBillPaid,
  addBrainDump,
  deleteBrainDump,
  sortBrainDump,
  confirmSortedTasks,
  lifeRescue,
  resetMyDay,
  applyDayReset,
  createUnlockCode,
  listUnlockCodes,
  redeemUnlockCode,
};

export async function handleAction(
  action: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const fn = ACTIONS[action];
  if (!fn) throw new Error(`Unknown action: ${action}`);
  return await fn(args ?? {});
}
