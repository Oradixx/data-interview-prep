// Pure quiz logic — no DOM, so it can be unit-tested with `node --test`.

/** Fisher–Yates shuffle returning a new array. `random` is injectable for tests. */
export function shuffle(items, random = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Normalise `answer` to a sorted array of option indexes (single or multiple choice). */
export function correctIndexes(question) {
  const a = question.answer;
  return (Array.isArray(a) ? [...a] : [a]).sort((x, y) => x - y);
}

export function isMultiple(question) {
  return question.type === "mcq" && Array.isArray(question.answer) && question.answer.length > 1;
}

/** MCQ: exact match between selected and correct option indexes (order-insensitive). */
export function checkMcq(question, selected) {
  const want = correctIndexes(question);
  const got = [...new Set(selected)].sort((x, y) => x - y);
  return want.length === got.length && want.every((v, i) => v === got[i]);
}

/**
 * Ordering: `order` is the list of step indexes as placed by the user
 * (the correct order is 0, 1, 2, …). Returns overall success + per-position feedback.
 */
export function checkOrder(question, order) {
  const positions = order.map((stepIndex, position) => stepIndex === position);
  return { correct: positions.every(Boolean), positions };
}

/** A shuffled starting order that is never already the solution (when that is possible). */
export function scrambledOrder(length, random = Math.random) {
  const identity = Array.from({ length }, (_, i) => i);
  if (length < 2) return identity;
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = shuffle(identity, random);
    if (candidate.some((v, i) => v !== i)) return candidate;
  }
  return [...identity.slice(1), identity[0]]; // rotate as a last resort
}

/** Options are displayed shuffled; returns [{text, index}] where index is the original position. */
export function shuffledOptions(question, random = Math.random) {
  return shuffle(
    question.options.map((text, index) => ({ text, index })),
    random,
  );
}

/**
 * Build a session: pick questions from the chosen themes, optionally only past mistakes,
 * shuffle, and cut to `size` (0 = all).
 */
export function buildSession(questions, { themes, size = 10, onlyIds = null, random = Math.random }) {
  let pool = questions.filter((q) => themes.includes(q.theme));
  if (onlyIds) pool = pool.filter((q) => onlyIds.has(q.id));
  const picked = shuffle(pool, random);
  return size > 0 ? picked.slice(0, size) : picked;
}

/** Score summary for a finished session: overall and per theme. */
export function summarize(results) {
  const byTheme = {};
  for (const r of results) {
    byTheme[r.theme] ??= { correct: 0, total: 0 };
    byTheme[r.theme].total += 1;
    if (r.correct) byTheme[r.theme].correct += 1;
  }
  const correct = results.filter((r) => r.correct).length;
  return { correct, total: results.length, byTheme };
}

/** Merge a session's results into stored progress: { [questionId]: { seen, correct, last } }. */
export function updateProgress(progress, results, now = Date.now()) {
  const next = { ...progress };
  for (const r of results) {
    const prev = next[r.id] ?? { seen: 0, correct: 0, last: null };
    next[r.id] = {
      seen: prev.seen + 1,
      correct: prev.correct + (r.correct ? 1 : 0),
      last: r.correct ? "right" : "wrong",
      at: now,
    };
  }
  return next;
}

/** Ids of questions whose most recent attempt was wrong. */
export function mistakeIds(progress) {
  return new Set(Object.entries(progress).filter(([, p]) => p.last === "wrong").map(([id]) => id));
}
