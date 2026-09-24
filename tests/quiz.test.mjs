import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildSession,
  checkMcq,
  checkOrder,
  correctIndexes,
  isMultiple,
  mistakeIds,
  scrambledOrder,
  shuffle,
  shuffledOptions,
  summarize,
  updateProgress,
} from "../assets/quiz.js";

// Deterministic pseudo-random generator for reproducible tests.
function seeded(seed = 1) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

test("shuffle keeps every element and does not mutate the input", () => {
  const input = [1, 2, 3, 4, 5];
  const out = shuffle(input, seeded(3));
  assert.deepEqual([...out].sort(), [1, 2, 3, 4, 5]);
  assert.deepEqual(input, [1, 2, 3, 4, 5]);
});

test("single and multiple choice answers are normalised", () => {
  assert.deepEqual(correctIndexes({ answer: 2 }), [2]);
  assert.deepEqual(correctIndexes({ answer: [3, 0] }), [0, 3]);
  assert.equal(isMultiple({ type: "mcq", answer: [0, 2] }), true);
  assert.equal(isMultiple({ type: "mcq", answer: 1 }), false);
});

test("checkMcq requires the exact set of correct options", () => {
  const q = { type: "mcq", answer: [0, 2] };
  assert.equal(checkMcq(q, [2, 0]), true);
  assert.equal(checkMcq(q, [0]), false);
  assert.equal(checkMcq(q, [0, 1, 2]), false);
  assert.equal(checkMcq({ answer: 1 }, [1]), true);
});

test("checkOrder reports which positions are right", () => {
  assert.deepEqual(checkOrder({}, [0, 1, 2]), { correct: true, positions: [true, true, true] });
  assert.deepEqual(checkOrder({}, [0, 2, 1]), { correct: false, positions: [true, false, false] });
});

test("scrambledOrder is a permutation that is never already solved", () => {
  for (let seed = 1; seed < 200; seed++) {
    const order = scrambledOrder(4, seeded(seed));
    assert.deepEqual([...order].sort(), [0, 1, 2, 3]);
    assert.notDeepEqual(order, [0, 1, 2, 3]);
  }
  assert.deepEqual(scrambledOrder(1), [0]);
});

test("shuffledOptions keeps the original index of each option", () => {
  const opts = shuffledOptions({ options: ["a", "b", "c"] }, seeded(5));
  for (const o of opts) assert.equal(["a", "b", "c"][o.index], o.text);
});

test("buildSession filters by theme, mistakes and size", () => {
  const qs = [
    { id: "a1", theme: "a" },
    { id: "a2", theme: "a" },
    { id: "b1", theme: "b" },
  ];
  assert.equal(buildSession(qs, { themes: ["a"], size: 0 }).length, 2);
  assert.equal(buildSession(qs, { themes: ["a", "b"], size: 2 }).length, 2);
  const only = buildSession(qs, { themes: ["a", "b"], size: 0, onlyIds: new Set(["b1"]) });
  assert.deepEqual(only.map((q) => q.id), ["b1"]);
});

test("summarize counts per theme", () => {
  const s = summarize([
    { theme: "sql", correct: true },
    { theme: "sql", correct: false },
    { theme: "spark", correct: true },
  ]);
  assert.equal(s.correct, 2);
  assert.equal(s.total, 3);
  assert.deepEqual(s.byTheme.sql, { correct: 1, total: 2 });
});

test("progress tracks the last result, and mistakes come from it", () => {
  let p = updateProgress({}, [{ id: "q1", correct: false }, { id: "q2", correct: true }], 1);
  assert.deepEqual([...mistakeIds(p)], ["q1"]);
  p = updateProgress(p, [{ id: "q1", correct: true }], 2);
  assert.equal(mistakeIds(p).size, 0);
  assert.deepEqual(p.q1, { seen: 2, correct: 1, last: "right", at: 2 });
});
