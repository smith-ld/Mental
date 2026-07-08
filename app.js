(() => {
  'use strict';

  // ---------- State ----------
  const state = {
    duration: 60,          // seconds, or null for unlimited
    ops: ['+', '-', '×', '÷'],
    range: {
      addsub: { min: 0, max: 1000 },
      muldiv: { min: 100, max: 200 },
    },
    current: null,        // {a, b, op, answer}
    answer: '',
    score: 0,
    attempts: 0,
    streak: 0,
    bestStreak: 0,
    answerTimes: [],
    timeLeft: 60,
    timerId: null,
    lastTick: 0,
    startedAt: 0,
  };

  // ---------- Screen helpers ----------
  const screens = document.querySelectorAll('.screen');
  function showScreen(name) {
    screens.forEach(s => s.dataset.active = (s.dataset.screen === name) ? 'true' : 'false');
  }

  // ---------- Setup screen wiring ----------
  const durationRow = document.querySelector('[data-group="duration"]');
  const opsRow = document.querySelector('[data-group="ops"]');

  durationRow.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    [...durationRow.children].forEach(c => c.classList.remove('is-on'));
    btn.classList.add('is-on');
    state.duration = (btn.dataset.value === 'unlimited') ? null : parseInt(btn.dataset.value, 10);
  });
  // default duration highlight
  [...durationRow.children].forEach(c => {
    if (c.dataset.default) c.classList.add('is-on');
  });

  opsRow.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    const onCount = [...opsRow.children].filter(c => c.classList.contains('is-on')).length;
    const isOn = btn.classList.contains('is-on');
    if (isOn && onCount === 1) return; // keep at least one op selected
    btn.classList.toggle('is-on');
  });

  const rangeInputs = {
    addsubMin: document.getElementById('addsubMin'),
    addsubMax: document.getElementById('addsubMax'),
    muldivMin: document.getElementById('muldivMin'),
    muldivMax: document.getElementById('muldivMax'),
  };

  function clampRangeGroup(group, minEl, maxEl) {
    let min = parseInt(minEl.value, 10);
    let max = parseInt(maxEl.value, 10);
    if (isNaN(min)) min = state.range[group].min;
    if (isNaN(max)) max = state.range[group].max;
    min = Math.max(0, Math.min(9999, min));
    max = Math.max(0, Math.min(9999, max));
    if (min > max) { const t = min; min = max; max = t; }
    minEl.value = min;
    maxEl.value = max;
    state.range[group] = { min, max };
  }

  rangeInputs.addsubMin.addEventListener('change', () => clampRangeGroup('addsub', rangeInputs.addsubMin, rangeInputs.addsubMax));
  rangeInputs.addsubMax.addEventListener('change', () => clampRangeGroup('addsub', rangeInputs.addsubMin, rangeInputs.addsubMax));
  rangeInputs.muldivMin.addEventListener('change', () => clampRangeGroup('muldiv', rangeInputs.muldivMin, rangeInputs.muldivMax));
  rangeInputs.muldivMax.addEventListener('change', () => clampRangeGroup('muldiv', rangeInputs.muldivMin, rangeInputs.muldivMax));

  document.getElementById('startBtn').addEventListener('click', startGame);
  const quitBtn = document.getElementById('quitBtn');
  quitBtn.addEventListener('click', () => {
    // Unlimited mode has no natural end, so the same button finishes the run
    // and shows results instead of abandoning it.
    endGame(state.duration === null ? false : true);
  });
  document.getElementById('againBtn').addEventListener('click', startGame);
  document.getElementById('homeBtn').addEventListener('click', () => showScreen('setup'));

  // last score memory (localStorage, in-browser only)
  const lastScoreBtn = document.getElementById('lastScoreBtn');
  const lastRun = localStorage.getItem('tally-last-run');
  if (lastRun) {
    const { score, duration } = JSON.parse(lastRun);
    const durationLabel = typeof duration === 'number' ? formatTime(duration) : duration;
    lastScoreBtn.hidden = false;
    lastScoreBtn.textContent = `Last run: ${score} correct in ${durationLabel}`;
  }

  // ---------- Problem generation ----------
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function generateProblem() {
    const selectedOps = [...opsRow.children]
      .filter(c => c.classList.contains('is-on'))
      .map(c => c.dataset.value);
    const op = selectedOps[randInt(0, selectedOps.length - 1)];

    const as = state.range.addsub;
    const md = state.range.muldiv;

    let a, b, answer;

    if (op === '+') {
      a = randInt(as.min, as.max);
      b = randInt(as.min, as.max);
      answer = a + b;
    } else if (op === '-') {
      a = randInt(as.min, as.max);
      b = randInt(as.min, as.max);
      if (b > a) [a, b] = [b, a]; // keep result non-negative for a clean mental check
      answer = a - b;
    } else if (op === '×') {
      a = randInt(md.min, md.max);
      b = randInt(md.min, md.max);
      answer = a * b;
    } else { // ÷
      // divisor and quotient are both drawn from the mul/div range, dividend
      // is derived from them — keeps every result a clean whole number
      const divisor = Math.max(1, randInt(md.min, md.max));
      const quotient = randInt(md.min, md.max);
      a = divisor * quotient; // dividend (shown)
      b = divisor;            // divisor (shown)
      answer = quotient;
    }

    return { a, b, op, answer };
  }

  // ---------- Rendering ----------
  const opA = document.getElementById('opA');
  const opB = document.getElementById('opB');
  const opSym = document.getElementById('opSym');
  const problemEl = document.getElementById('problem');
  const answerDisplay = document.getElementById('answerDisplay');
  const liveScoreEl = document.getElementById('liveScore');

  function renderProblem() {
    state.current = generateProblem();
    opA.textContent = state.current.a;
    opB.textContent = state.current.b;
    opSym.textContent = state.current.op;
    opA.classList.remove('flip'); opB.classList.remove('flip');
    void opA.offsetWidth; // restart animation
    opA.classList.add('flip'); opB.classList.add('flip');
    state.answer = '';
    state.lastTick = performance.now();
    renderAnswer();
  }

  function renderAnswer() {
    answerDisplay.innerHTML = state.answer
      ? escapeHtml(state.answer) + '<span class="caret">&nbsp;</span>'
      : '<span class="caret">&nbsp;</span>';
  }

  function escapeHtml(s) { return s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

  // ---------- Keypad ----------
  document.getElementById('keypad').addEventListener('click', (e) => {
    const key = e.target.closest('.key');
    if (!key) return;
    const val = key.dataset.key;

    if (val === 'del') {
      state.answer = state.answer.slice(0, -1);
      renderAnswer();
      return;
    }
    if (val === '-') {
      if (state.answer === '') state.answer = '-';
      renderAnswer();
      return;
    }
    if (state.answer.length >= 6) return; // sane cap
    state.answer += val;
    renderAnswer();
    checkAutoSubmit();
  });

  function checkAutoSubmit() {
    // auto-submit once the typed answer can't get any closer (matches digit count and sign)
    const target = String(state.current.answer);
    if (state.answer.length >= target.length && state.answer !== '-') {
      submitAnswer();
    }
  }

  function submitAnswer() {
    const given = parseInt(state.answer, 10);
    const correct = given === state.current.answer;
    state.attempts++;
    const now = performance.now();
    state.answerTimes.push((now - state.lastTick) / 1000);

    if (correct) {
      state.score++;
      state.streak++;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      liveScoreEl.textContent = state.score;
      pulse(true);
    } else {
      state.streak = 0;
      pulse(false);
    }
    renderProblem();
  }

  function pulse(correct) {
    problemEl.classList.remove('shake', 'correct-pulse');
    void problemEl.offsetWidth;
    problemEl.classList.add(correct ? 'correct-pulse' : 'shake');
  }

  // keyboard support (external keyboards / desktop testing)
  window.addEventListener('keydown', (e) => {
    const playing = document.querySelector('[data-screen="play"]').dataset.active === 'true';
    if (!playing) return;
    if (/^[0-9]$/.test(e.key)) {
      document.querySelector(`.key[data-key="${e.key}"]`)?.click();
    } else if (e.key === '-') {
      document.querySelector('.key[data-key="-"]')?.click();
    } else if (e.key === 'Backspace') {
      document.querySelector('.key[data-key="del"]')?.click();
    } else if (e.key === 'Enter') {
      submitAnswer();
    }
  });

  // ---------- Timer / tally rail ----------
  const tallyRail = document.getElementById('tallyRail');
  const timeLeftEl = document.getElementById('timeLeft');

  function buildTallyRail(totalTicks) {
    tallyRail.innerHTML = '';
    for (let i = 0; i < totalTicks; i++) {
      const t = document.createElement('div');
      t.className = 'tick';
      tallyRail.appendChild(t);
    }
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function startGame() {
    const unlimited = state.duration === null;

    state.timeLeft = unlimited ? 0 : state.duration;
    state.score = 0;
    state.attempts = 0;
    state.streak = 0;
    state.bestStreak = 0;
    state.answerTimes = [];

    liveScoreEl.textContent = '0';
    timeLeftEl.textContent = unlimited ? '0:00' : formatTime(state.timeLeft);
    timeLeftEl.classList.remove('urgent');

    quitBtn.textContent = unlimited ? '✓' : '✕';
    quitBtn.setAttribute('aria-label', unlimited ? 'Finish' : 'Quit');

    if (unlimited) {
      tallyRail.classList.add('hidden');
      tallyRail.innerHTML = '';
    } else {
      tallyRail.classList.remove('hidden');
      const tickCount = Math.min(state.duration, 30); // one tick per second up to 30, then chunked
      buildTallyRail(tickCount);
    }

    showScreen('play');
    renderProblem();

    state.startedAt = performance.now();
    const totalMs = unlimited ? 0 : state.duration * 1000;
    const tickCount = unlimited ? 0 : Math.min(state.duration, 30);

    clearInterval(state.timerId);
    state.timerId = setInterval(() => {
      const elapsed = performance.now() - state.startedAt;

      if (unlimited) {
        state.timeLeft = Math.floor(elapsed / 1000);
        timeLeftEl.textContent = formatTime(state.timeLeft);
        return;
      }

      const remainingMs = Math.max(0, totalMs - elapsed);
      state.timeLeft = Math.ceil(remainingMs / 1000);
      timeLeftEl.textContent = formatTime(state.timeLeft);
      timeLeftEl.classList.toggle('urgent', state.timeLeft <= 10);

      const ticksLeft = Math.ceil((remainingMs / totalMs) * tickCount);
      [...tallyRail.children].forEach((t, i) => {
        t.classList.toggle('spent', i >= ticksLeft);
      });

      if (remainingMs <= 0) endGame(false);
    }, 100);
  }

  function endGame(quit) {
    clearInterval(state.timerId);
    if (quit) { showScreen('setup'); return; }

    const elapsedSec = Math.round((performance.now() - state.startedAt) / 1000);
    const totalTime = state.duration === null ? elapsedSec : state.duration;

    const accuracy = state.attempts ? Math.round((state.score / state.attempts) * 100) : 0;
    const avg = state.answerTimes.length
      ? (state.answerTimes.reduce((a, b) => a + b, 0) / state.answerTimes.length)
      : 0;

    document.getElementById('resultsScore').textContent = state.score;
    document.getElementById('statAccuracy').textContent = `${accuracy}%`;
    document.getElementById('statAvg').textContent = `${avg.toFixed(1)}s`;
    document.getElementById('statBest').textContent = state.bestStreak;
    document.getElementById('statTime').textContent = formatTime(totalTime);

    localStorage.setItem('tally-last-run', JSON.stringify({
      score: state.score,
      duration: state.duration === null ? `${formatTime(totalTime)} (unlimited)` : state.duration
    }));

    showScreen('results');
  }

  // ---------- PWA / service worker ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {/* offline install still works without this */});
    });
  }

  showScreen('setup');
})();
