/* ============ Проверка произношения через микрофон ============
   Использует встроенный в браузер Web Speech API (бесплатно, без ключей).
   Поддерживается в Chrome (включая Android). В Safari/iOS распознавание
   речи через JS не работает — показываем понятное сообщение. */
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
const MIC_SUPPORTED = !!SpeechRecognitionCtor;

function normalizeForSpeech(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[¡¿.,!?;:"“”'()]/g, "")
    .trim();
}

function micButtonHtml(target, extraClass) {
  return `<button class="mic-btn ${extraClass || ""}" data-target="${escapeHtml(target)}" onclick="handleMicClick(this)" title="Проверить произношение">🎤</button>`;
}

let micActiveBtn = null;
let micRecognition = null;

function handleMicClick(btn) {
  if (!MIC_SUPPORTED) {
    alert("Распознавание речи не поддерживается в этом браузере. Открой сайт в Chrome (на Android — работает).");
    return;
  }
  if (micActiveBtn === btn) { stopMic(); return; }
  if (micActiveBtn) stopMic();
  startMicFor(btn);
}

function startMicFor(btn) {
  const target = btn.dataset.target || "";
  const continuous = target.trim().split(/\s+/).length > 3; // длинный текст — слушаем, пока не остановят

  const rec = new SpeechRecognitionCtor();
  rec.lang = "es-ES";
  rec.interimResults = false;
  rec.continuous = continuous;
  rec.maxAlternatives = 1;

  let finalTranscript = "";

  micRecognition = rec;
  micActiveBtn = btn;
  btn.dataset.state = "listening";
  btn.textContent = continuous ? "⏹️" : "🔴";
  btn.classList.add("listening");

  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalTranscript += (finalTranscript ? " " : "") + e.results[i][0].transcript;
    }
    if (!continuous) {
      finishMic(btn, target, finalTranscript);
    }
  };
  rec.onerror = () => { resetMicBtn(btn); };
  rec.onend = () => {
    if (btn.dataset.state === "listening") {
      if (continuous && finalTranscript) finishMic(btn, target, finalTranscript);
      else resetMicBtn(btn);
    }
  };
  try { rec.start(); } catch (e) { resetMicBtn(btn); }
}

function stopMic() {
  if (micRecognition) { try { micRecognition.stop(); } catch (e) {} }
}

function resetMicBtn(btn) {
  btn.textContent = "🎤";
  btn.classList.remove("listening");
  btn.dataset.state = "idle";
  if (micActiveBtn === btn) { micActiveBtn = null; micRecognition = null; }
}

function scorePronunciation(target, heard) {
  const t = normalizeForSpeech(target).split(/\s+/).filter(Boolean);
  const h = new Set(normalizeForSpeech(heard).split(/\s+/).filter(Boolean));
  if (t.length === 0) return 0;
  if (t.length === 1) return t[0] && h.has(t[0]) ? 100 : 0;
  let matched = 0;
  for (const w of t) if (h.has(w)) matched++;
  return Math.round((matched / t.length) * 100);
}

function finishMic(btn, target, heard) {
  btn.dataset.state = "idle";
  micActiveBtn = null;
  micRecognition = null;
  const pct = scorePronunciation(target, heard);
  const ok = pct >= 80;
  btn.textContent = ok ? "✅" : "❌";
  btn.classList.remove("listening");
  btn.title = heard
    ? `Услышано: «${heard}»` + (target.trim().split(/\s+/).length > 1 ? ` (совпадение: ${pct}%)` : "")
    : "Не расслышал — попробуй ещё раз";
  setTimeout(() => { if (btn.dataset.state === "idle") { btn.textContent = "🎤"; } }, 2200);
}
