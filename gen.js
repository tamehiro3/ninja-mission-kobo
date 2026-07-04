// ============================================================
// AIまきもの工房：日替わりミッション生成エンジン
// 日付シードで毎日ちがう問題を端末内で安全に生成する
// （自由入力なし・全コンテンツは data.js の安全な素材のみ）
// ============================================================

const GEN = {};

// ---------- シード付き乱数 ----------
GEN.hash = function (str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
};

GEN.rng = function (seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

GEN.todayKey = function () {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
};

GEN.shuffle = function (arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

GEN.pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];

// ---------- 今日のミッション一覧（決定的） ----------
GEN.dailyMissions = function (dateKey) {
  const rnd = GEN.rng(GEN.hash("day:" + dateKey));
  const types = GEN.shuffle(Object.keys(DATA.MISSION_TYPES), rnd);
  return types.slice(0, 5); // 最大5件ぶん用意し、設定の件数だけ使う
};

// ---------- DOMユーティリティ ----------
GEN.el = function (tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

// 選択肢ボタン群（正解で solve / 不正解で miss ＋ シェイク）
GEN.choiceButtons = function (container, choices, answerIndex, api, rnd) {
  const order = GEN.shuffle(choices.map((c, i) => ({ c, i })), rnd);
  const wrap = GEN.el("div", "choices");
  order.forEach(o => {
    const b = GEN.el("button", "choice", o.c);
    b.onclick = () => {
      if (o.i === answerIndex) {
        api.solve();
      } else {
        b.classList.add("shake", "dim");
        setTimeout(() => b.classList.remove("shake"), 500);
        api.miss();
      }
    };
    wrap.appendChild(b);
  });
  container.appendChild(wrap);
  return wrap;
};

// ============================================================
// パズル生成（10テンプレート）
// 返り値: { title, story, hints:[3つ], mount(el, api), onHint? }
// api: { solve(), miss(), say(text) }
// ============================================================

GEN.builders = {};

// ① ことばなぞなぞ
GEN.builders.riddle = function (rnd, diff) {
  const r = GEN.pick(DATA.RIDDLES, rnd);
  return {
    hints: [
      "もんだいを こえに だして ゆっくり よんでみよう",
      r.hint,
      "こたえの さいしょの もじは「" + r.choices[r.a][0] + "」だよ"
    ],
    mount(el, api) {
      el.appendChild(GEN.el("div", "qtext", r.q));
      GEN.choiceButtons(el, r.choices, r.a, api, rnd);
    }
  };
};

// ② すいりミッション
GEN.builders.deduce = function (rnd, diff) {
  const c = GEN.pick(DATA.DEDUCE, rnd);
  return {
    title: c.title,
    hints: [
      "3つの ヒントを ぜんぶ ひらいてみよう",
      "ヒントに あわないものを 1つずつ けしていこう",
      "こたえの さいしょの もじは「" + c.choices[c.a][0] + "」だよ"
    ],
    mount(el, api) {
      el.appendChild(GEN.el("div", "qtext", c.title));
      const hintArea = GEN.el("div", "deduce-hints");
      el.appendChild(hintArea);
      let shown = 0;
      const btn = GEN.el("button", "btn small", "🔍 ヒントを ひらく（" + c.hints.length + "つ）");
      const reveal = () => {
        if (shown < c.hints.length) {
          hintArea.appendChild(GEN.el("div", "deduce-hint pop", "ヒント" + (shown + 1) + "：" + c.hints[shown]));
          shown++;
          btn.textContent = shown < c.hints.length ? "🔍 つぎのヒント（あと" + (c.hints.length - shown) + "つ）" : "ヒントは ぜんぶ ひらいたよ";
          if (shown >= c.hints.length) btn.disabled = true;
        }
      };
      btn.onclick = reveal;
      el.appendChild(btn);
      reveal();
      GEN.choiceButtons(el, c.choices, c.a, api, rnd);
    }
  };
};

// ③ じゅんばんパズル
GEN.builders.order = function (rnd, diff) {
  const o = GEN.pick(DATA.ORDERS, rnd);
  const steps = o.steps;
  let shuffled = steps;
  for (let t = 0; t < 10 && shuffled.join() === steps.join(); t++) shuffled = GEN.shuffle(steps, rnd);
  return {
    title: o.title,
    hints: [
      "いちばん さいしょに することは なにかな？",
      "さいしょは「" + steps[0] + "」だよ",
      "さいごは「" + steps[steps.length - 1] + "」だよ"
    ],
    mount(el, api) {
      el.appendChild(GEN.el("div", "qtext", o.title + "<br><span class='sub'>ただしい じゅんばんに タップしてね</span>"));
      const seq = GEN.el("div", "order-seq");
      el.appendChild(seq);
      const wrap = GEN.el("div", "order-list");
      let picked = [];
      const render = () => {
        seq.innerHTML = picked.length ? picked.map((s, i) => (i + 1) + ". " + s).join("<br>") : "（ここに じゅんばんが ならぶよ）";
      };
      render();
      shuffled.forEach(s => {
        const b = GEN.el("button", "choice", s);
        b.onclick = () => {
          if (b.disabled) return;
          b.disabled = true;
          b.classList.add("dim");
          picked.push(s);
          render();
          if (picked.length === steps.length) {
            if (picked.join() === steps.join()) {
              api.solve();
            } else {
              api.miss();
              api.say("うーん、じゅんばんが ちがうみたい。もういちど！");
              picked = [];
              render();
              wrap.querySelectorAll("button").forEach(x => { x.disabled = false; x.classList.remove("dim"); });
            }
          }
        };
        wrap.appendChild(b);
      });
      el.appendChild(wrap);
    }
  };
};

// ④ まきものきおく
GEN.builders.memory = function (rnd, diff) {
  const n = diff === 0 ? 3 : diff === 1 ? 4 : 5;
  const secs = diff === 0 ? 7 : diff === 1 ? 6 : 5;
  const pool = GEN.shuffle(DATA.MEMORY_POOL, rnd);
  const shown = pool.slice(0, n);
  const others = pool.slice(n, n + 3);
  const askPresent = rnd() < 0.5;
  let choices, aIdx;
  if (askPresent) {
    choices = [shown[Math.floor(rnd() * n)], ...others];
    aIdx = 0;
  } else {
    choices = [others[0], ...GEN.shuffle(shown, rnd).slice(0, 3)];
    aIdx = 0;
  }
  const q = askPresent ? "まきものに あったものは どれ？" : "まきものに なかったものは どれ？";
  return {
    hints: [
      "まきものには " + n + "こ かいてあったよ",
      "「" + shown[0] + "」は まきものに あったよ",
      "こたえは「" + choices[aIdx] + "」…しーっ、ないしょだよ"
    ],
    mount(el, api) {
      el.appendChild(GEN.el("div", "qtext", "まきものを " + secs + "びょうで おぼえてね！"));
      const scroll = GEN.el("div", "scroll-view", shown.join(" "));
      el.appendChild(scroll);
      const timer = GEN.el("div", "mem-timer", String(secs));
      el.appendChild(timer);
      let left = secs;
      const iv = setInterval(() => {
        left--;
        timer.textContent = String(left);
        if (left <= 0) {
          clearInterval(iv);
          scroll.textContent = "❓ ❓ ❓";
          timer.textContent = "";
          el.appendChild(GEN.el("div", "qtext", q));
          GEN.choiceButtons(el, choices, aIdx, api, rnd);
        }
      }, 1000);
      api.onCleanup(() => clearInterval(iv));
    }
  };
};

// ⑤ かんさつミッション
GEN.builders.observe = function (rnd, diff) {
  const pair = GEN.pick(DATA.OBSERVE_PAIRS, rnd);
  const flip = rnd() < 0.5;
  const base = flip ? pair[1] : pair[0];
  const odd = flip ? pair[0] : pair[1];
  const cols = diff === 0 ? 4 : 5;
  const rows = diff === 0 ? 4 : diff === 1 ? 5 : 6;
  const total = cols * rows;
  const oddPos = Math.floor(rnd() * total);
  const oddRow = Math.floor(oddPos / cols);
  return {
    hints: [
      "ひとつだけ ちがうものが あるよ。かたちを よーくみて",
      oddRow < rows / 2 ? "うえの ほうに かくれてるよ" : "したの ほうに かくれてるよ",
      "ひかった ところを みてみて！"
    ],
    onHint(level, el) {
      if (level === 3) {
        const cells = el.querySelectorAll(".obs-cell");
        cells.forEach((c, i) => {
          if (Math.abs(Math.floor(i / cols) - oddRow) <= 1 && Math.abs((i % cols) - (oddPos % cols)) <= 1) {
            c.classList.add("glow");
            setTimeout(() => c.classList.remove("glow"), 2500);
          }
        });
      }
    },
    mount(el, api) {
      el.appendChild(GEN.el("div", "qtext", "ひとつだけ ちがうものを タップ！"));
      const grid = GEN.el("div", "obs-grid");
      grid.style.gridTemplateColumns = "repeat(" + cols + ", 1fr)";
      for (let i = 0; i < total; i++) {
        const c = GEN.el("button", "obs-cell", i === oddPos ? odd : base);
        c.onclick = () => {
          if (i === oddPos) {
            c.classList.add("glow");
            api.solve();
          } else {
            c.classList.add("shake");
            setTimeout(() => c.classList.remove("shake"), 400);
            api.miss();
          }
        };
        grid.appendChild(c);
      }
      el.appendChild(grid);
    }
  };
};

// ⑥ めいろミッション
GEN.builders.maze = function (rnd, diff) {
  const n = diff === 0 ? 4 : diff === 1 ? 5 : 6; // 論理セル数
  const size = 2 * n + 1;
  // 迷路生成（穴掘り法）
  const W = Array.from({ length: size }, () => Array(size).fill(1));
  const carve = (cx, cy) => {
    W[2 * cy + 1][2 * cx + 1] = 0;
    const dirs = GEN.shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]], rnd);
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      if (nx >= 0 && nx < n && ny >= 0 && ny < n && W[2 * ny + 1][2 * nx + 1] === 1) {
        W[2 * cy + 1 + dy][2 * cx + 1 + dx] = 0;
        carve(nx, ny);
      }
    }
  };
  carve(0, 0);
  const goal = { x: size - 2, y: size - 2 };
  return {
    hints: [
      "ゴール🏮は みぎしたに あるよ",
      "いきどまりに はいったら おちついて もどろう",
      "ひかる みちを みてみて！"
    ],
    onHint(level, el) {
      if (level === 3) {
        // BFSで現在地からゴールへの道を光らせる
        const px = Number(el.dataset.px), py = Number(el.dataset.py);
        const prev = {}, seen = new Set([px + "," + py]);
        const queue = [[px, py]];
        while (queue.length) {
          const [x, y] = queue.shift();
          if (x === goal.x && y === goal.y) break;
          for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
            const nx = x + dx, ny = y + dy, k = nx + "," + ny;
            if (nx > 0 && nx < size && ny > 0 && ny < size && !seen.has(k) && W[y + dy / 2][x + dx / 2] === 0) {
              seen.add(k); prev[k] = [x, y]; queue.push([nx, ny]);
            }
          }
        }
        let cur = [goal.x, goal.y];
        const path = new Set();
        while (cur && !(cur[0] === px && cur[1] === py)) {
          path.add(cur[0] + "," + cur[1]);
          const p = prev[cur[0] + "," + cur[1]];
          if (p) path.add((cur[0] + p[0]) / 2 + "," + (cur[1] + p[1]) / 2);
          cur = p;
        }
        el.querySelectorAll(".mz-cell").forEach(c => {
          if (path.has(c.dataset.x + "," + c.dataset.y)) {
            c.classList.add("glow");
            setTimeout(() => c.classList.remove("glow"), 2500);
          }
        });
      }
    },
    mount(el, api) {
      el.appendChild(GEN.el("div", "qtext", "🥷を うごかして 🏮まで すすもう！"));
      const grid = GEN.el("div", "maze");
      grid.style.gridTemplateColumns = "repeat(" + size + ", 1fr)";
      let px = 1, py = 1;
      el.dataset.px = px; el.dataset.py = py;
      const cells = [];
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const c = GEN.el("div", "mz-cell " + (W[y][x] ? "wall" : "floor"));
          c.dataset.x = x; c.dataset.y = y;
          grid.appendChild(c);
          cells.push(c);
        }
      }
      const at = (x, y) => cells[y * size + x];
      const draw = () => {
        cells.forEach(c => { c.textContent = ""; });
        at(goal.x, goal.y).textContent = "🏮";
        at(px, py).textContent = "🥷";
        el.dataset.px = px; el.dataset.py = py;
      };
      draw();
      el.appendChild(grid);
      const pad = GEN.el("div", "dpad");
      const mk = (label, dx, dy) => {
        const b = GEN.el("button", "dbtn", label);
        b.onclick = () => {
          if (W[py + dy][px + dx] === 0) {
            px += dx * 2; py += dy * 2;
            draw();
            if (px === goal.x && py === goal.y) api.solve();
          } else {
            b.classList.add("shake");
            setTimeout(() => b.classList.remove("shake"), 300);
          }
        };
        return b;
      };
      pad.appendChild(GEN.el("span", ""));
      pad.appendChild(mk("⬆️", 0, -1));
      pad.appendChild(GEN.el("span", ""));
      pad.appendChild(mk("⬅️", -1, 0));
      pad.appendChild(mk("⬇️", 0, 1));
      pad.appendChild(mk("➡️", 1, 0));
      el.appendChild(pad);
    }
  };
};

// ⑦ あんごうなぞとき（きごう→もじ）
GEN.builders.cipher = function (rnd, diff) {
  const maxLen = diff === 0 ? 4 : 6;
  const cands = DATA.WORDS.filter(w => w.w.length >= 3 && w.w.length <= maxLen);
  const word = GEN.pick(cands, rnd);
  const uniq = [...new Set(word.w.split(""))];
  const syms = GEN.shuffle(DATA.SYMBOLS, rnd).slice(0, uniq.length);
  const map = {};
  uniq.forEach((k, i) => { map[k] = syms[i]; });
  const encoded = word.w.split("").map(k => map[k]).join(" ");
  const others = GEN.shuffle(DATA.WORDS.filter(w => w.w !== word.w), rnd).slice(0, 3).map(w => w.w);
  const choices = [word.w, ...others];
  return {
    hints: [
      "ひょうを みながら 1もじずつ おきかえてみよう",
      "さいしょの もじは「" + word.w[0] + "」だよ",
      "こたえは " + word.w.length + "もじ。「" + word.cat + "」の なかまだよ"
    ],
    mount(el, api) {
      el.appendChild(GEN.el("div", "qtext", "にんじゃあんごうを かいどくせよ！"));
      const keyWrap = GEN.el("div", "cipher-key");
      GEN.shuffle(uniq, rnd).forEach(k => {
        keyWrap.appendChild(GEN.el("div", "key-item", map[k] + " = " + k));
      });
      el.appendChild(keyWrap);
      el.appendChild(GEN.el("div", "cipher-code", encoded));
      GEN.choiceButtons(el, choices, 0, api, rnd);
    }
  };
};

// ⑧ さかさことば
GEN.builders.reverse = function (rnd, diff) {
  const maxLen = diff === 0 ? 4 : 6;
  const cands = DATA.WORDS.filter(w => w.w.length >= 3 && w.w.length <= maxLen);
  const word = GEN.pick(cands, rnd);
  const rev = word.w.split("").reverse().join("");
  const others = GEN.shuffle(DATA.WORDS.filter(w => w.w !== word.w), rnd).slice(0, 3).map(w => w.w);
  return {
    hints: [
      "うしろから 1もじずつ よんでみよう",
      "ほんとうの ことばの さいしょの もじは「" + word.w[0] + "」",
      "「" + word.cat + "」の なかまだよ"
    ],
    mount(el, api) {
      el.appendChild(GEN.el("div", "qtext", "さかさまに かかれた ことばが あるよ。<br>ほんとうの ことばは どれかな？"));
      el.appendChild(GEN.el("div", "cipher-code", "「" + rev + "」"));
      GEN.choiceButtons(el, [word.w, ...others], 0, api, rnd);
    }
  };
};

// ⑨ ことばならべ（アナグラム）
GEN.builders.anagram = function (rnd, diff) {
  const maxLen = diff === 0 ? 4 : 5;
  const cands = DATA.WORDS.filter(w => w.w.length >= 3 && w.w.length <= maxLen);
  const word = GEN.pick(cands, rnd);
  const chars = word.w.split("");
  let tiles = chars;
  for (let t = 0; t < 10 && tiles.join("") === word.w; t++) tiles = GEN.shuffle(chars, rnd);
  return {
    hints: [
      "「" + word.cat + "」の なかまだよ",
      "さいしょの もじは「" + word.w[0] + "」",
      "こたえは「" + word.w + "」…ないしょだよ"
    ],
    mount(el, api) {
      el.appendChild(GEN.el("div", "qtext", "ばらばらの もじを ならべなおして<br>「" + word.cat + "」の ことばを つくろう！"));
      const slots = GEN.el("div", "anag-slots");
      el.appendChild(slots);
      const tileWrap = GEN.el("div", "anag-tiles");
      let picked = [];
      const tileBtns = [];
      const render = () => {
        slots.innerHTML = "";
        for (let i = 0; i < chars.length; i++) {
          slots.appendChild(GEN.el("div", "anag-slot", picked[i] ? picked[i].ch : ""));
        }
      };
      render();
      tiles.forEach((ch, idx) => {
        const b = GEN.el("button", "choice tile", ch);
        b.onclick = () => {
          if (b.disabled) return;
          b.disabled = true; b.classList.add("dim");
          picked.push({ ch, btn: b });
          render();
          if (picked.length === chars.length) {
            const ans = picked.map(p => p.ch).join("");
            if (ans === word.w) {
              api.solve();
            } else {
              api.miss();
              api.say("おしい！ もういちど ならべてみよう");
              picked.forEach(p => { p.btn.disabled = false; p.btn.classList.remove("dim"); });
              picked = [];
              render();
            }
          }
        };
        tileBtns.push(b);
        tileWrap.appendChild(b);
      });
      el.appendChild(tileWrap);
      const undo = GEN.el("button", "btn small", "1もじ もどす");
      undo.onclick = () => {
        const last = picked.pop();
        if (last) { last.btn.disabled = false; last.btn.classList.remove("dim"); render(); }
      };
      el.appendChild(undo);
    }
  };
};

// ⑩ しゅりけんさんすう
GEN.builders.math = function (rnd, diff) {
  let q, ans, formula;
  const ri = (min, max) => min + Math.floor(rnd() * (max - min + 1));
  if (diff === 0) {
    const a = ri(2, 9), b = ri(2, 9);
    ans = a + b;
    formula = a + " + " + b;
    q = "しゅりけんを " + a + "まい もっていたよ。ともだちから " + b + "まい もらったよ。ぜんぶで なんまい？";
  } else if (diff === 1) {
    const a = ri(2, 9), b = ri(2, 5);
    ans = a * b;
    formula = a + " × " + b;
    q = "にんじゃが " + b + "にん いるよ。ひとり " + a + "まいずつ しゅりけんを なげたよ。ぜんぶで なんまい？";
  } else {
    const a = ri(3, 9), b = ri(2, 5), c = ri(2, 9);
    ans = a * b + c;
    formula = a + " × " + b + " + " + c;
    q = "まとに " + b + "かい しゅりけんを なげて、まいかい " + a + "てん とったよ。ボーナスで " + c + "てん もらえたよ。ごうけいは なんてん？";
  }
  const set = new Set([ans]);
  while (set.size < 4) {
    const d = ans + (ri(0, 1) ? 1 : -1) * ri(1, 4);
    if (d > 0) set.add(d);
  }
  const choices = [...set].map(String);
  const aIdx = choices.indexOf(String(ans));
  return {
    hints: [
      diff === 0 ? "たしざんを つかうよ" : "かけざんを つかうよ",
      "しきは「" + formula + "」だよ",
      "こたえは「" + ans + "」…ないしょだよ"
    ],
    mount(el, api) {
      el.appendChild(GEN.el("div", "qtext", q));
      GEN.choiceButtons(el, choices, aIdx, api, rnd);
    }
  };
};

// ---------- パズル組み立て入口 ----------
GEN.build = function (type, dateKey, idx, diff) {
  const rnd = GEN.rng(GEN.hash(dateKey + ":" + type + ":" + idx + ":d" + diff));
  const p = GEN.builders[type](rnd, diff);
  const meta = DATA.MISSION_TYPES[type];
  p.type = type;
  p.icon = meta.icon;
  p.label = meta.label;
  p.story = meta.story;
  p.title = p.title || meta.label;
  return p;
};
