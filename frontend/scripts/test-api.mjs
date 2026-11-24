import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient, ServerApiVersion } from "mongodb";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(__dirname, "..");

function loadEnvLocal() {
  const envPath = path.join(frontendDir, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function getDatabaseNameFromUri(uri) {
  const match = uri.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/i);
  const dbName = match?.[1]?.trim();
  return dbName || "interviewai";
}

function extractSessionCookie(res) {
  const setCookie = res.headers.get("set-cookie") || "";
  const match = setCookie.match(/vokal_session=[^;]+/);
  return match ? match[0] : null;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function waitForServer(baseUrl) {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${baseUrl}/login`);
      if (res.ok) return;
    } catch {
      // Server still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for Next.js server at ${baseUrl}`);
}

async function main() {
  loadEnvLocal();

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("Missing MONGODB_URI in environment or frontend/.env.local.");
    process.exit(1);
  }

  let baseUrl = process.env.TEST_BASE_URL?.replace(/\/+$/, "");
  let serverProc = null;

  if (!baseUrl) {
    const buildIdPath = path.join(frontendDir, ".next", "BUILD_ID");
    if (!fs.existsSync(buildIdPath)) {
      console.error(
        "No production build found in frontend/.next. Run npm run build first or pass TEST_BASE_URL=http://localhost:3000."
      );
      process.exit(1);
    }

    const port = Number(process.env.TEST_PORT || 3199);
    baseUrl = `http://127.0.0.1:${port}`;
    const nextBin = path.join(
      frontendDir,
      "node_modules",
      "next",
      "dist",
      "bin",
      "next"
    );
    serverProc = spawn(
      process.execPath,
      [nextBin, "start", "-p", String(port), "-H", "127.0.0.1"],
      {
        cwd: frontendDir,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );
    await waitForServer(baseUrl);
  }

  const stamp = Date.now();
  const userAEmail = `test-a-${stamp}@example.com`;
  const userBEmail = `test-b-${stamp}@example.com`;
  const password = "password123";
  let passed = 0;
  let failed = 0;

  async function runTest(name, fn) {
    try {
      await fn();
      passed += 1;
      console.log(`PASS  ${name}`);
    } catch (err) {
      failed += 1;
      console.error(
        `FAIL  ${name}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  let cookieA = "";
  let cookieB = "";
  const createdSessionId = `session-test-${stamp}`;

  try {
    await runTest("Unauthenticated /api/auth/me returns 401", async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`);
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    await runTest("Unauthenticated /api/sessions returns 401", async () => {
      const res = await fetch(`${baseUrl}/api/sessions`);
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    await runTest("Unauthenticated interview and speech POST routes return 401", async () => {
      const routes = [
        "/api/interview/prepare",
        "/api/interview/parse-resume",
        "/api/speech",
      ];
      for (const route of routes) {
        const res = await fetch(`${baseUrl}${route}`, { method: "POST" });
        assert(res.status === 401, `${route}: expected 401, got ${res.status}`);
      }
    });

    await runTest("Signup validation rejects invalid inputs (400)", async () => {
      const cases = [
        { name: "A", email: userAEmail, password },
        { name: "Ali", email: "not-an-email", password },
        { name: "Ali", email: userAEmail, password: "123" },
      ];
      for (const payload of cases) {
        const res = await fetch(`${baseUrl}/api/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        assert(res.status === 400, `Expected 400, got ${res.status}`);
      }
    });

    await runTest("Signup User A returns 201 and sets session cookie", async () => {
      const res = await fetch(`${baseUrl}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Ali Bin Abu",
          email: userAEmail,
          password,
        }),
      });
      assert(res.status === 201, `Expected 201, got ${res.status}`);
      const cookie = extractSessionCookie(res);
      assert(cookie, "Missing vokal_session cookie");
      cookieA = cookie;
      const body = await res.json();
      assert(body.user?.email === userAEmail, "Returned user email mismatch");
    });

    await runTest("Duplicate signup returns 409", async () => {
      const res = await fetch(`${baseUrl}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Ali Duplicate",
          email: userAEmail,
          password,
        }),
      });
      assert(res.status === 409, `Expected 409, got ${res.status}`);
    });

    await runTest("Login rejects wrong password (401)", async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userAEmail, password: "wrong-password" }),
      });
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    await runTest("Login accepts valid credentials (200)", async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userAEmail, password }),
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const cookie = extractSessionCookie(res);
      assert(cookie, "Missing vokal_session cookie on login");
      cookieA = cookie;
    });

    await runTest("/api/auth/me returns signed-in User A", async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Cookie: cookieA },
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.user?.email === userAEmail, "Expected User A email");
    });

    await runTest("User A starts with 0 sessions (empty state)", async () => {
      const res = await fetch(`${baseUrl}/api/sessions`, {
        headers: { Cookie: cookieA },
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(
        Array.isArray(body.sessions) && body.sessions.length === 0,
        "Expected empty sessions array"
      );
    });

    await runTest("POST /api/sessions rejects invalid payload (400)", async () => {
      const res = await fetch(`${baseUrl}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieA },
        body: JSON.stringify({ mode: "role", answers: [] }),
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    await runTest("POST /api/sessions persists a STAR session (201)", async () => {
      const payload = {
        id: createdSessionId,
        completedAt: new Date().toISOString(),
        mode: "role",
        company: "",
        role: "Software Engineer",
        jobDescription: "",
        tailorReport: null,
        answers: [
          {
            question: "Tell me about a challenging production issue you solved.",
            transcript:
              "In my final year project, our payment API timed out four hours before demo day. My task was to isolate the bottleneck. I profiled SQL queries and added an index, reducing latency by 72% from 850 ms to 235 ms.",
            analysis: {
              star: {
                situation: {
                  found: true,
                  explanation: "Clear context.",
                  suggestion: "Keep it concise.",
                  sentences: [
                    "In my final year project, our payment API timed out four hours before demo day.",
                  ],
                },
                task: {
                  found: true,
                  explanation: "Responsibility stated.",
                  suggestion: "Good.",
                  sentences: ["My task was to isolate the bottleneck."],
                },
                action: {
                  found: true,
                  explanation: "Concrete steps explained.",
                  suggestion: "Good.",
                  sentences: [
                    "I profiled SQL queries and added an index, reducing latency by 72% from 850 ms to 235 ms.",
                  ],
                },
                result: {
                  found: true,
                  explanation: "Quantified result provided.",
                  suggestion: "Strong metric.",
                  sentences: [
                    "I profiled SQL queries and added an index, reducing latency by 72% from 850 ms to 235 ms.",
                  ],
                },
              },
              sentences: [],
              keywordGroups: [],
              matchedCount: 3,
              missingCount: 0,
              coverage: 100,
              coaching: ["Strong quantified result."],
            },
            speech: null,
            vision: null,
            durationSec: 42,
          },
        ],
      };

      const res = await fetch(`${baseUrl}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookieA },
        body: JSON.stringify(payload),
      });
      assert(res.status === 201, `Expected 201, got ${res.status}`);
      const body = await res.json();
      assert(body.session?.id === createdSessionId, "Saved session ID mismatch");
    });

    await runTest("GET /api/sessions & /api/sessions/[id] return saved session", async () => {
      const listRes = await fetch(`${baseUrl}/api/sessions`, {
        headers: { Cookie: cookieA },
      });
      assert(listRes.status === 200, `Expected 200, got ${listRes.status}`);
      const listBody = await listRes.json();
      assert(
        listBody.sessions?.length === 1 &&
          listBody.sessions[0].id === createdSessionId,
        "Session not found in list"
      );

      const oneRes = await fetch(
        `${baseUrl}/api/sessions/${encodeURIComponent(createdSessionId)}`,
        { headers: { Cookie: cookieA } }
      );
      assert(oneRes.status === 200, `Expected 200, got ${oneRes.status}`);
    });

    await runTest("Multi-user isolation: User B cannot view or delete User A session", async () => {
      const signupB = await fetch(`${baseUrl}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Siti Aminah",
          email: userBEmail,
          password,
        }),
      });
      assert(signupB.status === 201, `Signup B failed: ${signupB.status}`);
      const cookie = extractSessionCookie(signupB);
      assert(cookie, "Missing cookie for User B");
      cookieB = cookie;

      const listB = await fetch(`${baseUrl}/api/sessions`, {
        headers: { Cookie: cookieB },
      });
      const listBBody = await listB.json();
      assert(listBBody.sessions?.length === 0, "User B should have 0 sessions");

      const getOther = await fetch(
        `${baseUrl}/api/sessions/${encodeURIComponent(createdSessionId)}`,
        { headers: { Cookie: cookieB } }
      );
      assert(getOther.status === 404, `Expected 404 on GET, got ${getOther.status}`);

      const delOther = await fetch(
        `${baseUrl}/api/sessions/${encodeURIComponent(createdSessionId)}`,
        { method: "DELETE", headers: { Cookie: cookieB } }
      );
      assert(
        delOther.status === 404,
        `Expected 404 on DELETE, got ${delOther.status}`
      );
    });

    await runTest("User A deletes own session (200) and list becomes empty", async () => {
      const delRes = await fetch(
        `${baseUrl}/api/sessions/${encodeURIComponent(createdSessionId)}`,
        { method: "DELETE", headers: { Cookie: cookieA } }
      );
      assert(delRes.status === 200, `Expected 200, got ${delRes.status}`);

      const listRes = await fetch(`${baseUrl}/api/sessions`, {
        headers: { Cookie: cookieA },
      });
      const listBody = await listRes.json();
      assert(
        listBody.sessions?.length === 0,
        "Expected 0 sessions after delete"
      );
    });

    await runTest("Logout invalidates session cookie (401 afterward)", async () => {
      const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
        method: "POST",
        headers: { Cookie: cookieA },
      });
      assert(logoutRes.status === 200, `Expected 200, got ${logoutRes.status}`);

      const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Cookie: cookieA },
      });
      assert(meRes.status === 401, `Expected 401 after logout, got ${meRes.status}`);
    });
  } finally {
    if (serverProc) {
      serverProc.kill();
    }

    // Clean up test users and related documents from MongoDB
    try {
      const client = new MongoClient(mongoUri, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
        },
      });
      await client.connect();
      const db = client.db(getDatabaseNameFromUri(mongoUri));
      const users = await db
        .collection("users")
        .find({ email: { $in: [userAEmail, userBEmail] } })
        .toArray();
      const userIds = users.map((u) => u._id);
      if (userIds.length > 0) {
        await db
          .collection("auth_sessions")
          .deleteMany({ userId: { $in: userIds } });
        await db
          .collection("practice_sessions")
          .deleteMany({ userId: { $in: userIds } });
        await db.collection("users").deleteMany({ _id: { $in: userIds } });
      }
      await client.close();
    } catch (cleanupErr) {
      console.error("Cleanup warning:", cleanupErr);
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
