(() => {
  'use strict';

  // ---------- State ----------
  const state = {
    duration: 60,
    ops: ['+', '-', '×', '÷'],
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
    state.duration = parseInt(btn.dataset.value, 10);
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

  document.getElementById('startBtn').addEventListener('click', startGame);
  document.getElementById('quitBtn').addEventListener('click', () => endGame(true));
  document.getElementById('againBtn').addEventListener('click', startGame);
  document.getElementById('homeBtn').addEventListener('click', () => showScreen('setup'));

  // last score memory (localStorage, in-browser only)
  const lastScoreBtn = document.getElementById('lastScoreBtn');
  const lastRun = localStorage.getItem('tally-last-run');
  if (lastRun) {
    const { score, duration } = JSON.parse(lastRun);
    lastScoreBtn.hidden = false;
    lastScoreBtn.textContent = `Last run: ${score} correct in ${formatTime(duration)}`;
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

    let a, b, answer;

    if (op === '+') {
      a = randInt(0, 1000);
      b = randInt(0, 1000);
      answer = a + b;
    } else if (op === '-') {
      a = randInt(0, 1000);
      b = randInt(0, 1000);
      if (b > a) [a, b] = [b, a]; // keep result non-negative for a clean mental check
      answer = a - b;
    } else if (op === '×') {
      // full 0-1000 x 0-1000 makes mental multiplication essentially impossible,
      // so keep one factor small enough to actually compute in your head
      a = randInt(0, 1000);
      b = randInt(0, 12);
      answer = a * b;
      if (Math.random() < 0.5) [a, b] = [b, a];
    } else { // ÷
      // build from the answer up so division always comes out even
      b = randInt(1, 25);          // divisor
      answer = randInt(0, 40);     // quotient
      a = b * answer;              // dividend, within a sane range
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
    state.duration = state.duration; // already set via chips
    state.timeLeft = state.duration;
    state.score = 0;
    state.attempts = 0;
    state.streak = 0;
    state.bestStreak = 0;
    state.answerTimes = [];

    liveScoreEl.textContent = '0';
    timeLeftEl.textContent = formatTime(state.timeLeft);
    timeLeftEl.classList.remove('urgent');

    const tickCount = Math.min(state.duration, 30); // one tick per second up to 30, then chunked
    buildTallyRail(tickCount);

    showScreen('play');
    renderProblem();

    const startedAt = performance.now();
    const totalMs = state.duration * 1000;
    clearInterval(state.timerId);
    state.timerId = setInterval(() => {
      const elapsed = performance.now() - startedAt;
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

    const accuracy = state.attempts ? Math.round((state.score / state.attempts) * 100) : 0;
    const avg = state.answerTimes.length
      ? (state.answerTimes.reduce((a, b) => a + b, 0) / state.answerTimes.length)
      : 0;

    document.getElementById('resultsScore').textContent = state.score;
    document.getElementById('statAccuracy').textContent = `${accuracy}%`;
    document.getElementById('statAvg').textContent = `${avg.toFixed(1)}s`;
    document.getElementById('statBest').textContent = state.bestStreak;

    localStorage.setItem('tally-last-run', JSON.stringify({
      score: state.score, duration: state.duration
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
