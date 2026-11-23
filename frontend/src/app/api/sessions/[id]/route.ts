import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import {
  serializeSession,
  type PracticeSessionDoc,
} from "@/lib/sessionSerializer";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const db = await getDb();
    const doc = await db
      .collection<PracticeSessionDoc>("practice_sessions")
      .findOne({
        id,
        userId: new ObjectId(user.id),
      });

    if (!doc) {
      return NextResponse.json(
        { error: "Session not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { session: serializeSession(doc) },
      { status: 200 }
    );
  } catch (err) {
    console.error("[sessions/[id]/GET]", err);
    return NextResponse.json(
      { error: "Failed to load practice session." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const db = await getDb();
    const result = await db.collection("practice_sessions").deleteOne({
      id,
      userId: new ObjectId(user.id),
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Session not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[sessions/[id]/DELETE]", err);
    return NextResponse.json(
      { error: "Failed to delete practice session." },
      { status: 500 }
    );
  }
}
