# Data Interview Prep

[![CI](https://github.com/Oradixx/data-interview-prep/actions/workflows/ci.yml/badge.svg)](https://github.com/Oradixx/data-interview-prep/actions/workflows/ci.yml)

Practice questions for **data engineering, MLOps, DevOps and LLM** interviews: multiple-choice
questions and *put-the-steps-in-order* exercises on the processes and tools that come up in
interviews, each answer explained.

**▶ Try it: https://oradixx.github.io/data-interview-prep/**

## Features

- **12 themes in 4 groups:** SQL, data modeling, pipelines & orchestration, Spark, Kafka & streaming · ML fundamentals, MLOps · Docker & Kubernetes, Git & CI/CD, cloud · LLM foundations, RAG & agents.
- **Two exercise types:** single- or multiple-answer MCQs, and ordering exercises (drag and drop, or arrow buttons on mobile and keyboard).
- **An explanation for every answer:** the *why*, not just the right option.
- **Progress per theme** and a **"review mistakes"** mode, saved in your browser.
- Keyboard shortcuts (`1`–`6` to pick, `Enter` to check), dark mode, works on mobile.
- **Two visual styles**, switched from the header: *Clean* (light/dark) and *Neon* (animated aurora, glass cards, streak counter and a particle burst on correct answers). Animations are disabled when the system asks for reduced motion.

## How it works

A static site with no build step and no dependencies: HTML, CSS and vanilla JavaScript modules,
served by GitHub Pages.

```text
data/
├── themes.json              # groups and themes
└── questions/<theme>.json   # one file per theme
assets/
├── quiz.js                  # pure logic (scoring, shuffling, sessions) — unit-tested
├── app.js                   # rendering and interactions
├── styles.css               # clean style (light / dark)
└── neon.css                 # neon style
scripts/validate.mjs         # checks every question file (run in CI)
tests/quiz.test.mjs          # node --test
```

## Adding a question

Add an object to `data/questions/<theme>.json`:

```jsonc
{
  "id": "sql-my-question",          // must start with the theme id
  "type": "mcq",                    // or "order"
  "level": 2,                       // 1 junior · 2 intermediate · 3 advanced
  "question": "What does `COALESCE(a, b)` return?",
  "options": ["…", "…", "…"],       // mcq only, 2–6 options (shuffled when displayed)
  "answer": 1,                      // index, or [0, 2] for "Select all that apply"
  "explanation": "Why the answer is right."
}
```

For `"type": "order"`, replace `options` / `answer` with `"steps": [...]`, listed in the correct
order (they are scrambled when displayed). Wrap code in backticks.

Then check it:

```bash
node scripts/validate.mjs   # schema, unique ids, valid answers
node --test                 # quiz logic
python3 -m http.server      # open http://localhost:8000
```

Corrections and new questions are welcome: open an issue or a pull request.

## License

[MIT](LICENSE)
