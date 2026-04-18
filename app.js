'use strict';

// ═══════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════
const DAYS = ['S','M','T','W','T','F','S'];

const SUGGESTIONS = [
  { name: 'Read',         emoji: '📖' },
  { name: 'Meditate',     emoji: '🧘' },
  { name: 'Exercise',     emoji: '💪' },
  { name: 'Journal',      emoji: '✍️' },
  { name: 'Drink water',  emoji: '💧' },
  { name: 'Sleep early',  emoji: '🌙' },
  { name: 'No phone',     emoji: '📵' },
  { name: 'Cook',         emoji: '🍳' },
  { name: 'Walk outside', emoji: '🚶' },
  { name: 'Stretch',      emoji: '🤸' },
  { name: 'Gratitude',    emoji: '🙏' },
  { name: 'Cold shower',  emoji: '🚿' },
];

// Stage: image file, name, subtitle
// Mapped by % of habits done today
const STAGES = [
  { img: 'images/stage1.png', name: 'Seeds planted',  sub: 'Check off a habit to start growing',  threshold: 0   },
  { img: 'images/stage2.png', name: 'First sprout',   sub: 'Something is stirring beneath the soil', threshold: 1   },
  { img: 'images/stage3.png', name: 'Growing strong', sub: 'Leaves are opening up to the light',  threshold: 34  },
  { img: 'images/stage4.png', name: 'Budding',        sub: 'Almost there — keep going',            threshold: 67  },
  { img: 'images/stage5.png', name: 'Full bloom',     sub: 'Every habit done. You\'re glowing 🌻', threshold: 100 },
];

const CONF_COLORS = ['#F5A623','#4E8A24','#FFD166','#6FAF3A','#E8730A','#C8DFA8'];

// ═══════════════════════════════════════
// STATE
// ═══════════════════════════════════════
const DEFAULTS = {
  v: 3,
  identity: '',
  habits: [],
  checkins: {},   // { 'YYYY-MM-DD': ['Habit A', 'Habit B'] }
  streaks: {},    // { habitName: number }
  overallStreak: 0,
  onboarded: false,
  notifEnabled: false,
};

let S = {};

function save() { try { localStorage.setItem('bloom_v3', JSON.stringify(S)); } catch(e) {} }
function load() {
  try {
    const d = localStorage.getItem('bloom_v3');
    if (d) { S = { ...DEFAULTS, ...JSON.parse(d) }; return true; }
  } catch(e) {}
  S = { ...DEFAULTS };
  return false;
}

// ═══════════════════════════════════════
// DATE HELPERS
// ═══════════════════════════════════════
function todayKey() { return new Date().toISOString().slice(0, 10); }

function fmtDate(k) {
  return new Date(k + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  });
}

function weekKeys() {
  const out = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push({
      key: d.toISOString().slice(0, 10),
      day: DAYS[d.getDay()],
      isToday: i === 0,
    });
  }
  return out;
}

function timeUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const ms = midnight - now;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `Resets in ${h}h ${m}m`;
  return `Resets in ${m}m`;
}

// ═══════════════════════════════════════
// GAME LOGIC
// ═══════════════════════════════════════
function todayDone() {
  return S.checkins[todayKey()] || [];
}

function todayPct() {
  if (!S.habits.length) return 0;
  return Math.round((todayDone().length / S.habits.length) * 100);
}

function getStage() {
  const pct = todayPct();
  if (pct >= 100) return STAGES[4];
  if (pct >= 67)  return STAGES[3];
  if (pct >= 34)  return STAGES[2];
  if (pct >= 1)   return STAGES[1];
  return STAGES[0];
}

function isHabitDone(name) {
  return todayDone().includes(name);
}

function recalcStreak(name) {
  let streak = 0;
  const now = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if ((S.checkins[key] || []).includes(name)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  S.streaks[name] = streak;
}

function recalcOverallStreak() {
  // A "full day" = all habits done that day
  let streak = 0;
  const now = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const done = S.checkins[key] || [];
    // Skip today if not complete yet
    if (i === 0) { streak = 0; continue; }
    if (S.habits.length > 0 && done.length >= S.habits.length) {
      streak++;
    } else {
      break;
    }
  }
  // If today is fully done, add 1
  if (S.habits.length > 0 && todayDone().length >= S.habits.length) streak++;
  S.overallStreak = streak;
}

// ═══════════════════════════════════════
// DOM
// ═══════════════════════════════════════
const el = id => document.getElementById(id);

// ═══════════════════════════════════════
// GARDEN TAB
// ═══════════════════════════════════════
function renderGarden() {
  renderFlower();
  renderHabits();
  updateHeader();
}

function renderFlower() {
  const stage = getStage();
  const pct   = todayPct();
  const done  = todayDone().length;
  const total = S.habits.length;

  const img = el('flower-img');
  if (img && img.src !== location.origin + '/' + stage.img) {
    img.style.opacity = '0.4';
    setTimeout(() => {
      img.src = stage.img;
      img.onload = () => { img.style.opacity = '1'; };
    }, 150);
  } else if (img) {
    img.src = stage.img;
    img.style.opacity = '1';
  }

  const nameEl = el('flower-stage-name');
  const subEl  = el('flower-stage-sub');
  if (nameEl) nameEl.textContent = stage.name;
  if (subEl)  subEl.textContent  = stage.sub;

  const fill   = el('progress-fill');
  const lLeft  = el('prog-label-left');
  const lRight = el('prog-label-right');
  const reset  = el('reset-note');
  if (fill)   fill.style.width = Math.max(0, pct) + '%';
  if (lLeft)  lLeft.textContent  = `${done} of ${total} habits`;
  if (lRight) lRight.textContent = pct + '%';
  if (reset)  reset.textContent  = timeUntilMidnight();
}

function renderHabits() {
  const list = el('habit-list');
  if (!list) return;
  list.innerHTML = '';

  if (!S.habits.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🌱</div>
      <div class="empty-txt">No habits yet.<br>Something went wrong — please restart.</div>
    </div>`;
    return;
  }

  const wk    = weekKeys();
  const today = todayKey();

  S.habits.forEach(h => {
    const done   = isHabitDone(h.name);
    const streak = S.streaks[h.name] || 0;

    const card = document.createElement('div');
    card.className = 'habit-card' + (done ? ' done' : '');

    card.innerHTML = `
      <div class="check-circle">${done ? '✓' : ''}</div>
      <div class="habit-info">
        <div class="habit-name">${h.emoji} ${h.name}</div>
        <div class="habit-meta">🔥 ${streak} day streak</div>
        <div class="week-dots">${wk.map(w => {
          const d = (S.checkins[w.key] || []).includes(h.name);
          const miss = !d && !w.isToday && w.key < today;
          return `<div class="wd ${d ? 'done' : ''} ${w.isToday ? 'today' : ''} ${miss ? 'miss' : ''}">${w.day}</div>`;
        }).join('')}</div>
      </div>
    `;

    card.addEventListener('click', () => toggleCheckin(h.name));
    list.appendChild(card);
  });
}

// ═══════════════════════════════════════
// CHECK-IN
// ═══════════════════════════════════════
function toggleCheckin(name) {
  const today   = todayKey();
  if (!S.checkins[today]) S.checkins[today] = [];

  const idx = S.checkins[today].indexOf(name);
  const prevPct = todayPct();

  if (idx === -1) {
    S.checkins[today].push(name);
    recalcStreak(name);
    recalcOverallStreak();

    const newPct = todayPct();

    // Stage up?
    if (Math.floor(newPct / 1) > Math.floor(prevPct / 1) && newPct >= 1) {
      popConfetti();
    }

    // Full bloom!
    if (newPct === 100) {
      showToast('🌻 Full bloom! Every habit done today!');
    } else {
      showToast(checkinMsg(newPct));
    }
  } else {
    S.checkins[today].splice(idx, 1);
    recalcStreak(name);
    recalcOverallStreak();
  }

  save();
  renderGarden();
}

function checkinMsg(pct) {
  if (pct < 34) return '🌱 Keep going, your sprout is waiting!';
  if (pct < 67) return '🌿 Growing nicely — halfway there!';
  if (pct < 100) return '🌼 Almost in full bloom!';
  return '🌻 Full bloom!';
}

// ═══════════════════════════════════════
// HEADER
// ═══════════════════════════════════════
function updateHeader() {
  recalcOverallStreak();
  const pill = el('streak-pill');
  if (!pill) return;
  if (S.overallStreak > 0) {
    pill.textContent = `🔥 ${S.overallStreak}d`;
    pill.classList.remove('cold');
  } else {
    pill.textContent = '0 days';
    pill.classList.add('cold');
  }
}

// ═══════════════════════════════════════
// JOURNAL TAB
// ═══════════════════════════════════════
function renderJournal() {
  const list = el('journal-list');
  if (!list) return;

  // Collect all entries sorted newest first
  const dates = Object.keys(S.checkins).sort().reverse();

  if (!dates.length || !dates.some(d => S.checkins[d].length > 0)) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📖</div>
      <div class="empty-txt">Your journal is empty.<br>Check in on a habit to start your story.</div>
    </div>`;
    return;
  }

  let html = '';
  dates.forEach(dateKey => {
    const done = S.checkins[dateKey];
    if (!done || !done.length) return;
    const total = S.habits.length;
    const pct   = total ? Math.round(done.length / total * 100) : 0;
    html += `<div class="date-label">${fmtDate(dateKey)}</div>`;
    done.forEach(name => {
      const h = S.habits.find(h => h.name === name) || { emoji: '🌱', name };
      html += `<div class="journal-entry">
        <div class="je-icon">${h.emoji}</div>
        <div class="je-body">
          <div class="je-habit">${h.name}</div>
          <div class="je-meta">${done.length}/${total} habits done that day · ${pct}%</div>
        </div>
        <span style="font-size:1rem">${pct >= 100 ? '🌻' : '✓'}</span>
      </div>`;
    });
  });

  list.innerHTML = html;
}

// ═══════════════════════════════════════
// SETTINGS TAB
// ═══════════════════════════════════════
function renderSettings() {
  const id = el('settings-identity');
  if (id) id.textContent = S.identity || '—';
  const nt = el('notif-toggle');
  if (nt) nt.checked = !!S.notifEnabled;
}

async function requestNotifications() {
  if (!('Notification' in window)) {
    showToast('Notifications not supported on this browser');
    return;
  }
  const perm = await Notification.requestPermission();
  S.notifEnabled = perm === 'granted';
  save();
  renderSettings();
  if (S.notifEnabled) {
    showToast('🔔 Reminders on! We\'ll nudge you daily.');
  } else {
    const nt = el('notif-toggle');
    if (nt) nt.checked = false;
    showToast('Notifications blocked. Check your browser settings.');
  }
}

function resetData() {
  if (!confirm('Reset all data and start fresh? This cannot be undone.')) return;
  localStorage.removeItem('bloom_v3');
  location.reload();
}

// ═══════════════════════════════════════
// TABS
// ═══════════════════════════════════════
function switchTab(tab) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  el(`tab-${tab}`).classList.add('active');
  el(`nav-${tab}`).classList.add('active');
  if (tab === 'journal')  renderJournal();
  if (tab === 'settings') renderSettings();
}

// ═══════════════════════════════════════
// SCREENS
// ═══════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  el(id).classList.add('active');
}

// ═══════════════════════════════════════
// BUILD DOM
// ═══════════════════════════════════════
function buildDOM() {
  el('app').innerHTML = `

<!-- ──────────── ONBOARDING ──────────── -->
<div class="screen active" id="screen-onboard">
  <div class="ob-hero">
    <div class="ob-logo">Bloom</div>
    <div class="ob-tagline">show up. grow something.</div>
    <img class="ob-flower-preview" src="images/stage5.png" alt="Sunflower"/>
  </div>

  <div class="ob-panel">
    <!-- Step 1: Identity -->
    <div class="step active" id="step-1">
      <div class="step-heading">Who do you want to become?</div>
      <div class="step-sub">Set your intention. You'll see it every time you open the app.</div>
      <div class="id-field">
        <span class="id-prefix">I am a person who</span>
        <input class="id-input" id="id-input" type="text" placeholder="reads every day…" autocomplete="off"/>
      </div>
      <button class="btn-primary" id="btn-step1" disabled>Choose my habits →</button>
    </div>

    <!-- Step 2: Habits -->
    <div class="step" id="step-2">
      <div class="step-heading">Pick your habits</div>
      <div class="step-sub">Up to 5. Your sunflower grows as you check them off each day.</div>
      <div class="habits-grid" id="habits-grid"></div>
      <div class="custom-row">
        <input class="c-input" id="c-input" placeholder="Add your own…"/>
        <button class="btn-plus" id="btn-plus">+</button>
      </div>
      <div class="sel-count" id="sel-count"></div>
      <button class="btn-primary" id="btn-step2" disabled>Start growing 🌱</button>
    </div>
  </div>
</div>

<!-- ──────────── MAIN APP ──────────── -->
<div class="screen" id="screen-main">

  <header class="app-header">
    <div class="hdr-row">
      <div class="hdr-logo">Bloom</div>
      <div class="hdr-right">
        <div class="streak-pill cold" id="streak-pill">0 days</div>
      </div>
    </div>
    <div class="hdr-identity" id="hdr-identity"></div>
  </header>

  <div class="tab-content">

    <!-- GARDEN -->
    <div class="tab-pane active" id="tab-garden">

      <div class="flower-card">
        <div class="flower-card-bg"></div>
        <div class="flower-img-wrap">
          <img class="flower-img" id="flower-img" src="images/stage1.png" alt="Sunflower stage"/>
        </div>
        <div class="flower-status">
          <div class="flower-stage-name" id="flower-stage-name">Seeds planted</div>
          <div class="flower-stage-sub"  id="flower-stage-sub">Check off a habit to start growing</div>
          <div class="progress-wrap">
            <div class="progress-label">
              <span id="prog-label-left">0 of 0 habits</span>
              <span id="prog-label-right">0%</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" id="progress-fill" style="width:0%"></div>
            </div>
          </div>
          <div class="reset-note" id="reset-note"></div>
        </div>
      </div>

      <div class="s-head">Today's habits</div>
      <div id="habit-list"></div>

    </div>

    <!-- JOURNAL -->
    <div class="tab-pane" id="tab-journal">
      <div class="s-head">Journal</div>
      <div id="journal-list"></div>
    </div>

    <!-- SETTINGS -->
    <div class="tab-pane" id="tab-settings">
      <div class="s-head">Settings</div>

      <div class="settings-section">
        <div class="settings-section-label">Your identity</div>
        <div class="settings-card">
          <div class="settings-row" style="cursor:default">
            <div class="sr-icon">🌱</div>
            <div class="sr-body">
              <div class="sr-title">I am a person who…</div>
              <div class="sr-sub" id="settings-identity">—</div>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-label">Notifications</div>
        <div class="settings-card">
          <div class="settings-row" style="cursor:default">
            <div class="sr-icon">🔔</div>
            <div class="sr-body">
              <div class="sr-title">Daily reminder</div>
              <div class="sr-sub">Get nudged to check in</div>
            </div>
            <label class="toggle-wrap">
              <input type="checkbox" class="toggle-inp" id="notif-toggle"
                onchange="if(this.checked) requestNotifications(); else { S.notifEnabled=false; save(); }"/>
              <div class="toggle-slider"></div>
            </label>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-label">Data</div>
        <div class="settings-card">
          <div class="settings-row" onclick="resetData()">
            <div class="sr-icon">🗑️</div>
            <div class="sr-body">
              <div class="sr-title danger">Reset all data</div>
              <div class="sr-sub">Start fresh — cannot be undone</div>
            </div>
            <div class="sr-caret">›</div>
          </div>
        </div>
      </div>

      <div class="version-note">Bloom · Made with 🌱 and stubbornness</div>
    </div>

  </div><!-- /tab-content -->

  <nav class="bottom-nav">
    <button class="nav-btn active" id="nav-garden"   onclick="switchTab('garden')">
      <div class="nav-ico">🏡</div><span>Garden</span>
    </button>
    <button class="nav-btn" id="nav-journal"  onclick="switchTab('journal')">
      <div class="nav-ico">📖</div><span>Journal</span>
    </button>
    <button class="nav-btn" id="nav-settings" onclick="switchTab('settings')">
      <div class="nav-ico">⚙️</div><span>Settings</span>
    </button>
  </nav>

</div><!-- /screen-main -->

<!-- Install banner -->
<div class="install-banner" id="install-banner">
  <span style="font-size:1.4rem">🌻</span>
  <div class="ib-text"><b>Add Bloom to your home screen</b>Open, check in, leave. That's it.</div>
  <button class="btn-install" id="btn-install">Install</button>
  <button class="btn-dismiss" id="btn-dismiss">✕</button>
</div>
`;
}

// ═══════════════════════════════════════
// ONBOARDING LOGIC
// ═══════════════════════════════════════
const selectedHabits = new Set();

function setupOnboarding() {
  // Step 1
  const idInp = el('id-input');
  idInp.addEventListener('input', () => {
    el('btn-step1').disabled = idInp.value.trim().length < 2;
  });
  el('btn-step1').addEventListener('click', () => {
    S.identity = idInp.value.trim();
    el('step-1').classList.remove('active');
    el('step-2').classList.add('active');
  });

  // Habit chips
  const grid = el('habits-grid');
  SUGGESTIONS.forEach(h => {
    const chip = document.createElement('button');
    chip.className = 'h-chip';
    chip.innerHTML = `<span class="chip-em">${h.emoji}</span><span>${h.name}</span>`;
    chip.addEventListener('click', () => {
      if (selectedHabits.has(h.name)) {
        selectedHabits.delete(h.name);
        chip.classList.remove('sel');
      } else if (selectedHabits.size < 5) {
        selectedHabits.add(h.name);
        chip.classList.add('sel');
      } else {
        showToast('Maximum 5 habits');
      }
      updateSelCount();
    });
    grid.appendChild(chip);
  });

  // Custom habit
  el('btn-plus').addEventListener('click', addCustom);
  el('c-input').addEventListener('keydown', e => { if (e.key === 'Enter') addCustom(); });

  // Plant
  el('btn-step2').addEventListener('click', plantGarden);
}

function addCustom() {
  const val = el('c-input').value.trim();
  if (!val) return;
  if (selectedHabits.size >= 5) { showToast('Maximum 5 habits'); return; }
  if (selectedHabits.has(val)) return;
  selectedHabits.add(val);
  const chip = document.createElement('button');
  chip.className = 'h-chip sel';
  chip.innerHTML = `<span class="chip-em">🌱</span><span>${val}</span>`;
  chip.addEventListener('click', () => {
    selectedHabits.delete(val);
    chip.remove();
    updateSelCount();
  });
  el('habits-grid').appendChild(chip);
  el('c-input').value = '';
  updateSelCount();
}

function updateSelCount() {
  el('btn-step2').disabled = selectedHabits.size === 0;
  const c = el('sel-count');
  if (c) c.textContent = selectedHabits.size > 0 ? `${selectedHabits.size}/5 selected` : '';
}

function plantGarden() {
  S.habits = [];
  S.checkins = {};
  S.streaks = {};
  S.overallStreak = 0;
  selectedHabits.forEach(name => {
    const found = SUGGESTIONS.find(h => h.name === name);
    S.habits.push({ name, emoji: found ? found.emoji : '🌱' });
    S.streaks[name] = 0;
  });
  S.onboarded = true;
  save();
  launchApp();
}

// ═══════════════════════════════════════
// LAUNCH
// ═══════════════════════════════════════
function launchApp() {
  showScreen('screen-main');
  const hid = el('hdr-identity');
  if (hid) hid.innerHTML = `I am a person who <b>${S.identity}</b>`;
  S.habits.forEach(h => recalcStreak(h.name));
  recalcOverallStreak();
  renderGarden();
  renderSettings();

  // Auto-refresh reset countdown every minute
  setInterval(() => {
    const r = el('reset-note');
    if (r) r.textContent = timeUntilMidnight();
  }, 60000);
}

// ═══════════════════════════════════════
// FX
// ═══════════════════════════════════════
function popConfetti() {
  const root = el('fx-root');
  for (let i = 0; i < 32; i++) {
    const p = document.createElement('div');
    p.className = 'conf';
    p.style.cssText = `
      background: ${CONF_COLORS[i % CONF_COLORS.length]};
      left: ${10 + Math.random() * 80}%;
      top: ${15 + Math.random() * 30}%;
      width: ${7 + Math.random() * 6}px;
      height: ${7 + Math.random() * 6}px;
      animation-delay: ${Math.random() * 0.3}s;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
    `;
    root.appendChild(p);
  }
  setTimeout(() => { root.innerHTML = ''; }, 1500);
}

let toastTimer;
function showToast(msg) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    el('toast-root').appendChild(t);
  }
  clearTimeout(toastTimer);
  t.textContent = msg;
  t.classList.add('show');
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ═══════════════════════════════════════
// PWA INSTALL
// ═══════════════════════════════════════
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstall = e;
  setTimeout(() => el('install-banner')?.classList.add('show'), 5000);
});

function setupInstall() {
  el('btn-install')?.addEventListener('click', async () => {
    if (deferredInstall) {
      deferredInstall.prompt();
      await deferredInstall.userChoice;
      deferredInstall = null;
    }
    el('install-banner')?.classList.remove('show');
  });
  el('btn-dismiss')?.addEventListener('click', () => {
    el('install-banner')?.classList.remove('show');
  });
}

// ═══════════════════════════════════════
// SERVICE WORKER
// ═══════════════════════════════════════
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

// ═══════════════════════════════════════
// BOOT
// ═══════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  buildDOM();
  load();

  if (S.onboarded && S.habits?.length) {
    launchApp();
  } else {
    setupOnboarding();
    showScreen('screen-onboard');
  }

  setupInstall();
  registerSW();
});
