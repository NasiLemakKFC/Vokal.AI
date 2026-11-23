import { NextResponse } from "next/server";
import type { ObjectId } from "mongodb";
import {
  createAuthSession,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { getDb } from "@/lib/mongodb";

interface UserRecord {
  _id: ObjectId;
  name: string;
  email: string;
  passwordHash: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      email?: unknown;
      password?: unknown;
    } | null;

    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const db = await getDb();
    const user = await db
      .collection<UserRecord>("users")
      .findOne({ email });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const { token, expiresAt } = await createAuthSession(user._id);
    const response = NextResponse.json(
      {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
        },
      },
      { status: 200 }
    );
    setSessionCookie(response, token, expiresAt);
    return response;
  } catch (err) {
    console.error("[auth/login]", err);
    return NextResponse.json(
      { error: "Failed to sign in. Please try again." },
      { status: 500 }
    );
  }
}
