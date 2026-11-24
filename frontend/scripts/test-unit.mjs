import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(__dirname, "..");
const srcDir = path.join(frontendDir, "src");

function collectTsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(full));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
      files.push(full);
    }
  }
  return files;
}

function compileLibModules(outDir) {
  const inputs = [
    ...collectTsFiles(path.join(srcDir, "lib", "nlp")),
    ...collectTsFiles(path.join(srcDir, "lib", "interview")),
  ];
  const options = {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
    skipLibCheck: true,
    outDir,
    rootDir: srcDir,
    baseUrl: frontendDir,
    paths: { "@/*": ["src/*"] },
  };
  const program = ts.createProgram(inputs, options);
  const emitResult = program.emit();
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics)
    .filter((d) => d.category === ts.DiagnosticCategory.Error);
  if (diagnostics.length > 0) {
    const msg = diagnostics
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"))
      .join("\n");
    throw new Error(`TypeScript compile failed:\n${msg}`);
  }
}

function runSuite(outDir) {
  const origResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain, options) {
    if (request.startsWith("@/")) {
      const mapped = path.join(outDir, request.slice(2));
      return origResolve.call(this, mapped, parent, isMain, options);
    }
    return origResolve.call(this, request, parent, isMain, options);
  };

  const require = Module.createRequire(import.meta.url);
  const { classifyStarSentence, analyzeStar } = require(
    path.join(outDir, "lib", "nlp", "star.js")
  );
  const { analyzeAnswer } = require(path.join(outDir, "lib", "nlp", "analyze.js"));
  const { computeAnswerMetrics, computeSessionMetrics } = require(
    path.join(outDir, "lib", "nlp", "sessionStore.js")
  );
  const { normalizeAiPayload } = require(
    path.join(outDir, "lib", "interview", "llmProvider.js")
  );
  const { buildOfflinePreparation } = require(
    path.join(outDir, "lib", "interview", "offlineGenerator.js")
  );

  // 1. STAR sentence classification (English + Bahasa Melayu + negated outcome guard)
  assert.equal(
    classifyStarSentence("During my internship, our checkout API kept timing out."),
    "situation"
  );
  assert.equal(
    classifyStarSentence("My responsibility was to reduce response latency."),
    "task"
  );
  assert.equal(
    classifyStarSentence("I debugged the SQL queries and optimized the indexes."),
    "action"
  );
  assert.equal(
    classifyStarSentence("As a result, latency dropped by 70% within two days."),
    "result"
  );
  assert.notEqual(
    classifyStarSentence("Kami masih tidak berjaya selesaikan isu itu lagi."),
    "result",
    "Negated 'tidak berjaya' must not classify as Result"
  );

  const bmStar = analyzeStar(
    "Semasa latihan industri, sistem kami menghadapi ralat. Tugas saya adalah menyemak log. Saya membaiki query SQL. Akhirnya sistem lebih laju dan stabil."
  );
  assert.equal(bmStar.sections.situation.found, true);
  assert.equal(bmStar.sections.task.found, true);
  assert.equal(bmStar.sections.action.found, true);
  assert.equal(bmStar.sections.result.found, true);

  // 2. Keyword & STAR combined analysis
  const analysis = analyzeAnswer(
    "During my FYP, the checkout database had high latency. My task was to fix slow Python SQL queries. I debugged the API and added unit testing. As a result, latency dropped by 60%.",
    {
      role: "Software Engineer",
      jobDescription: "Looking for Python, SQL, and Docker experience.",
      question: "Tell me about a performance issue you solved.",
      questionKeywords: ["Python", "SQL", "Docker"],
    }
  );
  assert.equal(analysis.star.situation.found, true);
  assert.equal(analysis.star.result.found, true);
  assert.ok(analysis.matchedCount >= 2, "Expected Python & SQL to match");
  assert.ok(analysis.missingCount >= 1, "Expected Docker to be missing");

  // 3. Session & answer metric weighting
  const textOnly = computeAnswerMetrics({
    question: "Q1",
    transcript: "During my internship my task was to debug SQL. I fixed it. As a result latency dropped 50%.",
    analysis,
    speech: null,
    vision: null,
  });
  assert.equal(textOnly.deliveryScore, null);
  assert.equal(textOnly.presenceScore, null);
  assert.equal(
    textOnly.overallScore,
    Math.round(textOnly.starScore * 0.85 + analysis.coverage * 0.15),
    "Text-only overallScore should blend STAR (85%) and keyword coverage (15%)"
  );

  // 3b. LLM semantic STAR evaluation rubric weighting
  const llmGraded = computeAnswerMetrics({
    question: "Q1",
    transcript: "During my internship my task was to debug SQL. I fixed it. As a result latency dropped 50%.",
    analysis: {
      ...analysis,
      llmEvaluation: {
        provider: "groq",
        model: "openai/gpt-oss-20b",
        pillarScores: { situation: 80, task: 70, action: 90, result: 88 },
        pillarFeedback: {
          situation: "Clear context.",
          task: "Clarify constraints.",
          action: "Strong technical detail.",
          result: "Quantified 50% gain.",
        },
        relevanceScore: 92,
        relevanceNote: "Directly answered.",
        ownershipNote: "Clear personal 'I' steps.",
        starProportion: { situation: 20, task: 15, action: 45, result: 20 },
        proportionFeedback: "Well balanced.",
        strongerRewrite: { targetPillar: "task", example: "My goal was to cut p95 latency under [X ms]." },
        topCoaching: ["Clarify SLA target in Task."],
      },
    },
    speech: null,
    vision: null,
  });
  assert.equal(llmGraded.starScore, 82); // (80+70+90+88)/4
  assert.equal(llmGraded.starPillarScores.action, 90);

  const multimodal = computeSessionMetrics([
    {
      question: "Q1",
      transcript: "During my internship my task was to debug SQL. I fixed it. As a result latency dropped 50%.",
      analysis,
      speech: {
        wpm: 140,
        fillersPerMin: 0.5,
        fillerCount: 1,
        fillers: ["um ×1"],
        longPauses: 0,
        fluencyScore: 92,
        durationSec: 60,
        transcript: "clean",
      },
      vision: {
        eyeContactScore: 88,
        postureScore: 92,
        eyeNudges: 0,
        postureNudges: 1,
        totalFrames: 100,
      },
    },
  ]);
  assert.equal(multimodal.deliveryScore, 92);
  assert.equal(multimodal.presenceScore, 87); // (88+92)/2 - 1*3

  // 4. Anti-hallucination verification in normalizeAiPayload
  const rawAiJson = JSON.stringify({
    tailorReport: {
      matchScore: 95,
      verdict: "Strong Fit",
      summary: "Candidate is strong in Python and Kubernetes.",
      matchedSkills: ["Python", "Kubernetes"], // Kubernetes is NOT in resume
      missingSkills: ["Docker"],
      tailoringTips: ["Mention Docker"],
    },
    questions: [
      {
        type: "resume_deep_dive",
        prompt: "Tell me about your Python REST API work in your final year project.",
        keywords: ["Python", "REST API"],
        rationale: "Probes real project experience.",
      },
    ],
  });
  const normalized = normalizeAiPayload(rawAiJson, {
    mode: "role",
    company: "",
    role: "Software Engineer",
    jobDescription: "Requires Python, Kubernetes, Docker.",
    resumeText: "Built a Python REST API for university clinic booking.",
    questionCount: 3,
  });
  assert.deepEqual(normalized.tailorReport.matchedSkills, ["Python"]);
  assert.ok(normalized.tailorReport.missingSkills.includes("Kubernetes"));
  assert.ok(
    (normalized.tailorReport.matchScore ?? 100) < 95,
    "Hallucinated skill must reduce matchScore"
  );
  assert.equal(normalized.questions.length, 3, "Should pad to requested questionCount");

  // 5. 3 / 5 / 7 question counts in offline preparation & AI padding
  for (const count of [3, 5, 7]) {
    const offline = buildOfflinePreparation({
      mode: "role",
      company: "",
      role: "Frontend Developer",
      jobDescription: "React, TypeScript, CSS, Testing, Accessibility",
      resumeText: "",
      experienceLevel: "internship",
      questionCount: count,
    });
    assert.equal(offline.questions.length, count, `Offline prep should return ${count} questions`);
    const uniquePrompts = new Set(offline.questions.map((q) => q.prompt));
    assert.equal(uniquePrompts.size, count, `Offline prep should return ${count} distinct questions`);
  }

  const padded7 = normalizeAiPayload(rawAiJson, {
    mode: "role",
    company: "",
    role: "Software Engineer",
    jobDescription: "Requires Python, Kubernetes, Docker.",
    resumeText: "Built a Python REST API for university clinic booking.",
    experienceLevel: "fresh_grad",
    questionCount: 7,
  });
  assert.equal(padded7.questions.length, 7, "Should support padding up to 7 questions");

  console.log("PASS  All unit tests (STAR, keywords, scoring, 3/5/7Q, LLM grounding)");
}

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "vokal-unit-"));
try {
  compileLibModules(outDir);
  runSuite(outDir);
} finally {
  fs.rmSync(outDir, { recursive: true, force: true });
}
