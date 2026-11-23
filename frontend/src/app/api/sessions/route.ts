import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import {
  computeSessionMetrics,
  type SavedSession,
} from "@/lib/nlp/sessionStore";
import {
  serializeSession,
  type PracticeSessionDoc,
} from "@/lib/sessionSerializer";

const VALID_MODES = new Set(["company", "role", "general"]);

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const docs = await db
      .collection<PracticeSessionDoc>("practice_sessions")
      .find({ userId: new ObjectId(user.id) })
      .sort({ completedAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json(
      { sessions: docs.map(serializeSession) },
      { status: 200 }
    );
  } catch (err) {
    console.error("[sessions/GET]", err);
    return NextResponse.json(
      { error: "Failed to load practice sessions." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as Partial<SavedSession> | null;
    if (!body || !Array.isArray(body.answers) || body.answers.length === 0) {
      return NextResponse.json(
        { error: "Session must include at least one answer." },
        { status: 400 }
      );
    }

    if (!body.mode || !VALID_MODES.has(body.mode)) {
      return NextResponse.json(
        { error: "Invalid interview mode." },
        { status: 400 }
      );
    }

    const metrics = computeSessionMetrics(body.answers);
    const completedAtDate = body.completedAt
      ? new Date(body.completedAt)
      : new Date();
    const validCompletedAt = Number.isNaN(completedAtDate.getTime())
      ? new Date()
      : completedAtDate;

    const sessionId =
      typeof body.id === "string" && body.id.trim().length > 0
        ? body.id.trim()
        : `session-${crypto.randomUUID()}`;

    const doc: PracticeSessionDoc = {
      id: sessionId,
      userId: new ObjectId(user.id),
      completedAt: validCompletedAt,
      createdAt: new Date(),
      mode: body.mode,
      company: typeof body.company === "string" ? body.company : "",
      role: typeof body.role === "string" ? body.role : "",
      jobDescription:
        typeof body.jobDescription === "string" ? body.jobDescription : "",
      tailorReport: body.tailorReport ?? null,
      answers: body.answers,
      overallScore:
        typeof body.overallScore === "number"
          ? body.overallScore
          : metrics.overallScore,
      starScore:
        typeof body.starScore === "number" ? body.starScore : metrics.starScore,
      deliveryScore:
        body.deliveryScore !== undefined
          ? body.deliveryScore
          : metrics.deliveryScore,
      presenceScore:
        body.presenceScore !== undefined
          ? body.presenceScore
          : metrics.presenceScore,
    };

    const db = await getDb();
    await db.collection<PracticeSessionDoc>("practice_sessions").insertOne(doc);

    return NextResponse.json(
      { session: serializeSession(doc) },
      { status: 201 }
    );
  } catch (err) {
    console.error("[sessions/POST]", err);
    return NextResponse.json(
      { error: "Failed to save practice session." },
      { status: 500 }
    );
  }
}
