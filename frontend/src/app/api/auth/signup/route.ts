import { NextResponse } from "next/server";
import {
  createAuthSession,
  hashPassword,
  setSessionCookie,
} from "@/lib/auth";
import { getDb } from "@/lib/mongodb";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      name?: unknown;
      email?: unknown;
      password?: unknown;
    } | null;

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (name.length < 2) {
      return NextResponse.json(
        { error: "Please enter your name (at least 2 characters)." },
        { status: 400 }
      );
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const db = await getDb();
    const users = db.collection("users");

    const existing = await users.findOne({ email });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const insertResult = await users.insertOne({
      name,
      email,
      passwordHash: hashPassword(password),
      createdAt: new Date(),
    });

    const { token, expiresAt } = await createAuthSession(insertResult.insertedId);
    const response = NextResponse.json(
      {
        user: {
          id: insertResult.insertedId.toString(),
          name,
          email,
        },
      },
      { status: 201 }
    );
    setSessionCookie(response, token, expiresAt);
    return response;
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }
    console.error("[auth/signup]", err);
    return NextResponse.json(
      { error: "Failed to create account. Please try again." },
      { status: 500 }
    );
  }
}
