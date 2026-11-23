import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

export const SESSION_COOKIE_NAME = "vokal_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface UserDoc {
  _id: ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

interface AuthSessionDoc {
  _id?: ObjectId;
  tokenHash: string;
  userId: ObjectId;
  expiresAt: Date;
  createdAt: Date;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;

  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createAuthSession(
  userId: ObjectId
): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const db = await getDb();

  await db.collection<AuthSessionDoc>("auth_sessions").insertOne({
    tokenHash: hashToken(token),
    userId,
    expiresAt,
    createdAt: new Date(),
  });

  return { token, expiresAt };
}

export async function deleteAuthSession(token: string): Promise<void> {
  if (!token) return;
  const db = await getDb();
  await db
    .collection<AuthSessionDoc>("auth_sessions")
    .deleteOne({ tokenHash: hashToken(token) });
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date
): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const db = await getDb();
  const session = await db
    .collection<AuthSessionDoc>("auth_sessions")
    .findOne({
      tokenHash: hashToken(token),
      expiresAt: { $gt: new Date() },
    });

  if (!session) return null;

  const user = await db
    .collection<UserDoc>("users")
    .findOne({ _id: session.userId });

  if (!user) return null;

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
  };
}
