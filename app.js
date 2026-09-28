/* ============ Испанские слова — локальное приложение для повторения ============ */
/* Все данные хранятся только в localStorage этого браузера, на этом компьютере. */

const LS_PROGRESS = "esapp_progress_v1";
const LS_HISTORY  = "esapp_history_v1";
const LS_STREAK   = "esapp_streak_v1";

const INTERVALS_DAYS = [0, 1, 3, 7, 14, 30]; // box 0..5

/* ---------- утилиты ---------- */
function pad(n) { return n < 10 ? "0" + n : "" + n; }
function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
function normKey(es) { return es.trim().toLowerCase(); }
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function saveJSON(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
}

/* ---------- прогресс по словам ---------- */
let PROGRESS = loadJSON(LS_PROGRESS, {});
let HISTORY = loadJSON(LS_HISTORY, {});
let STREAK = loadJSON(LS_STREAK, { streak: 0, lastDate: null });

function getProgress(es) {
  const k = normKey(es);
  if (!PROGRESS[k]) {
    PROGRESS[k] = { box: 0, next: 0, total: 0, correct: 0, fails: 0, difficult: false, customAssoc: "", lastSeen: null, lastWrong: false };
  }
  if (PROGRESS[k].lastWrong === undefined) PROGRESS[k].lastWrong = false; // для старого сохранённого прогресса
  return PROGRESS[k];
}
function dateStrOf(ts) {
  const d = new Date(ts);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
function seenToday(p) { return p.lastSeen && dateStrOf(p.lastSeen) === todayStr(); }
function saveProgress() { saveJSON(LS_PROGRESS, PROGRESS); if (window.CloudSync) window.CloudSync.schedulePush(); }
function saveHistory() { saveJSON(LS_HISTORY, HISTORY); if (window.CloudSync) window.CloudSync.schedulePush(); }
function saveStreak() { saveJSON(LS_STREAK, STREAK); if (window.CloudSync) window.CloudSync.schedulePush(); }

function touchStreak() {
  const t = todayStr();
  if (STREAK.lastDate === t) return;
  const y = daysAgoStr(1);
  if (STREAK.lastDate === y) STREAK.streak += 1;
  else STREAK.streak = 1;
  STREAK.lastDate = t;
  saveStreak();
}

function registerReview(es, correct) {
  const t = todayStr();
  if (!HISTORY[t]) HISTORY[t] = { reviewed: 0, correct: 0 };
  HISTORY[t].reviewed += 1;
  if (correct) HISTORY[t].correct += 1;
  saveHistory();
  touchStreak();

  const p = getProgress(es);
  p.total += 1;
  p.lastSeen = Date.now();
  p.lastWrong = !correct; // ошибка — слово идёт первым в следующий раз, пока не ответят верно
  if (correct) {
    p.correct += 1;
    p.box = Math.min(5, p.box + 1);
    p.fails = Math.max(0, p.fails - 1);
    if (p.box >= 2) p.difficult = false;
    p.next = Date.now() + INTERVALS_DAYS[p.box] * 86400000;
  } else {
    p.box = Math.max(0, p.box - 1);
    p.fails += 1;
    if (p.fails >= 3) p.difficult = true;
    // ошибка — слово возвращается в повторение не раньше следующего дня, а не сразу в новой сессии
    p.next = Date.now() + Math.max(1, INTERVALS_DAYS[p.box]) * 86400000;
  }
  saveProgress();
}

function markDifficult(es) {
  const p = getProgress(es);
  p.difficult = true;
  p.fails = Math.max(p.fails, 3);
  saveProgress();
}

function isDue(p, now) { return !p.next || p.next <= now; }

function countDue() {
  const now = Date.now();
  let c = 0;
  for (const w of WORDS_DATA) if (isDue(getProgress(w.es), now)) c++;
  return c;
}
function countMastered() {
  let c = 0;
  for (const w of WORDS_DATA) if (getProgress(w.es).box >= 4) c++;
  return c;
}
function countLearning() {
  let c = 0;
  for (const w of WORDS_DATA) { const b = getProgress(w.es).box; if (b >= 1 && b < 4) c++; }
  return c;
}
function countDifficult() {
  let c = 0;
  for (const w of WORDS_DATA) if (getProgress(w.es).difficult) c++;
  return c;
}

/* ---------- построение очереди сессии ---------- */
function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function buildQueue(n) {
  const now = Date.now();
  const sortFn = (a, b) => {
    if (a.p.lastWrong !== b.p.lastWrong) return a.p.lastWrong ? -1 : 1; // ошибки вчера/сегодня — первыми
    const aDue = isDue(a.p, now), bDue = isDue(b.p, now);
    if (aDue !== bDue) return aDue ? -1 : 1;
    if (a.p.difficult !== b.p.difficult) return a.p.difficult ? -1 : 1;
    const aOver = aDue ? now - (a.p.next || 0) : 0;
    const bOver = bDue ? now - (b.p.next || 0) : 0;
    if (aOver !== bOver) return bOver - aOver;
    return a.w.id - b.w.id;
  };

  const all = WORDS_DATA.map((w) => ({ w, p: getProgress(w.es) }));
  // слова, уже пройденные СЕГОДНЯ (правильно или с ошибкой), — не повторяем до следующего дня;
  // ошибки просто переходят в первый план ЗАВТРА (см. sortFn: lastWrong — первыми)
  let pool = all.filter((x) => !seenToday(x.p));
  if (pool.length === 0) pool = all; // если все слова уже пройдены сегодня — не оставлять сессию пустой

  pool.sort(sortFn);
  const selected = pool.slice(0, n);
  // слова с ошибкой всегда идут первыми; внутри каждой группы порядок перемешан
  const mistakes = shuffleArray(selected.filter((x) => x.p.lastWrong));
  const rest = shuffleArray(selected.filter((x) => !x.p.lastWrong));
  return [...mistakes, ...rest].map((x) => x.w);
}

/* ============ Транслитерация + автогенерация ассоциаций ============ */
const RHYME_BANK = [
  "кот","нос","рука","стол","боль","сон","лес","дом","вода","хлеб","снег","огонь","стена",
  "звезда","река","гора","море","роза","злой","гром","сыр","мышь","рыба","нога","рог","конь",
  "гусь","ключ","замок","масло","соль","перец","мясо","молоко","чай","кофе","сахар","мёд",
  "лист","ветер","дождь","туча","солнце","луна","песок","камень","трава","цветок","дерево",
  "птица","орёл","волк","лиса","медведь","заяц","слон","тигр","лев","змея","паук","муравей",
  "окно","дверь","стул","диван","лампа","зеркало","полка","ковёр","подушка","одеяло","чашка",
  "тарелка","ложка","вилка","нож","стакан","бутылка","сумка","ключи","часы","телефон","книга",
  "тетрадь","ручка","карандаш","доска","парта","школа","учитель","друг","враг","сосед","гость",
  "танец","песня","игра","смех","слёзы","радость","грусть","страх","злость","любовь","дружба",
  "город","улица","площадь","дорога","мост","башня","замок","парк","сад","поле","берег","остров",
  "поезд","машина","самолёт","корабль","велосипед","автобус","такси","билет","паспорт","чемодан",
  "рынок","магазин","деньги","монета","банк","цена","подарок","праздник","гость","свеча","торт",
  "голова","рука","нога","глаз","ухо","нос","рот","зуб","сердце","живот","спина","палец","плечо",
  "врач","аптека","лекарство","боль","кашель","температура","простуда","укол","бинт","кровь",
];

function transliterateEs(word) {
  let w = word.toLowerCase();
  const rules = [
    [/ch/g, "ч"], [/ll/g, "й"], [/rr/g, "р"], [/qu([ei])/g, "к$1"],
    [/gu([ei])/g, "г$1"], [/ñ/g, "нь"], [/j/g, "х"], [/h/g, ""],
    [/c([ei])/g, "с$1"], [/c/g, "к"], [/g([ei])/g, "х$1"], [/g/g, "г"],
    [/z/g, "с"], [/y/g, "й"], [/v/g, "в"], [/b/g, "б"], [/d/g, "д"],
    [/f/g, "ф"], [/k/g, "к"], [/l/g, "л"], [/m/g, "м"], [/n/g, "н"],
    [/p/g, "п"], [/r/g, "р"], [/s/g, "с"], [/t/g, "т"], [/w/g, "в"],
    [/x/g, "кс"], [/a/g, "а"], [/e/g, "е"], [/i/g, "и"], [/o/g, "о"],
    [/u/g, "у"], [/[^Ѐ-ӿ\s'-]/g, ""],
  ];
  for (const [re, rep] of rules) w = w.replace(re, rep);
  return w;
}

function findRhyme(translit) {
  let best = null;
  for (const r of RHYME_BANK) {
    if (translit.includes(r) && (!best || r.length > best.length)) best = r;
  }
  return best;
}

/* ============ Проверка написанного ответа ============ */
const ACCENT_MAP = { "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u", "ü": "u", "ñ": "n" };
function stripAccentsEs(s) {
  return s.replace(/[áéíóúüñ]/g, (c) => ACCENT_MAP[c] || c);
}
function normalizeAnswer(s, stripAccents) {
  let out = s
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/[.,;:!?"'«»¿¡]/g, "")
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
  if (stripAccents) out = stripAccentsEs(out);
  return out;
}
function matchAnswer(userInput, field, stripAccents) {
  const u = normalizeAnswer(userInput, stripAccents);
  if (!u) return false;
  const variants = field.split(",").map((v) => normalizeAnswer(v, stripAccents)).filter(Boolean);
  return variants.some((v) => {
    if (v === u) return true;
    if (u.length >= 3 && v.includes(u)) return true;
    if (v.length >= 3 && u.includes(v)) return true;
    return false;
  });
}

/* ============ Направление перевода ============ */
const LS_DIRECTION = "esapp_direction_v1";
let DIRECTION = loadJSON(LS_DIRECTION, "es-ru"); // "es-ru" | "ru-es" | "mixed"
function saveDirection(d) {
  DIRECTION = d;
  saveJSON(LS_DIRECTION, d);
  if (window.CloudSync) window.CloudSync.schedulePush();
}
function pickCardDirection() {
  if (DIRECTION === "mixed") return Math.random() < 0.5 ? "es-ru" : "ru-es";
  return DIRECTION;
}
function wrapWithDirections(words) {
  return words.map((w) => ({ word: w, dir: pickCardDirection() }));
}

const LS_AI_ASSOC_CACHE = "esapp_ai_assoc_cache_v1";
function loadAiAssocCache() { return loadJSON(LS_AI_ASSOC_CACHE, {}); }
function saveAiAssocCache(cache) { saveJSON(LS_AI_ASSOC_CACHE, cache); }
async function generateAiAssociationFor(es, ru) {
  const key = normKey(es);
  const cache = loadAiAssocCache();
  if (cache[key]) return cache[key];
  const prompt = `Придумай запоминающуюся ассоциацию (мнемонику) на русском языке для испанского слова или фразы "${es}" (перевод: "${ru}"). Используй созвучие с русскими словами или яркий образ, в духе этих примеров:
«ALGUIEN — начало похоже на «ГЕНий»: если гений где-то есть — значит, alguien (кто-то) точно есть в комнате.»
«VOY — «ВОй!» — я убегаю с воем: voy = я иду/еду.»
Ответь одним-двумя предложениями — только сама ассоциация, без вступления и без кавычек вокруг всего ответа.`;
  const raw = await callGeminiRaw(prompt);
  const text = raw.trim();
  if (!text) throw new Error("Пустой ответ ИИ.");
  cache[key] = text;
  saveAiAssocCache(cache);
  return text;
}
function getAssociation(es, ru) {
  const key = normKey(es);
  const p = getProgress(es);
  if (p.customAssoc) return { text: p.customAssoc, tag: "custom" };
  if (ASSOC_OVERRIDES[key]) return { text: ASSOC_OVERRIDES[key], tag: "ai" };
  const aiCache = loadAiAssocCache();
  if (aiCache[key]) return { text: aiCache[key], tag: "ai" };
  const translit = transliterateEs(es);
  const rhyme = findRhyme(translit);
  let text;
  if (rhyme) {
    text = `«${es}» звучит примерно как «${translit}». Слышишь внутри «${rhyme}»? Представь яркую картинку: ${rhyme} и «${ru}» — свяжи их в одной сцене, и слово запомнится.`;
  } else {
    text = `«${es}» звучит примерно как «${translit}». Попробуй сам(а) найти похожее русское слово внутри «${translit}» и построить яркую картинку со значением «${ru}».`;
  }
  return { text, tag: "auto", translit };
}

/* ============ Навигация ============ */
const views = ["home", "words", "assoc", "texts", "duo"];
function showView(name) {
  views.forEach((v) => {
    document.getElementById("view-" + v).classList.toggle("active", v === name);
    document.getElementById("nav-" + v).classList.toggle("active", v === name);
  });
  if (name === "home") renderHome();
  if (name === "words") renderWords();
  if (name === "assoc") renderAssocList();
  if (name === "texts") renderTexts();
  if (name === "duo") renderDuo();
}

/* ============ Главная ============ */
function renderHome() {
  const passedForPct = countMastered() + countLearning();
  const progressPct = WORDS_DATA.length ? Math.round((passedForPct / WORDS_DATA.length) * 100) : 0;
  document.getElementById("stat-progress-pct").textContent = progressPct + "%";
  const t = HISTORY[todayStr()] || { reviewed: 0, correct: 0 };
  document.getElementById("stat-today").textContent = t.reviewed;
  document.getElementById("stat-due").textContent = countDue();
  document.getElementById("stat-total").textContent = WORDS_DATA.length;

  const mastered = countMastered();
  const learning = countLearning();
  document.getElementById("home-breakdown").innerHTML =
    `<div class="progressbar-outer"><div class="progressbar-inner" style="width:${(mastered / WORDS_DATA.length * 100).toFixed(1)}%"></div></div>
     <div style="font-size:12.5px;color:var(--muted);margin-top:6px;">
        Закреплено: <b style="color:var(--primary-dark)">${mastered}</b> ·
        Учится: <b style="color:var(--accent)">${learning}</b> ·
        Нужно подучить: <b style="color:var(--danger)">${countDue()}</b> ·
        Сложные слова: <b style="color:var(--warn)">${countDifficult()}</b>
     </div>`;
}

/* ============ Сессия повторения ============ */
let SESSION = null; // { queue, idx, correctCount, revealed }

function openSessionWithQueue(words) {
  if (words.length === 0) { alert("Нет слов для повторения."); return; }
  SESSION = {
    mode: "quiz",
    queue: wrapWithDirections(words), idx: 0, correctCount: 0, revealed: false, showAssoc: false,
    typedChecked: false, typedValue: "", typedCorrect: null,
  };
  document.getElementById("session-overlay").style.display = "flex";
  renderCard();
}
function startSession(n) {
  openSessionWithQueue(buildQueue(n));
}
function wordsByEs(esList) {
  const set = new Set(esList.map((e) => e.toLowerCase()));
  return shuffleArray(WORDS_DATA.filter((w) => set.has(w.es.toLowerCase())));
}
function startSessionForWords(esList) {
  openSessionWithQueue(wordsByEs(esList));
}
function startLearnForWords(esList) {
  const words = wordsByEs(esList);
  if (words.length === 0) { alert("Нет слов для изучения."); return; }
  SESSION = {
    mode: "learn",
    queue: words.map((w) => ({ word: w })), idx: 0, correctCount: 0, revealed: false, showAssoc: false,
    typedChecked: false, typedValue: "", typedCorrect: null,
    learnEsList: esList,
  };
  document.getElementById("session-overlay").style.display = "flex";
  renderCard();
}
function closeSession() {
  document.getElementById("session-overlay").style.display = "none";
  SESSION = null;
  renderHome();
}
function currentItem() { return SESSION.queue[SESSION.idx]; }
function currentWord() { return currentItem().word; }
function currentDir() { return currentItem().dir; }

function renderCard() {
  const total = SESSION.queue.length;
  const idx = SESSION.idx;
  document.getElementById("session-progress-text").textContent = `${Math.min(idx + 1, total)} / ${total}`;
  document.getElementById("session-progress-bar").style.width = `${(Math.min(idx, total) / total) * 100}%`;

  if (idx >= total) {
    if (SESSION.mode === "learn") {
      const esListJson = JSON.stringify(SESSION.learnEsList).replace(/'/g, "&#39;");
      document.getElementById("flash-area").innerHTML = `
        <div class="session-done">
          <div class="big">📖</div>
          <h2>Слова показаны!</h2>
          <p>Теперь проверь, как запомнил(а), — так они попадут в повторение.</p>
          <button class="reveal-btn" onclick='startSessionForWords(${esListJson})'>✍️ Проверить себя</button>
          <button class="reveal-btn ghost" onclick="closeSession()">Позже</button>
        </div>`;
      return;
    }
    const pct = total ? Math.round((SESSION.correctCount / total) * 100) : 0;
    document.getElementById("flash-area").innerHTML = `
      <div class="session-done">
        <div class="big">🎉</div>
        <h2>Сессия завершена!</h2>
        <p>Правильно: <b>${SESSION.correctCount}</b> из <b>${total}</b> (${pct}%)</p>
        <button class="reveal-btn" onclick="closeSession()">Готово</button>
      </div>`;
    return;
  }

  if (SESSION.mode === "learn") {
    renderLearnCard();
    return;
  }

  const w = currentWord();
  const dir = currentDir();
  const isRuToEs = dir === "ru-es";
  const promptText = isRuToEs ? w.ru : w.es;
  const targetText = isRuToEs ? w.es : w.ru;
  const revealed = SESSION.revealed;
  let assocHtml = "";
  if (SESSION.showAssoc) {
    const a = getAssociation(w.es, w.ru);
    assocHtml = `<div class="assoc-box">🧠 ${escapeHtml(a.text)}</div>`;
  }

  let feedbackHtml = "";
  if (revealed && SESSION.typedChecked) {
    feedbackHtml = SESSION.typedCorrect
      ? `<div class="typed-feedback good">✅ Верно! Ты написал(а): «${escapeHtml(SESSION.typedValue)}»</div>`
      : SESSION.typedValue
        ? `<div class="typed-feedback bad">❌ Ты написал(а): «${escapeHtml(SESSION.typedValue)}»</div>`
        : `<div class="typed-feedback bad">❌ Пропущено</div>`;
  }

  document.getElementById("flash-area").innerHTML = `
    <div class="flash-wrap">
      <div class="flashcard" id="flip-card">
        ${revealed ? micButtonHtml(targetText, "card-mic-btn") : ""}
        <div class="dir-badge">${isRuToEs ? "RU → ES" : "ES → RU"}</div>
        <div class="es-word">${escapeHtml(promptText)}</div>
        ${revealed ? `<div class="ru-word">${escapeHtml(targetText)}</div>` : ""}
        ${feedbackHtml}
        ${assocHtml}
      </div>
      ${!revealed ? `
        <div class="type-answer-row">
          <input type="text" id="type-answer-input" class="type-answer-input" placeholder="Твой перевод..." autocomplete="off">
          ${micAnswerButtonHtml(isRuToEs ? "es-ES" : "ru-RU")}
          <button class="check-btn" onclick="checkTyped()">Проверить</button>
        </div>
        <button class="think-btn" onclick="toggleAssocInSession()">🧠 Не могу запомнить — показать ассоциацию</button>
      ` : `
        <button class="reveal-btn" onclick="nextCard()">Далее</button>
        <button class="think-btn" onclick="toggleAssocInSession()">🧠 ${SESSION.showAssoc ? "Скрыть" : "Показать"} ассоциацию</button>
      `}
    </div>`;

  if (!revealed) {
    const input = document.getElementById("type-answer-input");
    if (input) input.focus();
  }
}
function checkTyped() {
  const input = document.getElementById("type-answer-input");
  const value = input ? input.value.trim() : "";
  const item = currentItem();
  const w = item.word;
  const isRuToEs = item.dir === "ru-es";
  const targetText = isRuToEs ? w.es : w.ru;
  const correct = matchAnswer(value, targetText, isRuToEs);

  SESSION.typedChecked = true;
  SESSION.typedValue = value;
  SESSION.typedCorrect = correct;
  SESSION.revealed = true;

  registerReview(w.es, correct);
  if (correct) {
    SESSION.correctCount++;
  } else {
    // возвращаем слово в очередь через 3-5 карточек для повторного закрепления
    const reinsertAt = Math.min(SESSION.queue.length, SESSION.idx + 1 + 3 + Math.floor(Math.random() * 3));
    if (SESSION.queue.filter((x) => x.word.es === w.es).length < 2) {
      SESSION.queue.splice(reinsertAt, 0, item);
    }
  }
  renderCard();
}
function nextCard() {
  SESSION.idx++;
  SESSION.revealed = false;
  SESSION.showAssoc = false;
  SESSION.typedChecked = false;
  SESSION.typedValue = "";
  SESSION.typedCorrect = null;
  renderCard();
}
function toggleAssocInSession() {
  SESSION.showAssoc = !SESSION.showAssoc;
  if (SESSION.showAssoc && SESSION.mode !== "learn") markDifficult(currentWord().es);
  renderCard();
  if (SESSION.showAssoc) requestBetterAssocFor(currentWord(), renderCard);
}
function requestBetterAssocFor(w, onImproved) {
  const a = getAssociation(w.es, w.ru);
  if (a.tag !== "auto" || !loadAiKey()) return;
  generateAiAssociationFor(w.es, w.ru)
    .then(() => { if (currentWord() && currentWord().es === w.es) onImproved(); })
    .catch(() => {});
}

/* ============ Карточка изучения (новые слова) ============ */
function renderLearnCard() {
  const w = currentWord();
  let assocHtml = "";
  if (SESSION.showAssoc) {
    const a = getAssociation(w.es, w.ru);
    assocHtml = `<div class="assoc-box">🧠 ${escapeHtml(a.text)}</div>`;
  }
  document.getElementById("flash-area").innerHTML = `
    <div class="flash-wrap">
      <div class="flashcard">
        ${micButtonHtml(w.es, "card-mic-btn")}
        <div class="dir-badge learn-badge">📖 Изучение</div>
        <div class="es-word">${escapeHtml(w.es)}</div>
        <div class="ru-word">${escapeHtml(w.ru)}</div>
        ${assocHtml}
      </div>
      <button class="reveal-btn" onclick="nextCard()">Далее</button>
      <button class="think-btn" onclick="toggleAssocInSession()">🧠 ${SESSION.showAssoc ? "Скрыть" : "Показать"} ассоциацию</button>
    </div>`;
}

/* ============ Слова (список) ============ */
let wordsFilter = "all";
let wordsSearch = "";
function renderWords() {
  const listEl = document.getElementById("words-list");
  const now = Date.now();
  let items = WORDS_DATA;
  if (wordsFilter === "due") items = items.filter((w) => isDue(getProgress(w.es), now));
  else if (wordsFilter === "difficult") items = items.filter((w) => getProgress(w.es).difficult);
  else if (wordsFilter === "mastered") items = items.filter((w) => getProgress(w.es).box >= 4);
  else if (wordsFilter === "new") items = items.filter((w) => getProgress(w.es).total === 0);

  if (wordsSearch.trim()) {
    const s = wordsSearch.trim().toLowerCase();
    items = items.filter((w) => w.es.toLowerCase().includes(s) || w.ru.toLowerCase().includes(s));
  }

  document.getElementById("words-count").textContent = `${items.length} слов`;

  if (items.length === 0) {
    listEl.innerHTML = `<div class="empty-state">Ничего не найдено</div>`;
    return;
  }
  const frag = items.slice(0, 400).map((w) => {
    const p = getProgress(w.es);
    const dots = Array.from({ length: 5 }, (_, i) => `<span class="dot ${i < p.box ? "on" : ""}"></span>`).join("");
    return `<div class="word-row">
      <div>
        <div class="es">${escapeHtml(w.es)}</div>
        <div class="ru">${escapeHtml(w.ru)}</div>
      </div>
      <div class="box-dots">${dots}</div>
      ${micButtonHtml(w.es)}
      <button class="assoc-btn" onclick="openAssocFor('${encodeURIComponent(w.es)}')">🧠</button>
    </div>`;
  }).join("");
  listEl.innerHTML = frag + (items.length > 400 ? `<div class="empty-state">Показаны первые 400 из ${items.length}. Уточни поиск.</div>` : "");
}

function setWordsFilter(f) {
  wordsFilter = f;
  document.querySelectorAll("#words-filters .filter-chip").forEach((el) => el.classList.toggle("active", el.dataset.f === f));
  renderWords();
}

/* ============ Ассоциации ============ */
function renderAssocList() {
  const el = document.getElementById("assoc-list");
  const q = (document.getElementById("assoc-search").value || "").trim().toLowerCase();
  let items;
  if (q) {
    items = WORDS_DATA.filter((w) => w.es.toLowerCase().includes(q) || w.ru.toLowerCase().includes(q)).slice(0, 60);
  } else {
    items = WORDS_DATA.filter((w) => getProgress(w.es).difficult);
  }
  if (items.length === 0) {
    el.innerHTML = `<div class="empty-state">${q ? "Ничего не найдено" : "Пока нет сложных слов 🎉<br>Они появятся здесь, когда ты 3 раза ошибёшься в слове во время повторения — или нажми «Не могу запомнить» в сессии."}</div>`;
    return;
  }
  el.innerHTML = items.map((w) => renderAssocDetail(w)).join("");
}
function renderAssocDetail(w) {
  const a = getAssociation(w.es, w.ru);
  const p = getProgress(w.es);
  const tagLabel = a.tag === "ai" ? "🤖 ассоциация от ИИ" : a.tag === "custom" ? "✍️ твоя ассоциация" : "⚙️ черновая (авто)";
  const tagCls = a.tag === "auto" ? "auto" : "";
  const isAuto = a.tag === "auto";
  return `<div class="assoc-detail">
    <div class="es">${escapeHtml(w.es)}</div>
    <div class="ru">${escapeHtml(w.ru)}</div>
    <span class="tag ${tagCls}">${tagLabel}</span>
    <div class="body">${escapeHtml(a.text)}</div>
    ${isAuto ? `
      <div class="assoc-request">
        Это черновая подсказка (просто созвучие), а не настоящая ассоциация.
        ${loadAiKey()
          ? `<button class="small-btn learn-btn" onclick="generateAiAssocForList('${encodeURIComponent(w.es)}', this)">🤖 Сгенерировать ассоциацию</button>`
          : `Вставь свой ключ ИИ в разделе «Тексты», чтобы генерировать ассоциации автоматически — или напиши мне в чате: <b>«сделай ассоциацию для ${escapeHtml(w.es)}»</b>.
             <button class="small-btn" onclick="copyWordToClipboard('${encodeURIComponent(w.es)}', this)">📋 Скопировать слово</button>`
        }
      </div>
    ` : ""}
    <textarea placeholder="Своя ассоциация (необязательно) — сохранится и заменит показанную выше" id="ta-${cssId(w.es)}">${escapeHtml(p.customAssoc || "")}</textarea>
    <div class="settings-row">
      <button class="small-btn" onclick="saveCustomAssoc('${encodeURIComponent(w.es)}')">Сохранить</button>
      ${p.difficult ? `<button class="small-btn" onclick="unmarkDifficult('${encodeURIComponent(w.es)}')">Убрать из сложных</button>` : `<button class="small-btn" onclick="markDifficultAndRerender('${encodeURIComponent(w.es)}')">Добавить в сложные</button>`}
    </div>
  </div>`;
}
async function generateAiAssocForList(esEnc, btn) {
  const es = decodeURIComponent(esEnc);
  const w = WORDS_DATA.find((x) => x.es === es);
  if (!w) return;
  const oldLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = "⏳ Генерирую...";
  try {
    await generateAiAssociationFor(w.es, w.ru);
    renderAssocList();
  } catch (e) {
    alert("Не получилось сгенерировать ассоциацию: " + e.message);
    btn.disabled = false;
    btn.textContent = oldLabel;
  }
}
function copyWordToClipboard(esEnc, btn) {
  const es = decodeURIComponent(esEnc);
  const text = `сделай ассоциацию для ${es}`;
  const done = () => { const old = btn.textContent; btn.textContent = "✅ Скопировано"; setTimeout(() => { btn.textContent = old; }, 1500); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => alert(text));
  } else {
    alert(text);
  }
}
function cssId(es) { return es.replace(/[^a-zA-Zа-яА-Я0-9]/g, "_"); }
function saveCustomAssoc(esEnc) {
  const es = decodeURIComponent(esEnc);
  const ta = document.getElementById("ta-" + cssId(es));
  const p = getProgress(es);
  p.customAssoc = ta.value.trim();
  saveProgress();
  renderAssocList();
}
function unmarkDifficult(esEnc) {
  const es = decodeURIComponent(esEnc);
  const p = getProgress(es);
  p.difficult = false; p.fails = 0;
  saveProgress();
  renderAssocList();
}
function markDifficultAndRerender(esEnc) {
  markDifficult(decodeURIComponent(esEnc));
  renderAssocList();
}
function openAssocFor(esEnc) {
  showView("assoc");
  document.getElementById("assoc-search").value = decodeURIComponent(esEnc);
  renderAssocList();
}

/* ============ Тексты (генерируются ИИ по запросу) ============ */
const LS_AI_KEY = "esapp_ai_key";
let currentGeneratedText = null;
let currentTextLang = "es";
let genLang = "es";

function knownSet() {
  const s = new Set();
  for (const w of WORDS_DATA) s.add(normKey(w.es));
  return s;
}
const STOP_WORDS = new Set(["a","al","el","la","los","las","un","una","unos","unas","y","o","de","en","que","no","es","son","con","por","para","se","su","sus","mi","tu","lo","le","les","me","te","nos","del","si"]);

function tokenize(text) {
  return text.toLowerCase().replace(/[¡¿.,!?;:"""'()]/g, "").split(/\s+/).filter(Boolean);
}
function textKnownPct(text) {
  const ks = knownSet();
  const tokens = tokenize(text);
  if (tokens.length === 0) return 100;
  let known = 0;
  for (const t of tokens) if (ks.has(t) || STOP_WORDS.has(t)) known++;
  return Math.round((known / tokens.length) * 100);
}
function highlightUnknown(text) {
  const ks = knownSet();
  return text.split(/(\s+)/).map((chunk) => {
    if (/^\s+$/.test(chunk)) return chunk;
    const clean = chunk.toLowerCase().replace(/[¡¿.,!?;:"""'()]/g, "");
    if (!clean) return escapeHtml(chunk);
    if (ks.has(clean) || STOP_WORDS.has(clean)) return escapeHtml(chunk);
    return `<span class="unknown">${escapeHtml(chunk)}</span>`;
  }).join("");
}

function loadAiKey() { return (localStorage.getItem(LS_AI_KEY) || "").trim(); }
async function callGeminiRaw(prompt) {
  const key = loadAiKey();
  if (!key) throw new Error("Нет сохранённого ключа ИИ.");
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!resp.ok) {
    if (resp.status === 503) throw new Error("ИИ сейчас перегружен (слишком много запросов у Google). Подожди немного и попробуй ещё раз.");
    const errText = await resp.text().catch(() => "");
    throw new Error(`Сервер ответил ошибкой ${resp.status}. ${errText.slice(0, 200)}`);
  }
  const data = await resp.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}
function saveAiKey() {
  const input = document.getElementById("ai-key-input");
  const key = input.value.trim();
  if (!key) return;
  localStorage.setItem(LS_AI_KEY, key);
  input.value = "";
  renderTexts();
}
function clearAiKey() {
  localStorage.removeItem(LS_AI_KEY);
  renderTexts();
}
function setGenLang(lang) {
  genLang = lang;
  document.querySelectorAll("#gen-lang-toggle .filter-chip").forEach((el) => el.classList.toggle("active", el.dataset.lang === lang));
}
function sampleVocabForPrompt(n) {
  const pool = WORDS_DATA.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
  }
  return pool.slice(0, n).map((w) => w.es);
}
function renderTexts() {
  const key = loadAiKey();
  document.getElementById("ai-key-card").style.display = key ? "none" : "block";
  document.getElementById("ai-key-status").textContent = key ? "Ключ сохранён в этом браузере." : "";
  if (currentGeneratedText) {
    document.getElementById("texts-generate").style.display = "none";
    document.getElementById("text-reader").style.display = "block";
    renderReader();
  } else {
    document.getElementById("texts-generate").style.display = "block";
    document.getElementById("text-reader").style.display = "none";
  }
}
async function generateNewText() {
  const key = loadAiKey();
  if (!key) { alert("Сначала вставь и сохрани ключ ИИ выше."); return; }
  const btn = document.getElementById("generate-text-btn");
  const oldLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = "⏳ Генерирую...";
  const words = sampleVocabForPrompt(55);
  const prompt = `Ты помощник для изучения испанского языка. Составь короткий текст (4-6 предложений, уровень A2, простая грамматика) на испанском языке, используя как можно больше следующих слов и фраз из словаря ученика: ${words.join(", ")}. Тема свободная и естественная, текст связный.
Ответь СТРОГО в формате JSON без markdown-разметки и пояснений, ровно так:
{"title": "короткое название на русском", "es": "текст на испанском", "ru": "точный перевод текста на русский"}`;
  try {
    const raw = await callGeminiRaw(prompt);
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (!parsed.es || !parsed.ru) throw new Error("Не удалось разобрать ответ ИИ.");
    currentGeneratedText = { title: parsed.title || "Новый текст", es: parsed.es, ru: parsed.ru };
    currentTextLang = genLang;
    document.getElementById("texts-generate").style.display = "none";
    document.getElementById("text-reader").style.display = "block";
    renderReader();
  } catch (e) {
    alert("Не получилось сгенерировать текст: " + e.message + "\n\nПроверь ключ (в начале раздела «Тексты») и соединение с интернетом.");
  } finally {
    btn.disabled = false;
    btn.textContent = oldLabel;
  }
}
function closeReader() {
  document.getElementById("text-reader").style.display = "none";
  document.getElementById("texts-generate").style.display = "block";
}
function setTextLang(lang) {
  currentTextLang = lang;
  renderReader();
}
function renderReader() {
  const t = currentGeneratedText;
  if (!t) return;
  const pct = textKnownPct(t.es);
  document.getElementById("reader-title").textContent = t.title;
  document.getElementById("lang-es-btn").classList.toggle("active", currentTextLang === "es");
  document.getElementById("lang-ru-btn").classList.toggle("active", currentTextLang === "ru");
  const body = currentTextLang === "es" ? highlightUnknown(t.es) : escapeHtml(t.ru);
  document.getElementById("reader-body").innerHTML = body;
  document.getElementById("reader-mic").innerHTML = currentTextLang === "es"
    ? micButtonHtml(t.es, "reader-mic-btn") + `<span class="reader-mic-label">Прочитай текст вслух и проверь произношение</span>`
    : "";
  document.getElementById("reader-meta").textContent = currentTextLang === "es" ? `Известно слов в тексте: ${pct}% (выделены слова, которых ещё нет в твоём наборе)` : "";
}
function regenerateText() {
  currentGeneratedText = null;
  document.getElementById("text-reader").style.display = "none";
  document.getElementById("texts-generate").style.display = "block";
}

/* ============ Учёба из DUO ============ */
function formatDateRu(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}
function renderDuo() {
  const el = document.getElementById("duo-list");
  if (typeof DUO_LOG === "undefined" || DUO_LOG.length === 0) {
    el.innerHTML = `<div class="empty-state">Пока нет разборов уроков. Попроси «пройди урок дуолинго» — и конспект появится здесь.</div>`;
    return;
  }
  const days = [...DUO_LOG].sort((a, b) => (a.date < b.date ? 1 : -1));
  el.innerHTML = days.map((day) => renderDuoDay(day)).join("");
}
function renderDuoDay(day) {
  const lessonsHtml = day.lessons.map((l) => {
    let scoreHtml = "";
    if (l.total) {
      const pct = Math.round((l.correct / l.total) * 100);
      scoreHtml = `<span class="duo-lesson-score">${l.perfect ? "💯" : pct + "%"} (${l.correct}/${l.total})</span>`;
    }
    return `<div class="duo-lesson-row">
      <span>${escapeHtml(l.skill)} · ${escapeHtml(l.lessonNum)}</span>
      ${scoreHtml}
    </div>`;
  }).join("");

  const wordsHtml = (day.newWords || []).map((es) => {
    const w = WORDS_DATA.find((x) => x.es.toLowerCase() === es.toLowerCase());
    if (!w) return "";
    return `<div class="duo-word-chip"><b>${escapeHtml(w.es)}</b> — ${escapeHtml(w.ru)}</div>`;
  }).join("");

  const rulesHtml = (day.rules || []).map((r) => `
    <div class="duo-rule">
      <div class="duo-rule-title">📐 ${escapeHtml(r.title)}</div>
      <div class="duo-rule-body">${escapeHtml(r.explanation).replace(/\n/g, "<br>")}</div>
    </div>`).join("");

  return `<div class="duo-day card">
    <div class="duo-day-date">${formatDateRu(day.date)}</div>
    <div class="duo-lessons">${lessonsHtml}</div>

    ${wordsHtml ? `
      <div class="section-title" style="margin-top:14px;">Новые слова (${day.newWords.length})</div>
      <div class="duo-words-grid">${wordsHtml}</div>
      <div class="settings-row" style="margin-top:8px;">
        <button class="small-btn learn-btn" onclick='startLearnForWords(${JSON.stringify(day.newWords)})'>📖 Изучить</button>
        <button class="small-btn" onclick='startSessionForWords(${JSON.stringify(day.newWords)})'>✍️ Проверить себя</button>
      </div>
    ` : ""}

    ${rulesHtml ? `<div class="section-title" style="margin-top:14px;">Правила — почему так, а не иначе</div>${rulesHtml}` : ""}
  </div>`;
}

/* ============ helpers ============ */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ============ настройки: экспорт/импорт/сброс ============ */
function exportData() {
  const blob = new Blob([JSON.stringify({ PROGRESS, HISTORY, STREAK }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `spanish-words-progress-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (data.PROGRESS) PROGRESS = data.PROGRESS;
      if (data.HISTORY) HISTORY = data.HISTORY;
      if (data.STREAK) STREAK = data.STREAK;
      saveProgress(); saveHistory(); saveStreak();
      alert("Прогресс импортирован!");
      renderHome();
    } catch (e) { alert("Не удалось прочитать файл."); }
  };
  reader.readAsText(file);
}
function resetProgress() {
  if (!confirm("Сбросить весь прогресс повторения? Список слов останется.")) return;
  PROGRESS = {}; HISTORY = {}; STREAK = { streak: 0, lastDate: null };
  saveProgress(); saveHistory(); saveStreak();
  renderHome();
}

/* ============ инициализация ============ */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("nav-home").addEventListener("click", () => showView("home"));
  document.getElementById("nav-words").addEventListener("click", () => showView("words"));
  document.getElementById("nav-assoc").addEventListener("click", () => showView("assoc"));
  document.getElementById("nav-texts").addEventListener("click", () => showView("texts"));
  document.getElementById("nav-duo").addEventListener("click", () => showView("duo"));

  document.getElementById("btn-15").addEventListener("click", () => startSession(15));
  document.getElementById("btn-25").addEventListener("click", () => startSession(25));
  document.getElementById("btn-40").addEventListener("click", () => startSession(40));
  document.getElementById("session-close").addEventListener("click", closeSession);
  document.getElementById("flash-area").addEventListener("keydown", (e) => {
    if (!(e.key === "Enter" || e.keyCode === 13)) return;
    if (e.target && e.target.id === "type-answer-input") {
      e.preventDefault();
      checkTyped();
    } else if (SESSION && (SESSION.revealed || SESSION.mode === "learn")) {
      e.preventDefault();
      nextCard();
    }
  });

  document.querySelectorAll("#dir-toggle .filter-chip").forEach((el) => {
    el.classList.toggle("active", el.dataset.dir === DIRECTION);
    el.addEventListener("click", () => {
      saveDirection(el.dataset.dir);
      document.querySelectorAll("#dir-toggle .filter-chip").forEach((x) => x.classList.toggle("active", x === el));
    });
  });

  document.querySelectorAll("#words-filters .filter-chip").forEach((el) => {
    el.addEventListener("click", () => setWordsFilter(el.dataset.f));
  });
  document.getElementById("words-search").addEventListener("input", (e) => {
    wordsSearch = e.target.value; renderWords();
  });
  document.getElementById("assoc-search").addEventListener("input", renderAssocList);

  document.getElementById("lang-es-btn").addEventListener("click", () => setTextLang("es"));
  document.getElementById("lang-ru-btn").addEventListener("click", () => setTextLang("ru"));
  document.getElementById("reader-back").addEventListener("click", closeReader);

  document.getElementById("btn-export").addEventListener("click", exportData);
  document.getElementById("btn-reset").addEventListener("click", resetProgress);
  document.getElementById("import-file").addEventListener("change", (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
  });

  showView("home");
});
