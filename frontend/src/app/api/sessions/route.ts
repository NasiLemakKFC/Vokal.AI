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
const MAX_ANSWERS = 10;

function isValidAnswer(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const a = value as Record<string, unknown>;
  if (typeof a.question !== "string" || typeof a.transcript !== "string") return false;
  if (!a.analysis || typeof a.analysis !== "object") return false;
  const analysis = a.analysis as Record<string, unknown>;
  return Boolean(analysis.star && typeof analysis.star === "object");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const url = new URL(request.url);
    const isSummary = url.searchParams.get("summary") === "1";

    if (!isSummary) {
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
    }

    const rawPage = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
    const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "25", 10);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(50, rawLimit) : 25;
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
    const modeParam = (url.searchParams.get("mode") ?? "").trim();
    const sortParam = (url.searchParams.get("sort") ?? "newest").trim();

    const filter: Record<string, unknown> = { userId: new ObjectId(user.id) };
    if (VALID_MODES.has(modeParam)) {
      filter.mode = modeParam;
    }
    if (q) {
      const regex = { $regex: escapeRegex(q), $options: "i" };
      filter.$or = [
        { company: regex },
        { role: regex },
        { "answers.0.question": regex },
      ];
    }

    const sortSpec: Record<string, 1 | -1> =
      sortParam === "highest"
        ? { overallScore: -1, completedAt: -1 }
        : sortParam === "lowest"
          ? { overallScore: 1, completedAt: -1 }
          : { completedAt: -1 };

    const col = db.collection<PracticeSessionDoc>("practice_sessions");
    const [total, rows] = await Promise.all([
      col.countDocuments(filter),
      col
        .aggregate([
          { $match: filter },
          { $sort: sortSpec },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $project: {
              _id: 0,
              id: 1,
              completedAt: 1,
              mode: 1,
              company: 1,
              role: 1,
              overallScore: 1,
              starScore: 1,
              deliveryScore: 1,
              presenceScore: 1,
              answerCount: {
                $cond: [
                  { $isArray: "$answers" },
                  { $size: "$answers" },
                  0,
                ],
              },
              firstQuestion: {
                $ifNull: [{ $arrayElemAt: ["$answers.question", 0] }, ""],
              },
            },
          },
        ])
        .toArray(),
    ]);

    const summaries = rows.map((row) => ({
      id: String(row.id),
      completedAt:
        row.completedAt instanceof Date
          ? row.completedAt.toISOString()
          : String(row.completedAt),
      mode: row.mode as "company" | "role" | "general",
      company: typeof row.company === "string" ? row.company : "",
      role: typeof row.role === "string" ? row.role : "",
      answerCount: typeof row.answerCount === "number" ? row.answerCount : 0,
      firstQuestion: typeof row.firstQuestion === "string" ? row.firstQuestion : "",
      overallScore: typeof row.overallScore === "number" ? row.overallScore : 0,
      starScore: typeof row.starScore === "number" ? row.starScore : 0,
      deliveryScore:
        typeof row.deliveryScore === "number" ? row.deliveryScore : null,
      presenceScore:
        typeof row.presenceScore === "number" ? row.presenceScore : null,
    }));

    return NextResponse.json(
      {
        summaries,
        total,
        page,
        limit,
        hasMore: page * limit < total,
      },
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

    if (body.answers.length > MAX_ANSWERS || !body.answers.every(isValidAnswer)) {
      return NextResponse.json(
        { error: "Invalid answers payload." },
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
      company: typeof body.company === "string" ? body.company.slice(0, 120) : "",
      role: typeof body.role === "string" ? body.role.slice(0, 100) : "",
      jobDescription:
        typeof body.jobDescription === "string" ? body.jobDescription.slice(0, 15_000) : "",
      tailorReport: body.tailorReport ?? null,
      answers: body.answers,
      overallScore: metrics.overallScore,
      starScore: metrics.starScore,
      deliveryScore: metrics.deliveryScore,
      presenceScore: metrics.presenceScore,
    };

    const db = await getDb();
    await db.collection<PracticeSessionDoc>("practice_sessions").insertOne(doc);

    return NextResponse.json(
      { session: serializeSession(doc) },
      { status: 201 }
    );
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) {
      return NextResponse.json(
        { error: "A session with this ID already exists." },
        { status: 409 }
      );
    }
    console.error("[sessions/POST]", err);
    return NextResponse.json(
      { error: "Failed to save practice session." },
      { status: 500 }
    );
  }
}
