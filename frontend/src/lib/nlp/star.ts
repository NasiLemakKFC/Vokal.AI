import { splitSentences } from "./text";
import type { AnswerSentence, StarKey, StarSection } from "./types";

const labels: Record<StarKey, string> = { situation: "Situation", task: "Task", action: "Action", result: "Result" };
const hints: Record<StarKey, string> = {
  situation: "Explain the background, challenge and context of the example.",
  task: "Describe your personal responsibility and objective.",
  action: "Describe the concrete steps you personally took and the tools you used.",
  result: "Explain the outcome and include measurable impact where possible.",
};
// These patterns are transparent heuristics, not a semantic model. Explicit outcome
// phrases take precedence over action verbs (e.g. 'we successfully completed').
const outcome = /\b(as a result|consequently|ultimately|in the end|the outcome|resulted in|led to|achieved|reduced|increased|saved|received (?:positive )?feedback|successfully (?:completed|delivered|resolved|launched)|(?:we|i) (?:successfully )?(?:completed|delivered|finished) (?:the|our|my) (?:project|application|solution)|\d+(?:\.\d+)?\s*(?:%|peratus)\s*(?:improvement|reduction|increase|penurunan|peningkatan|penjimatan|lebih\s+(?:laju|pantas|cepat))|(?:response|processing|load|masa)\s*(?:time|tindak balas|proses)?\s+(?:decreased|dropped|fell|improved|turun|berkurang|menurun|meningkat|lebih\s+(?:laju|pantas|cepat))|(?:system|application|website) (?:became|was now) (?:faster|stable|operational)|hasilnya|akhirnya|kesannya|akibatnya|natijahnya|kesimpulannya|sebagai hasilnya|dapat selesaikan|selesai dengan baik|siap tepat pada masa|siap sebelum (?:deadline|tarikh akhir)|berkurang|menurun|meningkat|bertambah|menjimatkan|lebih (?:laju|pantas|cepat|stabil|lancar|baik)|berfungsi semula|kembali normal|tiada lagi (?:ralat|error|bug|masalah)|(?:dapat|menerima)\s+maklum balas(?:\s+positif)?|maklum balas positif|puas hati|mendapat pujian)\b/i;
const negatedBerjaya = /\b(?:tidak|tak|belum)\s+berjaya\b/gi;
const responsibility = /\b(i was responsible|my (?:role|task|responsibility|objective|goal)|i (?:needed|had) to|i was (?:assigned|tasked)|the (?:goal|objective) was|my target|i was in charge|i was asked to|(?:tugas|tanggungjawab|peranan|matlamat|objektif|sasaran|target)\s+(?:saya|kami|utama)|(?:saya|kami)\s+(?:telah\s+)?(?:ditugaskan|dipertanggungjawabkan|diminta|diarahkan|bertanggungjawab)|(?:saya|kami)\s+(?:perlu|kena|mesti|harus|patut)\s+(?:untuk\s+)?(?:selesaikan|menyelesaikan|baiki|membaiki|betulkan|membetulkan|cari|mencari|semak|menyemak|buat|membuat|siapkan|menyiapkan|pastikan|memastikan|bina|membina|bangunkan|membangunkan|uji|menguji|handle|fix|debug|test|check|resolve|deliver|complete|automate|solve|update|deploy|investigate)|(?:matlamat|objektif|tujuan)\s+(?:kami|saya|projek|utama|sistem)?\s*(?:adalah|ialah)|(?:saya|kami)\s+(?:in charge|jaga|pegang)\s+(?:bahagian|modul|part|backend|frontend|database|projek|sistem))\b/i;
const pronoun = /\b(?:i|we|saya|kami|aku)\b/i;
const UNAMBIGUOUS_ACTION_VERBS = [
  // English past / gerund / irregular action verbs
  "started (?:by|with)", "began (?:by|with)", "debugg(?:ed|ing)",
  "investigat(?:ed|ing)", "identif(?:ied|ying)", "creat(?:ed|ing)",
  "built", "develop(?:ed|ing)", "implement(?:ed|ing)", "design(?:ed|ing)",
  "test(?:ed|ing)", "fix(?:ed|ing)", "resolv(?:ed|ing)",
  "led", "coordinat(?:ed|ing)", "communicat(?:ed|ing)", "discuss(?:ed|ing)",
  "listen(?:ed|ing)", "explain(?:ed|ing)", "compar(?:ed|ing)", "propos(?:ed|ing)",
  "negotiat(?:ed|ing)", "check(?:ed|ing)", "review(?:ed|ing)", "automat(?:ed|ing)",
  "organiz(?:ed|ing)", "optimiz(?:ed|ing)", "optimised",
  "analys(?:ed|ing)", "analyz(?:ed|ing)", "us(?:ed|ing)", "work(?:ed|ing)",
  "collaborat(?:ed|ing)", "manag(?:ed|ing)", "troubleshoot(?:ing)?", "troubleshot",
  "deploy(?:ed|ing)", "wrote", "configured", "discover(?:ed|ing)",
  "found", "made", "updated", "refactor(?:ed|ing)", "perform(?:ed|ing)",
  "solv(?:ed|ing)", "research(?:ed|ing)", "monitor(?:ed|ing)", "handled",
  // Bahasa Melayu unambiguous action verbs (excludes noun/pronoun collisions like reka/mereka/kesan/analisis)
  "membuat", "membina", "bina", "membangunkan", "bangunkan", "mencipta", "cipta",
  "menyelesaikan", "selesaikan", "membaiki", "memperbaiki", "baiki",
  "membetulkan", "betulkan", "memulihkan", "pulihkan",
  "menyemak", "semak", "memeriksa", "periksa", "menyiasat", "siasat",
  "mengkaji", "kaji", "menyelidik", "selidik", "menganalisis",
  "mengenal\\s+pasti", "kenal\\s+pasti", "mengesan",
  "mencari", "cari", "menjumpai", "jumpa", "menemui", "temui",
  "menguji", "uji", "melaksanakan", "laksanakan", "menjalankan", "jalankan",
  "memasang", "pasang", "mengkonfigurasi",
  "mengemas\\s+kini", "kemas\\s+kini", "mengubah\\s+suai", "ubah\\s+suai",
  "mengoptimumkan", "optimumkan", "mengautomasikan",
  "memantau", "pantau", "berbincang", "membincangkan", "bincang",
  "mencadangkan", "cadangkan", "menerangkan", "terangkan",
  "menjelaskan", "jelaskan", "mendengar", "dengar",
  "membandingkan", "bandingkan", "berunding", "runding",
  "berkomunikasi", "bekerjasama",
  "menulis", "tulis", "menggunakan", "gunakan",
  "menguruskan", "mengurus", "uruskan", "menyusun", "susun",
  "merancang", "rancang", "menyelaraskan", "menyelaras", "selaraskan",
  "mengetuai", "ketuai", "memimpin", "pimpin", "membantu", "bantu",
  "menyediakan", "sediakan", "menambah\\s+baik", "tambah\\s+baik",
].join("|");
// Base forms commonly used in Manglish/rojak (e.g. "saya check", "kami fix") are
// restricted to direct pronoun-immediately-before-verb matches so nouns like "the design" don't false-trigger.
const ROJAK_DIRECT_ACTION_VERBS = [
  UNAMBIGUOUS_ACTION_VERBS,
  "debug", "fix", "check", "test", "build", "create", "develop", "implement",
  "design", "resolve", "solve", "investigate", "identify", "deploy", "update",
  "review", "automate", "optimize", "optimise", "analyze", "analyse",
  "refactor", "monitor", "configure", "propose", "discuss", "explain",
  "compare", "coordinate", "collaborate", "manage", "troubleshoot",
  "write", "handle", "rollback", "buat",
].join("|");
const personalAction = new RegExp(
  `\\b(?:i|we|saya|kami|aku)\\s+(?:(?:also|then|personally|first|next|subsequently|carefully|mula-mula|pertama|kemudian|lepas\\s+tu|selepas\\s+itu|terus|cuba|telah|sudah|dah|pun|juga|secara\\s+peribadi)\\s+)*(?:${ROJAK_DIRECT_ACTION_VERBS})\\b`,
  "i"
);
const actionVerb = new RegExp(`\\b(?:${UNAMBIGUOUS_ACTION_VERBS})\\b`, "i");
const context = /\b(during|in my previous|in a previous|when i was|at the time|our team (?:was|had|developed|experienced)|the (?:project|company|system|website) (?:was|had|experienced)|there was|we (?:had|faced|experienced)|faced|experienced|working on|before the (?:presentation|launch)|semasa|ketika|masa\s+(?:tu|itu|saya|kami|internship|latihan\s+industri|fyp|projek|kerja)|waktu\s+(?:tu|itu|saya|kami|internship|fyp|projek|kerja)|pada\s+(?:masa\s+itu|waktu\s+itu|awalnya|mulanya)|sebelum\s+(?:ni|ini|presentation|pembentangan|pelancaran|launch|deadline|tarikh\s+akhir)|dulu\s+(?:masa|waktu|saya|kami)|projek\s+(?:sebelum|lepas|terdahulu)|(?:kami|saya|pasukan\s+kami|team\s+kami|sistem|aplikasi|laman\s+web|projek|syarikat)\s+(?:telah\s+)?(?:menghadapi|hadapi|mengalami|alami|terkena|ada\s+masalah|berdepan)|berlaku\s+(?:masalah|ralat|error|bug|gangguan|konflik|perselisihan|kerosakan)|(?:terdapat|ada)\s+(?:masalah|ralat|error|bug|isu|konflik|perselisihan)|tidak\s+sependapat|percanggahan\s+pendapat|berselisih\s+faham|salah\s+faham)\b/i;

function isOutcomeSentence(sentence: string): boolean {
  if (outcome.test(sentence)) return true;
  const withoutNegated = sentence.replace(negatedBerjaya, "");
  return /\bberjaya\b/i.test(withoutNegated);
}

export function classifyStarSentence(sentence: string): StarKey | "unclassified" {
  if (isOutcomeSentence(sentence)) return "result";
  if (responsibility.test(sentence)) return "task";
  if (personalAction.test(sentence) || (pronoun.test(sentence) && actionVerb.test(sentence))) return "action";
  if (context.test(sentence)) return "situation";
  return "unclassified";
}

export function analyzeStar(answer: string): { sections: Record<StarKey, StarSection>; sentences: AnswerSentence[] } {
  const sentences: AnswerSentence[] = splitSentences(answer).map(text => ({ text, section: classifyStarSentence(text) }));
  const keys: StarKey[] = ["situation", "task", "action", "result"];
  const sections = {} as Record<StarKey, StarSection>;
  for (const key of keys) {
    const examples = sentences.filter(s => s.section === key).map(s => s.text);
    sections[key] = {
      found: examples.length > 0,
      sentences: examples,
      explanation: examples.length ? `Detected ${examples.length} ${labels[key].toLowerCase()} sentence${examples.length === 1 ? "" : "s"} based on language cues.` : `No clear ${labels[key].toLowerCase()} statement was detected.`,
      suggestion: examples.length ? (key === "result" ? "If possible, support the outcome with specific numbers or evidence." : `Your ${labels[key].toLowerCase()} is present; add detail if it helps explain your contribution.`) : hints[key],
    };
  }
  return { sections, sentences };
}
