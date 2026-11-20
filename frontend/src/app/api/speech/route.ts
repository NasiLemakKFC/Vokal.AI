/**
 * Proxy from the browser to the Python speech backend (Modules 2 and 5).
 * The browser calls /api/speech. This file forwards the audio to FastAPI.
 * Benefits: no CORS setup, and the backend address stays in .env.local.
 */
export async function POST(req: Request) {
  const backend = process.env.FASTAPI_BACKEND_URL ?? "http://localhost:8000";

  try {
    const form = await req.formData();
    const upstream = await fetch(`${backend}/analyze-speech`, { method: "POST", body: form });
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return Response.json(
      { detail: "Speech server is not reachable. Start it with: uvicorn main:app --port 8000" },
      { status: 502 }
    );
  }
}
