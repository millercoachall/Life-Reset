import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getDb } from "./db";

export interface MemberRow {
  id: number;
  householdId: number;
  name: string;
  username: string | null;
  pinHash: string | null;
  pinSalt: string | null;
  role: string;
  createdAt: string;
}

export interface SessionRow {
  id: number;
  token: string;
  memberId: number;
  householdId: number;
  expiresAt: string;
  createdAt: string;
}

export interface Viewer {
  member: MemberRow;
  householdId: number;
}

export function hashPin(pin: string, salt: string): string {
  return createHash("sha256").update(salt + ":" + pin).digest("hex");
}

export function newSalt(): string {
  return randomBytes(16).toString("hex");
}

export function verifyPin(pin: string, member: MemberRow): boolean {
  if (!member.pinHash || !member.pinSalt) return false;
  const hash = hashPin(pin, member.pinSalt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(member.pinHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function createSession(memberId: number, householdId: number): string {
  const db = getDb();
  const token = newSessionToken();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.query(
    "INSERT INTO sessions (token, memberId, householdId, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?)"
  ).run(token, memberId, householdId, expires, new Date().toISOString());
  return token;
}

export function getViewer(sessionToken?: string | null): Viewer | null {
  if (!sessionToken) return null;
  const db = getDb();
  const session = db
    .query("SELECT * FROM sessions WHERE token = ?")
    .get(sessionToken) as SessionRow | null;
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    db.query("DELETE FROM sessions WHERE token = ?").run(sessionToken);
    return null;
  }
  const member = db
    .query("SELECT * FROM members WHERE id = ?")
    .get(session.memberId) as MemberRow | null;
  if (!member) return null;
  return { member, householdId: session.householdId };
}

export function requireViewer(sessionToken?: string | null): Viewer {
  const viewer = getViewer(sessionToken);
  if (!viewer) throw new Error("Please sign in to your household to keep going.");
  return viewer;
}

export function findMemberByUsername(username: string): MemberRow | null {
  const db = getDb();
  return db
    .query("SELECT * FROM members WHERE lower(username) = lower(?)")
    .get(username) as MemberRow | null;
}

export function deleteSessionsForMember(memberId: number, exceptToken?: string) {
  const db = getDb();
  if (exceptToken) {
    db.query("DELETE FROM sessions WHERE memberId = ? AND token != ?").run(
      memberId,
      exceptToken
    );
  } else {
    db.query("DELETE FROM sessions WHERE memberId = ?").run(memberId);
  }
}
