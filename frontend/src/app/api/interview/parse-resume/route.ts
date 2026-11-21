import { extractText } from "unpdf";

const MAX_PDF_BYTES = 5 * 1024 * 1024;
const MIN_TEXT_CHARS = 40;

function cleanPdfText(raw: string): string {
  return raw
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ detail: "Invalid multipart form data." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ detail: "Please attach a PDF file." }, { status: 400 });
  }

  const fileName = file.name || "resume.pdf";
  const isPdf =
    file.type === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return Response.json(
      { detail: "Only .pdf files are supported. You can also paste your resume text." },
      { status: 400 }
    );
  }

  if (file.size === 0) {
    return Response.json({ detail: "The uploaded PDF file is empty." }, { status: 422 });
  }

  if (file.size > MAX_PDF_BYTES) {
    return Response.json(
      { detail: "PDF is too large (limit 5 MB)." },
      { status: 413 }
    );
  }

  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const { text: rawText, totalPages } = await extractText(bytes, {
      mergePages: true,
    });
    const text = cleanPdfText(rawText);

    if (text.length < MIN_TEXT_CHARS) {
      return Response.json(
        {
          detail:
            "No selectable text found in this PDF (it may be a scanned image). Please paste your resume text instead.",
        },
        { status: 422 }
      );
    }

    return Response.json(
      {
        text,
        pageCount: totalPages,
        charCount: text.length,
        fileName,
      },
      { status: 200 }
    );
  } catch {
    return Response.json(
      {
        detail:
          "Could not read this PDF file. Please verify it is not password-protected or paste your resume text instead.",
      },
      { status: 422 }
    );
  }
}
