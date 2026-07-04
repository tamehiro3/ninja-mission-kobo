// ============================================================
// CNP にんじゃミッション工房 - アプリ本体
// ============================================================

const SAVE_KEY = "ninja_kobo_save_v1";
const GRID_COLS = 8, GRID_ROWS = 6;

const DEFAULT_STATE = {
  version: 2,
  firstRun: true,
  partner: "sakuya",
  unlocked: ["sakuya", "nemu", "xiaolan"],
  coins: 50, wood: 0, star: 0, scroll: 0,
  inventory: {},          // itemId -> 個数（未配置）
  village: {},            // "r_c" -> itemId
  daily: { date: "", done: [] },
  history: { days: 0, clears: 0, lastDate: "" },
  settings: { missionsPerDay: 3, difficulty: 1, effects: true },
  chapterSeen: 0
};

let S = loadState();
let currentTab = "home";
let playCleanups = [];
let parentUnlockedThisSession = false;
let deferredInstallPrompt = null;

// ---------- 状態管理 ----------
function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const merged = Object.assign({}, DEFAULT_STATE, s, {
        daily: Object.assign({}, DEFAULT_STATE.daily, s.daily),
        history: Object.assign({}, DEFAULT_STATE.history, s.history),
        settings: Object.assign({}, DEFAULT_STATE.settings, s.settings)
      });
      // 旧キャラ名のセーブデータを新キャラへ移行
      if (!DATA.CHARS[merged.partner]) merged.partner = "sakuya";
      merged.unlocked = (merged.unlocked || []).filter(id => DATA.CHARS[id]);
      DATA.STARTER_CHARS.forEach(id => { if (!merged.unlocked.includes(id)) merged.unlocked.push(id); });
      return merged;
    }
  } catch (e) { /* 壊れたデータは初期化 */ }
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 容量超過などは無視 */ }
}

function today() { return GEN.todayKey(); }

function ensureDaily() {
  const t = today();
  if (S.daily.date !== t) {
    S.daily = { date: t, done: [] };
    if (S.history.lastDate !== t) {
      S.history.days++;
      S.history.lastDate = t;
    }
    save();
  }
}

function chapterInfo() {
  let ch = DATA.CHAPTERS[0], idx = 0;
  DATA.CHAPTERS.forEach((c, i) => { if (S.history.clears >= c.need) { ch = c; idx = i; } });
  return { ch, idx };
}

function partner() { return DATA.CHARS[S.partner] || DATA.CHARS.sakuya; }

function line(char, kind, rnd) {
  const arr = char.lines[kind];
  return arr[Math.floor((rnd ? rnd() : Math.random()) * arr.length)];
}

// ---------- 画面共通 ----------
const $screen = document.getElementById("screen");
const $overlay = document.getElementById("overlay");

function updateTopbar() {
  document.querySelector("#res-coins span").textContent = S.coins;
  document.querySelector("#res-wood span").textContent = S.wood;
  document.querySelector("#res-star span").textContent = S.star;
  document.querySelector("#res-scroll span").textContent = S.scroll;
}

function switchTab(tab) {
  playCleanups.forEach(f => f());
  playCleanups = [];
  currentTab = tab;
  document.querySelectorAll("#tabbar button").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  ensureDaily();
  updateTopbar();
  $screen.scrollTop = 0;
  if (tab === "home") renderHome();
  else if (tab === "missions") renderMissions();
  else if (tab === "chars") renderChars();
  else if (tab === "build") renderBuild();
  else if (tab === "parent") renderParent();
}

document.querySelectorAll("#tabbar button").forEach(b => {
  b.addEventListener("click", () => switchTab(b.dataset.tab));
});

function showOverlay(html, noClose) {
  $overlay.innerHTML = "<div class='modal'>" + html + "</div>";
  $overlay.classList.remove("hidden");
  if (!noClose) {
    $overlay.onclick = e => { if (e.target === $overlay) hideOverlay(); };
  } else {
    $overlay.onclick = null;
  }
  return $overlay.querySelector(".modal");
}

function hideOverlay() {
  $overlay.classList.add("hidden");
  $overlay.innerHTML = "";
}

function confetti() {
  if (!S.settings.effects) return;
  const emo = ["✨", "🌸", "⭐", "🎉", "🪙"];
  for (let i = 0; i < 22; i++) {
    const s = document.createElement("span");
    s.className = "confetti";
    s.textContent = emo[i % emo.length];
    s.style.left = Math.random() * 100 + "vw";
    s.style.animationDelay = Math.random() * 0.6 + "s";
    s.style.fontSize = 14 + Math.random() * 18 + "px";
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 2600);
  }
}

// ---------- ホーム（里） ----------
function renderHome() {
  const { ch } = chapterInfo();
  const p = partner();
  const t = today();
  const doneCount = S.daily.done.length;
  const total = S.settings.missionsPerDay;
  const placedCount = Object.keys(S.village).length;

  $screen.innerHTML = `
    <div class="chapter-banner">${ch.emoji} ${ch.name}</div>
    <div class="partner-row">
      <div class="partner-face" style="background:${p.color}22;border-color:${p.color}">${p.emoji}</div>
      <div class="bubble">${line(p, "start")}</div>
    </div>
    <div class="village-wrap"><div class="village" id="home-village"></div></div>
    <div class="home-stats">🏡 かざり ${placedCount}こ ／ 📜 クリア ${S.history.clears}かい</div>
    <button class="btn big" id="go-missions">📜 きょうの にんむ（${doneCount}/${total}）</button>
    <button class="btn" id="go-build">🛠️ さとを かざる</button>
    <div id="install-slot"></div>
  `;
  drawVillage(document.getElementById("home-village"), false);
  document.getElementById("go-missions").onclick = () => switchTab("missions");
  document.getElementById("go-build").onclick = () => switchTab("build");

  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (!standalone) {
    const slot = document.getElementById("install-slot");
    const b = document.createElement("button");
    b.className = "btn ghost";
    b.textContent = "📲 スマホに インストールする";
    b.onclick = showInstallGuide;
    slot.appendChild(b);
  }
}

function drawVillage(container, interactive) {
  container.innerHTML = "";
  container.style.gridTemplateColumns = `repeat(${GRID_COLS}, 1fr)`;
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const key = r + "_" + c;
      const cell = document.createElement(interactive ? "button" : "div");
      cell.className = "vcell";
      const itemId = S.village[key];
      if (itemId) {
        const item = DATA.ITEMS.find(i => i.id === itemId);
        cell.textContent = item ? item.emoji : "";
        cell.classList.add("filled");
      }
      if (interactive) cell.onclick = () => onCellTap(key, cell);
      container.appendChild(cell);
    }
  }
}

// ---------- 任務一覧 ----------
function renderMissions() {
  ensureDaily();
  const t = today();
  const types = GEN.dailyMissions(t).slice(0, S.settings.missionsPerDay);
  const p = partner();
  const { ch } = chapterInfo();
  const hardCount = Math.min(ch.hard, types.length);
  const isHard = i => i >= types.length - hardCount;
  const allDone = types.every((_, i) => S.daily.done.includes(i));

  const supportNote = ch.hints > 0
    ? `🤖 AIまきもの工房が きょうの にんむを つくったよ（AIサポートは 1にんむに ${ch.hints}かいまで）`
    : `🤖 ${ch.name}では AIサポートなし！ じぶんの ちからだけで いどもう！`;
  let html = `<div class="page-title">📜 きょうの にんむ <span class="date">${t}</span></div>
    <div class="ai-note">${supportNote}</div>`;

  if (allDone) {
    html += `<div class="day-end">
      <div class="day-end-emoji">🌙</div>
      <div class="day-end-title">きょうの しゅぎょうは おしまい！</div>
      <div class="day-end-sub">よく がんばったね。つづきは また あした！<br>あつめた ごほうびで さとを かざろう🏮</div>
      <button class="btn" id="end-build">🛠️ さとを かざりにいく</button>
    </div>`;
  }

  html += "<div class='mission-list'>";
  types.forEach((type, i) => {
    const meta = DATA.MISSION_TYPES[type];
    const done = S.daily.done.includes(i);
    const special = p.specialty.includes(type);
    const hard = isHard(i);
    html += `<div class="mission-card ${done ? "done" : ""} ${hard ? "hard" : ""}">
      <div class="m-icon">${meta.icon}</div>
      <div class="m-body">
        <div class="m-label">${meta.label}${hard ? " <span class='m-hard'>🔥おにむず</span>" : ""}${special ? ` <span class="m-special">${p.emoji}とくい！</span>` : ""}</div>
        <div class="m-story">${hard ? "おとなでも てこずる もんだいだ…ほうしゅうは 2ばい！" : meta.story}</div>
      </div>
      ${done ? "<div class='m-done'>✅</div>" : `<button class="btn small" data-play="${i}" data-type="${type}" data-hard="${hard ? 1 : 0}">あそぶ</button>`}
    </div>`;
  });
  html += "</div>";
  $screen.innerHTML = html;

  $screen.querySelectorAll("[data-play]").forEach(b => {
    b.onclick = () => playMission(Number(b.dataset.play), b.dataset.type, b.dataset.hard === "1");
  });
  const eb = document.getElementById("end-build");
  if (eb) eb.onclick = () => switchTab("build");
}

// ---------- 任務プレイ ----------
function playMission(idx, type, isHard) {
  playCleanups.forEach(f => f());
  playCleanups = [];
  const diff = isHard ? 3 : S.settings.difficulty;
  const t = today();
  const puzzle = GEN.build(type, t, idx, diff);
  const p = partner();
  const rnd = GEN.rng(GEN.hash(t + ":play:" + idx));
  const maxHints = chapterInfo().ch.hints; // 章がすすむと AIサポートが へる
  let hintsUsed = 0, misses = 0;

  const hintUI = maxHints > 0
    ? `<button class="btn ghost" id="hint-btn">🤖 AIサポート（のこり${maxHints}かい）</button>`
    : `<div class="no-support">🤖 この章は AIサポートなし！ じぶんの ちからで とこう！</div>`;

  $screen.innerHTML = `
    <div class="play-head">
      <button class="btn small ghost" id="play-back">← もどる</button>
      <div class="play-title">${puzzle.icon} ${puzzle.label}${isHard ? " <span class='m-hard'>🔥おにむず</span>" : ""}</div>
    </div>
    <div class="partner-row">
      <div class="partner-face" style="background:${p.color}22;border-color:${p.color}">${p.emoji}</div>
      <div class="bubble" id="play-say">${isHard ? "🔥おにむず にんむだ…！ おちついて いこう！" : line(p, "start", rnd)}</div>
    </div>
    <div class="puzzle-area" id="puzzle-area"></div>
    <div class="hint-area" id="hint-area"></div>
    ${hintUI}
  `;

  const area = document.getElementById("puzzle-area");
  const sayEl = document.getElementById("play-say");
  const hintBtn = document.getElementById("hint-btn");
  const hintArea = document.getElementById("hint-area");
  let finished = false;

  const api = {
    solve() {
      if (finished) return;
      finished = true;
      finishMission(idx, type, puzzle, hintsUsed, misses, isHard);
    },
    miss() {
      if (finished) return;
      misses++;
      sayEl.textContent = line(p, "miss");
    },
    say(text) { sayEl.textContent = text; },
    onCleanup(f) { playCleanups.push(f); }
  };

  document.getElementById("play-back").onclick = () => switchTab("missions");
  if (hintBtn) {
    hintBtn.onclick = () => {
      if (hintsUsed >= maxHints || finished) return;
      hintsUsed++;
      const div = document.createElement("div");
      div.className = "hint-line pop";
      div.textContent = "🤖 " + puzzle.hints[hintsUsed - 1];
      hintArea.appendChild(div);
      hintBtn.textContent = hintsUsed >= maxHints ? "AIサポートは おしまい" : `🤖 AIサポート（のこり${maxHints - hintsUsed}かい）`;
      if (hintsUsed >= maxHints) hintBtn.disabled = true;
      if (puzzle.onHint) puzzle.onHint(hintsUsed, $screen);
    };
  }

  puzzle.mount(area, api);
}

function finishMission(idx, type, puzzle, hintsUsed, misses, isHard) {
  const diff = S.settings.difficulty;
  const p = partner();
  const base = isHard ? 60 : diff === 0 ? 20 : diff === 1 ? 30 : 40;
  const special = p.specialty.includes(type);
  let coins = Math.max(isHard ? 20 : 8, base - hintsUsed * 5 - misses * 2) + (special ? 10 : 0);

  const rnd = GEN.rng(GEN.hash(today() + ":reward:" + idx));
  const mats = ["wood", "star", "scroll"];
  const matNames = { wood: "🪵 もくざい", star: "⭐ ほしのかけら", scroll: "📜 まきもの" };
  const mat = mats[Math.floor(rnd() * 3)];
  const matAmt = isHard ? 2 : diff === 2 ? 2 : 1;

  S.coins += coins;
  S[mat] += matAmt;
  if (!S.daily.done.includes(idx)) S.daily.done.push(idx);
  S.history.clears++;
  save();
  updateTopbar();
  confetti();

  const praise = DATA.PRAISE[Math.floor(Math.random() * DATA.PRAISE.length)];
  const { idx: newCh } = chapterInfo();
  const chapterUp = newCh > S.chapterSeen;

  const m = showOverlay(`
    <div class="result">
      <div class="result-emoji">${p.emoji}</div>
      <div class="result-title">${isHard ? "🔥おにむず せいは！" : praise}</div>
      <div class="result-line">${isHard ? "おとなでも てこずる もんだいを といたぞ！ " : ""}${line(p, "clear")}</div>
      <div class="result-rewards">
        <div class="reward-item pop">🪙 コイン ×${coins}${special ? " <span class='m-special'>とくいボーナス+10</span>" : ""}${isHard ? " <span class='m-hard'>🔥おにむずほうしゅう</span>" : ""}</div>
        <div class="reward-item pop">${matNames[mat]} ×${matAmt}</div>
      </div>
      <button class="btn big" id="result-next">つぎへ</button>
    </div>
  `, true);
  m.querySelector("#result-next").onclick = () => {
    hideOverlay();
    if (chapterUp) {
      S.chapterSeen = newCh;
      save();
      const ch = DATA.CHAPTERS[newCh];
      confetti();
      const rules = [];
      rules.push(ch.hints > 0 ? `🤖 AIサポートは 1にんむに ${ch.hints}かいまで` : "🤖 AIサポートは そつぎょう！ もう じぶんの ちからで とける はず！");
      if (ch.hard > 0) rules.push(`🔥 1にちに ${ch.hard}この「おにむず」にんむが まざるよ（ほうしゅう2ばい）`);
      const m2 = showOverlay(`
        <div class="result">
          <div class="result-emoji">${ch.emoji}</div>
          <div class="result-title">しょうしんおめでとう！</div>
          <div class="result-line">「${ch.name}」に すすんだよ！<br><br>${rules.join("<br>")}</div>
          <button class="btn big" id="ch-ok">やったー！</button>
        </div>
      `, true);
      m2.querySelector("#ch-ok").onclick = () => { hideOverlay(); switchTab("missions"); };
    } else {
      switchTab("missions");
    }
  };
}

// ---------- なかま ----------
function renderChars() {
  let html = `<div class="page-title">🥷 にんじゃの なかま</div><div class="char-list">`;
  Object.values(DATA.CHARS).forEach(c => {
    const unlocked = S.unlocked.includes(c.id);
    const isPartner = S.partner === c.id;
    let action;
    if (isPartner) {
      action = "<div class='char-current'>いっしょに しゅぎょうちゅう！</div>";
    } else if (unlocked) {
      action = `<button class="btn small" data-pick="${c.id}">あいぼうに する</button>`;
    } else {
      action = `<button class="btn small ghost" data-unlock="${c.id}">${costText(c.unlock)} で なかまにする</button>`;
    }
    html += `<div class="char-card ${isPartner ? "picked" : ""} ${unlocked ? "" : "locked"}" style="border-color:${isPartner ? c.color : "transparent"}">
      <div class="char-face" style="background:${c.color}22">${unlocked ? c.emoji : "❓"}</div>
      <div class="char-body">
        <div class="char-name">${c.name}</div>
        <div class="char-role">${c.role}</div>
      </div>
      <div class="char-action">${action}</div>
    </div>`;
  });
  html += "</div><div class='ai-note'>あいぼうの とくいな にんむを えらぶと ボーナスコイン🪙+10！</div>";
  $screen.innerHTML = html;

  $screen.querySelectorAll("[data-pick]").forEach(b => {
    b.onclick = () => {
      S.partner = b.dataset.pick;
      save();
      const c = DATA.CHARS[S.partner];
      confetti();
      renderChars();
    };
  });
  $screen.querySelectorAll("[data-unlock]").forEach(b => {
    b.onclick = () => {
      const c = DATA.CHARS[b.dataset.unlock];
      const need = c.unlock;
      if (!canAfford(need)) {
        showOverlay(`<div class="result"><div class="result-emoji">😌</div><div class="result-line">まだ ${costText(need)} が ひつようだよ。<br>にんむを クリアして あつめよう！</div><button class="btn" onclick="hideOverlay()">わかった</button></div>`);
        return;
      }
      S.coins -= need.coins || 0;
      S.wood -= need.wood || 0;
      S.star -= need.star || 0;
      S.scroll -= need.scroll || 0;
      if (!S.unlocked.includes(c.id)) S.unlocked.push(c.id);
      S.partner = c.id;
      save();
      updateTopbar();
      confetti();
      showOverlay(`<div class="result"><div class="result-emoji">${c.emoji}</div><div class="result-title">${c.name}が なかまになった！</div><div class="result-line">${line(c, "start")}</div><button class="btn big" onclick="hideOverlay();switchTab('chars')">よろしくね！</button></div>`, true);
    };
  });
}

// ---------- 里づくり ----------
function renderBuild() {
  const invEntries = Object.entries(S.inventory).filter(([, n]) => n > 0);
  $screen.innerHTML = `
    <div class="page-title">🛠️ さとづくり</div>
    <div class="ai-note">あいてる マスを タップして かざりを おこう。おいてある かざりは タップで しまえるよ。</div>
    <div class="village-wrap"><div class="village" id="build-village"></div></div>
    <div class="inv-bar" id="inv-bar">${
      invEntries.length
        ? "もちもの： " + invEntries.map(([id, n]) => {
            const it = DATA.ITEMS.find(i => i.id === id);
            return `${it.emoji}×${n}`;
          }).join(" ")
        : "もちものは からっぽ。おみせで かざりを かおう！"
    }</div>
    <button class="btn big" id="open-shop">🏪 かざりの おみせ</button>
  `;
  drawVillage(document.getElementById("build-village"), true);
  document.getElementById("open-shop").onclick = openShop;
}

function onCellTap(key, cell) {
  const itemId = S.village[key];
  if (itemId) {
    const item = DATA.ITEMS.find(i => i.id === itemId);
    const m = showOverlay(`
      <div class="result">
        <div class="result-emoji">${item.emoji}</div>
        <div class="result-title">${item.name}</div>
        <div class="result-line">${item.desc}</div>
        <button class="btn" id="store-item">🎒 しまう</button>
        <button class="btn ghost" id="cancel-item">とじる</button>
      </div>
    `);
    m.querySelector("#store-item").onclick = () => {
      delete S.village[key];
      S.inventory[itemId] = (S.inventory[itemId] || 0) + 1;
      save();
      hideOverlay();
      renderBuild();
    };
    m.querySelector("#cancel-item").onclick = hideOverlay;
    return;
  }
  const invEntries = Object.entries(S.inventory).filter(([, n]) => n > 0);
  if (!invEntries.length) {
    const m = showOverlay(`<div class="result"><div class="result-emoji">🎒</div><div class="result-line">おける かざりが ないよ。<br>おみせで かってみよう！</div><button class="btn" id="to-shop">🏪 おみせへ</button></div>`);
    m.querySelector("#to-shop").onclick = () => { hideOverlay(); openShop(); };
    return;
  }
  let html = `<div class="page-title">どれを おく？</div><div class="shop-list">`;
  invEntries.forEach(([id, n]) => {
    const it = DATA.ITEMS.find(i => i.id === id);
    html += `<button class="shop-item" data-place="${id}">
      <span class="s-emoji">${it.emoji}</span>
      <span class="s-body"><b>${it.name}</b> ×${n}<br><small>${it.desc}</small></span>
    </button>`;
  });
  html += "</div>";
  const m = showOverlay(html);
  m.querySelectorAll("[data-place]").forEach(b => {
    b.onclick = () => {
      const id = b.dataset.place;
      S.village[key] = id;
      S.inventory[id]--;
      save();
      hideOverlay();
      renderBuild();
    };
  });
}

function costText(cost) {
  const parts = [];
  if (cost.coins) parts.push("🪙" + cost.coins);
  if (cost.wood) parts.push("🪵" + cost.wood);
  if (cost.star) parts.push("⭐" + cost.star);
  if (cost.scroll) parts.push("📜" + cost.scroll);
  return parts.join(" ");
}

function canAfford(cost) {
  return S.coins >= (cost.coins || 0) && S.wood >= (cost.wood || 0) &&
         S.star >= (cost.star || 0) && S.scroll >= (cost.scroll || 0);
}

function openShop() {
  let html = `<div class="page-title">🏪 かざりの おみせ</div><div class="ai-note">ぜんぶ なかみが みえる あんしんパック。ガチャは ないよ。</div><div class="shop-list">`;
  DATA.ITEMS.forEach(it => {
    const afford = canAfford(it.cost);
    html += `<button class="shop-item ${afford ? "" : "cant"}" data-buy="${it.id}">
      <span class="s-emoji">${it.emoji}</span>
      <span class="s-body"><b>${it.name}</b><br><small>${it.desc}</small></span>
      <span class="s-cost">${costText(it.cost)}</span>
    </button>`;
  });
  html += "</div>";
  const m = showOverlay(html);
  m.querySelectorAll("[data-buy]").forEach(b => {
    b.onclick = () => {
      const it = DATA.ITEMS.find(i => i.id === b.dataset.buy);
      if (!canAfford(it.cost)) {
        b.classList.add("shake");
        setTimeout(() => b.classList.remove("shake"), 400);
        return;
      }
      S.coins -= it.cost.coins || 0;
      S.wood -= it.cost.wood || 0;
      S.star -= it.cost.star || 0;
      S.scroll -= it.cost.scroll || 0;
      S.inventory[it.id] = (S.inventory[it.id] || 0) + 1;
      save();
      updateTopbar();
      hideOverlay();
      confetti();
      renderBuild();
    };
  });
}

// ---------- 保護者設定 ----------
function renderParent() {
  if (!parentUnlockedThisSession) {
    const a = 3 + Math.floor(Math.random() * 7), b = 3 + Math.floor(Math.random() * 7);
    $screen.innerHTML = `
      <div class="page-title">⚙️ おうちのひと せんよう</div>
      <div class="parent-gate">
        <p>ここから さきは 保護者の方向けの設定画面です。</p>
        <p class="gate-q">かくにん： ${a} × ${b} = ?</p>
        <input type="number" id="gate-input" inputmode="numeric" class="gate-input" placeholder="こたえ">
        <button class="btn" id="gate-ok">かくにん</button>
        <div id="gate-msg" class="gate-msg"></div>
      </div>
    `;
    document.getElementById("gate-ok").onclick = () => {
      if (Number(document.getElementById("gate-input").value) === a * b) {
        parentUnlockedThisSession = true;
        renderParent();
      } else {
        document.getElementById("gate-msg").textContent = "こたえが ちがいます";
      }
    };
    return;
  }

  const st = S.settings;
  $screen.innerHTML = `
    <div class="page-title">⚙️ 保護者設定</div>
    <div class="parent-box">
      <label>1日の任務数（推奨: 3）
        <select id="set-missions">${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${st.missionsPerDay === n ? "selected" : ""}>${n}任務</option>`).join("")}</select>
      </label>
      <label>難易度
        <select id="set-diff">
          <option value="0" ${st.difficulty === 0 ? "selected" : ""}>やさしい（低学年）</option>
          <option value="1" ${st.difficulty === 1 ? "selected" : ""}>ふつう（中学年）</option>
          <option value="2" ${st.difficulty === 2 ? "selected" : ""}>むずかしい（高学年）</option>
        </select>
      </label>
      <label>クリア演出（紙ふぶき）
        <select id="set-fx">
          <option value="1" ${st.effects ? "selected" : ""}>あり</option>
          <option value="0" ${!st.effects ? "selected" : ""}>なし</option>
        </select>
      </label>
    </div>
    <div class="parent-box">
      <div class="stat-line">遊んだ日数：${S.history.days}日 ／ クリア数：${S.history.clears}回</div>
      <div class="stat-line">現在の章：${chapterInfo().ch.name}</div>
    </div>
    <div class="parent-box safety">
      <b>安全設計について</b>
      <ul>
        <li>自由入力チャットはありません（全キャラのセリフは事前作成）</li>
        <li>課金・広告・外部リンク・SNS共有機能はありません</li>
        <li>問題は端末内で日替わり生成され、オフラインでも遊べます</li>
        <li>1日の任務数を超えると「今日はここまで」と区切ります</li>
        <li>章が進むとAIサポート（ヒント）が減り（第5章で0回）、大人でも難しい「おにむず」問題が混ざります</li>
        <li>キャラクターはCryptoNinja（CC0）の咲耶・ネム・シャオランたちです</li>
      </ul>
    </div>
    <button class="btn ghost" id="show-install">📲 スマホへのインストール方法</button>
    <button class="btn danger" id="reset-data">データをリセットする</button>
  `;
  document.getElementById("set-missions").onchange = e => { S.settings.missionsPerDay = Number(e.target.value); save(); };
  document.getElementById("set-diff").onchange = e => { S.settings.difficulty = Number(e.target.value); save(); };
  document.getElementById("set-fx").onchange = e => { S.settings.effects = e.target.value === "1"; save(); };
  document.getElementById("show-install").onclick = showInstallGuide;
  document.getElementById("reset-data").onclick = () => {
    const m = showOverlay(`<div class="result"><div class="result-emoji">⚠️</div><div class="result-line">里・コイン・記録がぜんぶ消えます。<br>本当にリセットしますか？</div><button class="btn danger" id="do-reset">リセットする</button><button class="btn ghost" id="no-reset">やめる</button></div>`);
    m.querySelector("#do-reset").onclick = () => {
      localStorage.removeItem(SAVE_KEY);
      S = loadState();
      hideOverlay();
      switchTab("home");
    };
    m.querySelector("#no-reset").onclick = hideOverlay;
  };
}

// ---------- インストール案内 ----------
function showInstallGuide() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    return;
  }
  const iosSteps = `
    <ol class="install-steps">
      <li>Safariの したの <b>共有ボタン（□に↑）</b> をタップ</li>
      <li><b>「ホーム画面に追加」</b> をタップ</li>
      <li>みぎうえの <b>「追加」</b> をタップ</li>
    </ol>`;
  const androidSteps = `
    <ol class="install-steps">
      <li>Chromeの みぎうえ <b>「⋮」メニュー</b> をタップ</li>
      <li><b>「アプリをインストール」</b>（または「ホーム画面に追加」）をタップ</li>
    </ol>`;
  showOverlay(`
    <div class="result">
      <div class="result-emoji">📲</div>
      <div class="result-title">スマホに インストール</div>
      <div class="install-body">${isIOS ? iosSteps : androidSteps}
      <p>ホームがめんの アイコンから アプリみたいに あそべるよ！</p></div>
      <button class="btn" onclick="hideOverlay()">とじる</button>
    </div>
  `);
}

window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredInstallPrompt = e;
});

// ---------- はじめての起動 ----------
function firstRunFlow() {
  let html = `
    <div class="result">
      <div class="result-emoji">🏯</div>
      <div class="result-title">CNP にんじゃミッション工房へ ようこそ！</div>
      <div class="result-line">AIが まいにち つくる なぞときを クリアして、<br>じぶんだけの にんじゃの さとを そだてよう！</div>
      <div class="page-title" style="margin-top:12px">あいぼうを えらんでね</div>
      <div class="char-list">`;
  DATA.STARTER_CHARS.forEach(id => {
    const c = DATA.CHARS[id];
    html += `<button class="char-card pickable" data-first="${id}">
      <div class="char-face" style="background:${c.color}22">${c.emoji}</div>
      <div class="char-body"><div class="char-name">${c.name}</div><div class="char-role">${c.role}</div></div>
    </button>`;
  });
  html += "</div></div>";
  const m = showOverlay(html, true);
  m.querySelectorAll("[data-first]").forEach(b => {
    b.onclick = () => {
      S.partner = b.dataset.first;
      S.firstRun = false;
      save();
      hideOverlay();
      confetti();
      switchTab("home");
    };
  });
}

// ---------- 起動 ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

ensureDaily();
updateTopbar();
if (S.firstRun) {
  switchTab("home");
  firstRunFlow();
} else {
  switchTab("home");
}
