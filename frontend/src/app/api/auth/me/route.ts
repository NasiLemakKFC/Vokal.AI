import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }
    return NextResponse.json({ user }, { status: 200 });
  } catch (err) {
    console.error("[auth/me]", err);
    return NextResponse.json(
      { user: null, error: "Failed to verify session." },
      { status: 500 }
    );
  }
}
