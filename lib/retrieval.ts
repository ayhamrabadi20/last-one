import { activeChunks, type Chunk } from "@/lib/knowledge";

const stopWords = new Set([
  "ما", "ماذا", "شو", "ايش", "كيف", "هل", "وين", "اين", "متي", "ليش", "لماذا", "كم",
  "من", "في", "فيه", "علي", "عن", "حول", "مع", "الي", "او", "ان", "اذا", "كان", "كانت", "هذا", "هذه",
  "هو", "هي", "الذي", "التي", "المتاحه", "المطلوبه", "اريد", "بدي", "حاب", "اعرف", "استفسر",
  "فتح", "افتح", "مشروع", "محل", "خدمه", "طلب", "شي", "اشي", "ممكن", "لازم", "بحاجه",
]);

const synonymGroups = [
  ["ايجار", "مستاجر", "عقد", "استيجار"],
  ["مالك", "مملوك", "ملكيه", "تملك"],
  ["وثيقه", "وثائق", "مستند", "مستندات", "اوراق", "متطلبات"],
  ["رخصه", "ترخيص", "مهن"],
  ["موسسه", "فرديه", "سجل", "تجاري", "تاسيس"],
  ["اجراء", "اجراءات", "خطوات", "معامله"],
  ["اشغال", "موقع", "بناء"],
  ["موافقه", "موافقات", "جهات"],
  ["غرفه", "تجاره", "صناعه", "اشتراك"],
  ["سند", "هويه", "الكترونيه", "تفعيل", "تطبيق"],
  ["تصنيف", "نشاط", "انشطه", "اقتصاديه", "غايات"],
  ["بوابه", "الكتروني", "اونلاين", "نظام"],
];

const arabicDigits = "٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹";
const latinDigits = "01234567890123456789";

export function normalizeArabic(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/ـ/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/[ؤ]/g, "و")
    .replace(/[ئىيی]/g, "ي")
    .replace(/[ةۀ]/g, "ه")
    .replace(/ک/g, "ك")
    .replace(/[٠-٩۰-۹]/g, (digit) => latinDigits[arabicDigits.indexOf(digit)] ?? digit)
    .replace(/(.)\1{2,}/gu, "$1$1")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lightStem(token: string) {
  let result = token;
  if (result.length >= 5) result = result.replace(/^(?:وبال|ولل|وال|بال|كال|فال|لل)/, "");
  if (result.length >= 5) result = result.replace(/^ال/, "");
  if (result.length >= 6) result = result.replace(/(?:يات|ات|ون|ين|يه|ها|هم|نا)$/, "");
  return result.length >= 3 ? result : token;
}

export function tokenizeArabic(value: string, removeStopWords = true) {
  const normalized = normalizeArabic(value);
  if (!normalized) return [];
  const result = new Set<string>();
  for (const raw of normalized.split(" ")) {
    if (raw.length < 2 || (removeStopWords && stopWords.has(raw))) continue;
    result.add(raw);
    const stem = lightStem(raw);
    if (stem !== raw && (!removeStopWords || !stopWords.has(stem))) result.add(stem);
  }
  return [...result];
}

function levenshteinWithinOne(left: string, right: string) {
  if (left === right) return true;
  if (Math.abs(left.length - right.length) > 1 || Math.min(left.length, right.length) < 4) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) { i += 1; j += 1; continue; }
    edits += 1;
    if (edits > 1) return false;
    if (left.length > right.length) i += 1;
    else if (right.length > left.length) j += 1;
    else { i += 1; j += 1; }
  }
  return edits + Number(i < left.length || j < right.length) <= 1;
}

function expandedQueryTerms(query: string) {
  const direct = tokenizeArabic(query);
  const weighted = new Map<string, number>();
  direct.forEach((term) => weighted.set(term, 1));
  for (const term of direct) {
    for (const group of synonymGroups) {
      const normalizedGroup = group.map(normalizeArabic);
      if (!normalizedGroup.includes(term) && !normalizedGroup.some((item) => lightStem(item) === term)) continue;
      for (const synonym of normalizedGroup) {
        if (!stopWords.has(synonym)) weighted.set(synonym, Math.max(weighted.get(synonym) ?? 0, 0.62));
      }
    }
  }
  return [...weighted.entries()].map(([term, weight]) => ({ term, weight }));
}

type IndexedChunk = {
  chunk: Chunk;
  terms: Map<string, number>;
  length: number;
  normalizedText: string;
};

function addTerms(target: Map<string, number>, value: string, weight: number) {
  for (const term of tokenizeArabic(value)) target.set(term, (target.get(term) ?? 0) + weight);
}

function indexChunk(chunk: Chunk): IndexedChunk {
  const terms = new Map<string, number>();
  addTerms(terms, chunk.text, 1);
  addTerms(terms, chunk.section, 1.8);
  addTerms(terms, chunk.topicTags.join(" "), 2.6);
  addTerms(terms, chunk.scope.join(" "), 1.2);
  return {
    chunk,
    terms,
    length: [...terms.values()].reduce((sum, value) => sum + value, 0),
    normalizedText: normalizeArabic(`${chunk.section} ${chunk.topicTags.join(" ")} ${chunk.text}`),
  };
}

function closestTerm(index: IndexedChunk, queryTerm: string) {
  if (index.terms.has(queryTerm)) return { term: queryTerm, similarity: 1 };
  if (queryTerm.length < 5) return null;
  const fuzzy = [...index.terms.keys()].find((term) => levenshteinWithinOne(queryTerm, term));
  return fuzzy ? { term: fuzzy, similarity: 0.55 } : null;
}

export function retrieve(
  question: string,
  options: { procedureId?: string; limit?: number; minimumScore?: number } = {},
) {
  const { procedureId, limit = 3, minimumScore = 1.25 } = options;
  const queryTerms = expandedQueryTerms(question);
  if (!queryTerms.length) return [];
  const directQueryTermCount = queryTerms.filter((item) => item.weight === 1).length;
  const documents = activeChunks()
    .filter((chunk) => !procedureId || chunk.procedureIds.includes(procedureId))
    .map(indexChunk);
  if (!documents.length) return [];
  const averageLength = documents.reduce((sum, item) => sum + item.length, 0) / documents.length;
  const normalizedQuestion = normalizeArabic(question);

  const ranked = documents
    .map((document) => {
      let score = 0;
      let directMatches = 0;
      const matchedTerms: string[] = [];
      for (const queryTerm of queryTerms) {
        const match = closestTerm(document, queryTerm.term);
        if (!match) continue;
        const documentFrequency = documents.filter((item) => closestTerm(item, queryTerm.term)).length;
        const idf = Math.log(1 + (documents.length - documentFrequency + 0.5) / (documentFrequency + 0.5));
        const frequency = document.terms.get(match.term) ?? 0.5;
        const denominator = frequency + 1.2 * (0.25 + 0.75 * (document.length / averageLength));
        score += queryTerm.weight * match.similarity * idf * ((frequency * 2.2) / denominator);
        matchedTerms.push(queryTerm.term);
        if (queryTerm.weight === 1) directMatches += 1;
      }
      const meaningfulPhrase = tokenizeArabic(normalizedQuestion).filter((term) => term.length >= 3).join(" ");
      if (meaningfulPhrase.length >= 7 && document.normalizedText.includes(meaningfulPhrase)) score += 1.5;
      const ownershipQuery = /(?:ملكيه|مالك|مملوك|تملك|سند التسجيل)/.test(normalizedQuestion);
      const ownershipEvidence = /(?:مالك|مملوك|سند التسجيل)/.test(document.normalizedText);
      if (ownershipQuery) score = ownershipEvidence ? score + 3 : score * 0.3;
      if (/دليل/.test(normalizedQuestion)) score = /دليل/.test(document.normalizedText) ? score + 2.5 : score * 0.3;
      // A synonym-only coincidence is insufficient; require a direct lexical
      // or one-edit match before evidence is eligible for the model.
      const directCoverage = directMatches / Math.max(1, directQueryTermCount);
      if (directMatches === 0 || (directQueryTermCount >= 3 && directMatches < 2 && directCoverage < 0.5 && score < 2.2)) score = 0;
      return { chunk: document.chunk, score, matchedTerms: [...new Set(matchedTerms)] };
    })
    .filter((item) => item.score >= minimumScore)
    .sort((left, right) => right.score - left.score);
  const topScore = ranked[0]?.score ?? 0;
  return ranked
    .filter((item) => item.score >= topScore * 0.42)
    .slice(0, limit);
}

export function hasKnowledgeMatch(question: string) {
  return retrieve(question, { limit: 1, minimumScore: 1.7 }).length > 0;
}
