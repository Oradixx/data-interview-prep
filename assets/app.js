import {
  buildSession,
  checkMcq,
  checkOrder,
  correctIndexes,
  isMultiple,
  mistakeIds,
  scrambledOrder,
  shuffledOptions,
  summarize,
  updateProgress,
} from "./quiz.js";

const app = document.getElementById("app");
const LEVELS = { 1: "junior", 2: "intermediate", 3: "advanced" };
const SIZES = [10, 20, 0];

// ---------------------------------------------------------------- storage
// Progress lives in this browser only. Every access is guarded: storage can be
// unavailable (private mode, blocked cookies) and the app must still work.
const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
};

// ---------------------------------------------------------------- helpers
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
/** Escape, then render `inline code`. */
const fmt = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");
const icon = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>',
  grip: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
};

// ---------------------------------------------------------------- state
const state = {
  groups: [],
  themes: [],
  questions: [],
  progress: store.get("dip.progress", {}),
  selected: new Set(store.get("dip.selected", [])),
  size: store.get("dip.size", 10),
  screen: "home",
  session: [],
  index: 0,
  results: [],
  current: null, // per-question UI state
};

const themeById = (id) => state.themes.find((t) => t.id === id);

async function load() {
  const meta = await fetch("data/themes.json").then((r) => r.json());
  state.groups = meta.groups;
  state.themes = meta.themes;
  const files = await Promise.all(
    meta.themes.map((t) => fetch(`data/questions/${t.id}.json`).then((r) => r.json())),
  );
  state.questions = files.flatMap((f) => f.questions.map((q) => ({ ...q, theme: f.theme })));
  if (!state.selected.size) state.selected = new Set(meta.themes.map((t) => t.id));
  // drop saved themes that no longer exist
  state.selected = new Set([...state.selected].filter((id) => themeById(id)));
}

// ---------------------------------------------------------------- home
function mastery(themeId) {
  const qs = state.questions.filter((q) => q.theme === themeId);
  const right = qs.filter((q) => state.progress[q.id]?.last === "right").length;
  return { right, total: qs.length };
}

function renderHome() {
  state.screen = "home";
  const selectedMistakes = [...mistakeIds(state.progress)].filter((id) => {
    const q = state.questions.find((x) => x.id === id);
    return q && state.selected.has(q.theme);
  });
  const nOrder = state.questions.filter((q) => q.type === "order").length;
  const selectedCount = state.questions.filter((q) => state.selected.has(q.theme)).length;

  app.innerHTML = `
    <section class="hero">
      <p class="eyebrow mono">Interview practice · data · MLOps · DevOps · LLMs</p>
      <h1>Data Interview Prep</h1>
      <p class="lead">Multiple-choice questions and "put the steps in order" exercises on the processes and tools
      that come up in data interviews — each answer explained.</p>
      <div class="stats mono">
        <span><b>${state.questions.length}</b> questions</span>
        <span><b>${state.themes.length}</b> themes</span>
        <span><b>${nOrder}</b> ordering exercises</span>
      </div>
    </section>
    ${state.groups
      .map((g) => {
        const themes = state.themes.filter((t) => t.group === g.id);
        const allOn = themes.every((t) => state.selected.has(t.id));
        return `
        <section class="group">
          <div class="group-head">
            <h2>${esc(g.title)}</h2>
            <button class="link-btn" data-group="${g.id}" data-on="${allOn ? 0 : 1}">${allOn ? "Deselect all" : "Select all"}</button>
          </div>
          <div class="themes">
            ${themes
              .map((t) => {
                const m = mastery(t.id);
                const pct = m.total ? Math.round((100 * m.right) / m.total) : 0;
                return `
                <button class="theme" type="button" data-theme="${t.id}" aria-pressed="${state.selected.has(t.id)}">
                  <span class="check" aria-hidden="true">${icon.check}</span>
                  <span class="t-title">${esc(t.title)}</span>
                  <span class="t-desc">${esc(t.description)}</span>
                  <span class="t-meta mono"><span>${m.total} questions</span><span>${m.right}/${m.total} mastered</span></span>
                  <span class="meter" aria-hidden="true"><i style="width:${pct}%"></i></span>
                </button>`;
              })
              .join("")}
          </div>
        </section>`;
      })
      .join("")}
    <div class="launch">
      <div class="row">
        <span class="seg" role="group" aria-label="Session length">
          ${SIZES.map((n) => `<button type="button" data-size="${n}" aria-pressed="${state.size === n}">${n || "All"}</button>`).join("")}
        </span>
        <span class="mono" style="font-size:13px;color:var(--muted)">${selectedCount} in selection</span>
      </div>
      <div class="row">
        <button class="btn ghost" id="reviewBtn" ${selectedMistakes.length ? "" : "disabled"}>Review mistakes (${selectedMistakes.length})</button>
        <button class="btn primary" id="startBtn" ${selectedCount ? "" : "disabled"}>Start</button>
      </div>
    </div>
    <p class="footnote">Progress is saved in this browser only.
      <button class="link-btn" id="resetBtn">Reset progress</button></p>`;

  app.querySelectorAll("[data-theme]").forEach((el) =>
    el.addEventListener("click", () => {
      const id = el.dataset.theme;
      state.selected.has(id) ? state.selected.delete(id) : state.selected.add(id);
      store.set("dip.selected", [...state.selected]);
      renderHome();
    }),
  );
  app.querySelectorAll("[data-group]").forEach((el) =>
    el.addEventListener("click", () => {
      const on = el.dataset.on === "1";
      state.themes
        .filter((t) => t.group === el.dataset.group)
        .forEach((t) => (on ? state.selected.add(t.id) : state.selected.delete(t.id)));
      store.set("dip.selected", [...state.selected]);
      renderHome();
    }),
  );
  app.querySelectorAll("[data-size]").forEach((el) =>
    el.addEventListener("click", () => {
      state.size = Number(el.dataset.size);
      store.set("dip.size", state.size);
      renderHome();
    }),
  );
  app.querySelector("#startBtn").addEventListener("click", () => start());
  app.querySelector("#reviewBtn").addEventListener("click", () => start({ onlyIds: new Set(selectedMistakes) }));
  app.querySelector("#resetBtn").addEventListener("click", () => {
    state.progress = {};
    store.set("dip.progress", {});
    renderHome();
  });
}

// ---------------------------------------------------------------- quiz
function start({ onlyIds = null, questions = null } = {}) {
  state.session =
    questions ??
    buildSession(state.questions, {
      themes: [...state.selected],
      size: onlyIds ? 0 : state.size,
      onlyIds,
    });
  if (!state.session.length) return;
  state.index = 0;
  state.results = [];
  renderQuestion();
  window.scrollTo(0, 0);
}

function renderQuestion() {
  state.screen = "quiz";
  const q = state.session[state.index];
  const multi = isMultiple(q);
  state.current = {
    answered: false,
    selected: new Set(),
    options: q.type === "mcq" ? shuffledOptions(q) : null,
    order: q.type === "order" ? scrambledOrder(q.steps.length) : null,
  };
  const n = state.session.length;
  const theme = themeById(q.theme);

  const body =
    q.type === "mcq"
      ? `<p class="hint">${multi ? "Select all that apply." : "Choose one answer."}</p>
         <div class="options" id="options">
           ${state.current.options
             .map(
               (o, i) => `
             <button class="option${multi ? " multi" : ""}" type="button" data-opt="${o.index}" aria-pressed="false">
               <span class="key">${i + 1}</span><span>${fmt(o.text)}</span>
             </button>`,
             )
             .join("")}
         </div>`
      : `<p class="hint">Drag the steps, or use the arrows, to put them in the right order.</p>
         <ol class="steps" id="steps">
           ${state.current.order
             .map(
               (s) => `
             <li class="step" data-step="${s}">
               <span class="num"></span>
               <span class="txt">${fmt(q.steps[s])}</span>
               <span class="moves">
                 <button type="button" data-move="-1" aria-label="Move up">${icon.up}</button>
                 <button type="button" data-move="1" aria-label="Move down">${icon.down}</button>
               </span>
               <span class="grip" aria-hidden="true">${icon.grip}</span>
             </li>`,
             )
             .join("")}
         </ol>`;

  app.innerHTML = `
    <section class="quiz">
      <div class="progress mono">
        <span>${state.index + 1} / ${n}</span>
        <span class="bar"><i style="width:${(100 * state.index) / n}%"></i></span>
        <button class="link-btn" id="quitBtn">Quit</button>
      </div>
      <div class="q-meta mono">
        <span class="pill">${esc(theme.title)}</span>
        <span class="pill level">${LEVELS[q.level]}</span>
        ${q.type === "order" ? '<span class="pill level">ordering</span>' : ""}
      </div>
      <h2 class="q-text">${fmt(q.question)}</h2>
      ${body}
      <div id="feedback"></div>
      <div class="actions">
        <span class="kbd-hint">${q.type === "mcq" ? "<kbd>1</kbd>–<kbd>" + q.options.length + "</kbd> select · " : ""}<kbd>Enter</kbd> check / next</span>
        <button class="btn primary" id="mainBtn" ${q.type === "mcq" ? "disabled" : ""}>Check</button>
      </div>
    </section>`;

  app.querySelector("#quitBtn").addEventListener("click", () => (state.results.length ? renderResults() : renderHome()));
  app.querySelector("#mainBtn").addEventListener("click", onMain);

  if (q.type === "mcq") {
    app.querySelectorAll("[data-opt]").forEach((el) => el.addEventListener("click", () => toggleOption(Number(el.dataset.opt))));
  } else {
    setupSteps();
  }
}

function toggleOption(optIndex) {
  const q = state.session[state.index];
  const cur = state.current;
  if (cur.answered) return;
  if (isMultiple(q)) {
    cur.selected.has(optIndex) ? cur.selected.delete(optIndex) : cur.selected.add(optIndex);
  } else {
    cur.selected = new Set([optIndex]);
  }
  app.querySelectorAll("[data-opt]").forEach((el) =>
    el.setAttribute("aria-pressed", String(cur.selected.has(Number(el.dataset.opt)))),
  );
  app.querySelector("#mainBtn").disabled = cur.selected.size === 0;
}

// ---- ordering: arrows + pointer drag (works with mouse and touch)
function setupSteps() {
  const list = app.querySelector("#steps");
  const refresh = () => {
    [...list.children].forEach((li, i) => {
      li.querySelector(".num").textContent = `${i + 1}.`;
      const [up, down] = li.querySelectorAll("[data-move]");
      up.disabled = i === 0;
      down.disabled = i === list.children.length - 1;
    });
  };
  list.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-move]");
    if (!btn || state.current.answered) return;
    const li = btn.closest(".step");
    if (btn.dataset.move === "-1" && li.previousElementSibling) list.insertBefore(li, li.previousElementSibling);
    if (btn.dataset.move === "1" && li.nextElementSibling) list.insertBefore(li.nextElementSibling, li);
    refresh();
    btn.focus();
  });

  // Pointer drag on the grip. Move/up listeners go on window so the drag keeps
  // working even when the pointer leaves the grip (mouse and touch alike).
  list.querySelectorAll(".grip").forEach((grip) => {
    grip.addEventListener("pointerdown", (e) => {
      if (state.current.answered || e.button > 0) return;
      e.preventDefault();
      const li = grip.closest(".step");
      li.classList.add("dragging");
      const move = (ev) => {
        const siblings = [...list.children].filter((x) => x !== li);
        const target = siblings.find((s) => {
          const r = s.getBoundingClientRect();
          return ev.clientY < r.top + r.height / 2;
        });
        if (target !== li.nextElementSibling) {
          target ? list.insertBefore(li, target) : list.appendChild(li);
          refresh();
        }
      };
      const end = () => {
        li.classList.remove("dragging");
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    });
  });
  refresh();
}

function onMain() {
  if (state.current.answered) return next();
  const q = state.session[state.index];
  if (q.type === "mcq" && !state.current.selected.size) return;
  check();
}

function check() {
  const q = state.session[state.index];
  const cur = state.current;
  cur.answered = true;
  let correct;
  let detail = "";

  if (q.type === "mcq") {
    correct = checkMcq(q, [...cur.selected]);
    const want = new Set(correctIndexes(q));
    app.querySelectorAll("[data-opt]").forEach((el) => {
      const i = Number(el.dataset.opt);
      el.disabled = true;
      el.setAttribute("aria-pressed", "false");
      if (want.has(i)) el.classList.add("right");
      else if (cur.selected.has(i)) el.classList.add("wrong");
    });
  } else {
    const list = app.querySelector("#steps");
    const order = [...list.children].map((li) => Number(li.dataset.step));
    const res = checkOrder(q, order);
    correct = res.correct;
    list.classList.add("locked");
    [...list.children].forEach((li, i) => li.classList.add(res.positions[i] ? "right" : "wrong"));
    if (!correct) detail = `<ol>${q.steps.map((s) => `<li>${fmt(s)}</li>`).join("")}</ol>`;
  }

  const result = { id: q.id, theme: q.theme, correct };
  state.results.push(result);
  state.progress = updateProgress(state.progress, [result]);
  store.set("dip.progress", state.progress);

  const fb = app.querySelector("#feedback");
  fb.innerHTML = `
    <div class="feedback ${correct ? "good" : "bad"}">
      <p class="verdict">${correct ? "Correct" : q.type === "order" ? "Not quite — the right order is:" : "Not quite"}</p>
      ${detail}
      <p style="margin-top:${detail ? "12px" : "0"}">${fmt(q.explanation)}</p>
    </div>`;
  const btn = app.querySelector("#mainBtn");
  btn.disabled = false;
  btn.textContent = state.index + 1 < state.session.length ? "Next" : "See results";
  btn.focus({ preventScroll: true });
  fb.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

function next() {
  if (state.index + 1 < state.session.length) {
    state.index += 1;
    renderQuestion();
    window.scrollTo(0, 0);
  } else {
    renderResults();
  }
}

// ---------------------------------------------------------------- results
function answerText(q) {
  return q.type === "mcq"
    ? correctIndexes(q).map((i) => fmt(q.options[i])).join("<br>")
    : `<ol>${q.steps.map((s) => `<li>${fmt(s)}</li>`).join("")}</ol>`;
}

function renderResults() {
  state.screen = "results";
  const s = summarize(state.results);
  const pct = s.total ? Math.round((100 * s.correct) / s.total) : 0;
  const missed = state.results.filter((r) => !r.correct).map((r) => state.questions.find((q) => q.id === r.id));
  const verdict =
    pct >= 85 ? "Interview-ready on these topics." : pct >= 60 ? "Solid — review the misses below." : "Worth another pass on these themes.";

  app.innerHTML = `
    <section class="results">
      <p class="eyebrow mono">Session complete</p>
      <p class="score">${s.correct}<small> / ${s.total}</small></p>
      <p class="lead">${pct}% — ${verdict}</p>
      <div class="breakdown">
        ${Object.entries(s.byTheme)
          .map(
            ([id, t]) => `
          <div class="bd-row">
            <span>${esc(themeById(id).title)}</span>
            <span class="bar"><i style="width:${(100 * t.correct) / t.total}%"></i></span>
            <span class="n mono">${t.correct}/${t.total}</span>
          </div>`,
          )
          .join("")}
      </div>
      <div class="row">
        ${missed.length ? `<button class="btn primary" id="retryBtn">Retry the ${missed.length} missed</button>` : ""}
        <button class="btn${missed.length ? "" : " primary"}" id="againBtn">New session</button>
        <button class="btn ghost" id="homeBtn">Change themes</button>
      </div>
      ${
        missed.length
          ? `<div class="missed"><h2>To review</h2>
          ${missed
            .map(
              (q) => `
            <details>
              <summary>${fmt(q.question)}</summary>
              <p class="ans">${answerText(q)}</p>
              <p>${fmt(q.explanation)}</p>
            </details>`,
            )
            .join("")}</div>`
          : ""
      }
    </section>`;

  app.querySelector("#retryBtn")?.addEventListener("click", () => start({ questions: missed }));
  app.querySelector("#againBtn").addEventListener("click", () => start());
  app.querySelector("#homeBtn").addEventListener("click", () => {
    renderHome();
    window.scrollTo(0, 0);
  });
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- keyboard
document.addEventListener("keydown", (e) => {
  if (state.screen !== "quiz" || e.metaKey || e.ctrlKey || e.altKey) return;
  const q = state.session[state.index];
  if (e.key === "Enter") {
    const onButton = e.target instanceof HTMLButtonElement;
    // The main button and the arrow buttons handle Enter natively (click);
    // on an option, Enter means "check" rather than "toggle again".
    if (onButton && !e.target.closest("[data-opt]")) return;
    e.preventDefault();
    onMain();
  } else if (q.type === "mcq" && /^[1-6]$/.test(e.key)) {
    const opt = state.current.options[Number(e.key) - 1];
    if (opt) toggleOption(opt.index);
  }
});

// ---------------------------------------------------------------- theme toggle
(function themeToggle() {
  const root = document.documentElement;
  const saved = store.get("dip.theme", null);
  if (saved === "light" || saved === "dark") root.dataset.theme = saved;
  document.getElementById("themeBtn").addEventListener("click", () => {
    const current = root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    root.dataset.theme = current === "dark" ? "light" : "dark";
    store.set("dip.theme", root.dataset.theme);
  });
})();

document.getElementById("homeLink").addEventListener("click", (e) => {
  e.preventDefault();
  renderHome();
});

load()
  .then(renderHome)
  .catch((err) => {
    app.innerHTML = `<p class="loading">Could not load the questions (${esc(err.message)}).
      If you opened the file directly, serve the folder instead: <code>python3 -m http.server</code></p>`;
  });
