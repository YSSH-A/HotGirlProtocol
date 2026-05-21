// ============ CONFIG ============
const START_DATE = new Date('2026-04-10');
const TOTAL_DAYS = 100;
const PERSONS = {
  pafu: { name: '泡芙', avatar: '泡', colorClass: 'p0', dotClass: 'p0-dot', bubbleClass: 'bubble-p0', tagClass: 'p0-tag', sendClass: 'send-p0', color: '#D4537E' },
  keke: { name: '珂珂', avatar: '珂', colorClass: 'p1', dotClass: 'p1-dot', bubbleClass: 'bubble-p1', tagClass: 'p1-tag', sendClass: 'send-p1', color: '#1D9E75' },
  xuan: { name: '小璇', avatar: '璇', colorClass: 'p2', dotClass: 'p2-dot', bubbleClass: 'bubble-p2', tagClass: 'p2-tag', sendClass: 'send-p2', color: '#378ADD' }
};

// ============ STATE ============
let currentUser = null;
let chipState = { period: false, done: false };
let trendChart = null;
let chatUnsubscribe = null;
let recordsUnsubscribe = null;

// ============ INIT ============
function initApp() {
  const saved = localStorage.getItem('slimming_user');
  if (saved && PERSONS[saved]) {
    currentUser = saved;
    showApp();
  } else {
    showLogin();
  }
}

function showLogin() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  const day = getDayNumber(new Date());
  document.getElementById('login-day-info').textContent = `今天是第 ${day} 天，还有 ${TOTAL_DAYS - day} 天`;
}

function showApp() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';

  const p = PERSONS[currentUser];
  document.getElementById('user-name-display').textContent = p.name;
  const dot = document.getElementById('user-dot');
  dot.className = 'topbar-dot ' + p.dotClass;
  document.getElementById('send-btn').className = 'send-btn ' + p.sendClass;

  updateDayBanner();
  loadTodayRecord();
  loadOthers();
  listenChat();
}

function login(user) {
  currentUser = user;
  localStorage.setItem('slimming_user', user);
  showApp();
}

function logout() {
  if (!confirm('确定退出？')) return;
  currentUser = null;
  localStorage.removeItem('slimming_user');
  if (chatUnsubscribe) chatUnsubscribe();
  if (recordsUnsubscribe) recordsUnsubscribe();
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
}

// ============ HELPERS ============
function getDayNumber(date) {
  const d = new Date(date); d.setHours(0,0,0,0);
  const s = new Date(START_DATE); s.setHours(0,0,0,0);
  return Math.floor((d - s) / 86400000) + 1;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth()+1}月${d.getDate()}日`;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}

// ============ DAY BANNER ============
function updateDayBanner() {
  const today = new Date();
  const day = getDayNumber(today);
  const remain = TOTAL_DAYS - day;
  document.getElementById('day-number').textContent = `第 ${day} 天`;
  document.getElementById('today-date-display').textContent =
    `${today.getMonth()+1}月${today.getDate()}日`;
  document.getElementById('day-remain').textContent =
    remain > 0 ? `还有 ${remain} 天` : '已完成！';
  document.getElementById('my-record-title').textContent =
    `我的今日记录 · ${PERSONS[currentUser].name}`;
}

// ============ TODAY RECORD ============
function loadTodayRecord() {
  const key = todayKey();
  const r = window._dbRef(window._db, `records/${key}/${currentUser}`);
  window._dbGet(r).then(snap => {
    if (snap.exists()) {
      const d = snap.val();
      document.getElementById('f-morning').value = d.morning || '';
      document.getElementById('f-evening').value = d.evening || '';
      document.getElementById('f-exercise').value = d.exercise || '';
      document.getElementById('f-plan').value = d.plan || '';
      document.getElementById('f-note').value = d.note || '';
      if (d.period) { chipState.period = true; document.getElementById('chip-period').classList.add('active-period'); }
      if (d.done) { chipState.done = true; document.getElementById('chip-done').classList.add('active-done'); }
      calcDiff();
      document.getElementById('save-btn').classList.add('save-ok');
      document.getElementById('save-btn').textContent = '已保存 ✓  再次保存';
    }
  });
}

function calcDiff() {
  const m = parseFloat(document.getElementById('f-morning').value);
  if (isNaN(m)) { document.getElementById('diff-display').style.display = 'none'; return; }
  const key = todayKey();
  const d = new Date(key + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  const prevKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const r = window._dbRef(window._db, `records/${prevKey}/${currentUser}/morning`);
  window._dbGet(r).then(snap => {
    const el = document.getElementById('diff-display');
    if (snap.exists() && snap.val()) {
      const prev = parseFloat(snap.val());
      if (!isNaN(prev)) {
        const diff = Math.round((m - prev) * 10) / 10;
        el.style.display = 'block';
        if (diff < 0) { el.className = 'diff-display diff-down'; el.textContent = `↓ 比昨天少 ${Math.abs(diff)} 斤`; }
        else if (diff > 0) { el.className = 'diff-display diff-up'; el.textContent = `↑ 比昨天多 ${diff} 斤`; }
        else { el.className = 'diff-display diff-same'; el.textContent = '→ 与昨天持平'; }
        return;
      }
    }
    el.style.display = 'none';
  });
}

function toggleChip(type) {
  chipState[type] = !chipState[type];
  const el = document.getElementById('chip-' + type);
  if (type === 'period') el.classList.toggle('active-period', chipState.period);
  if (type === 'done') el.classList.toggle('active-done', chipState.done);
}

async function saveToday() {
  const morning = document.getElementById('f-morning').value.trim();
  const evening = document.getElementById('f-evening').value.trim();
  if (!morning && !evening) { showToast('请至少填写一个体重'); return; }

  const key = todayKey();
  const data = {
    morning: morning || '',
    evening: evening || '',
    exercise: document.getElementById('f-exercise').value,
    plan: document.getElementById('f-plan').value,
    note: document.getElementById('f-note').value.trim(),
    period: chipState.period,
    done: chipState.done,
    updatedAt: Date.now()
  };

  try {
    await window._dbSet(window._dbRef(window._db, `records/${key}/${currentUser}`), data);
    showToast('保存成功！');
    document.getElementById('save-btn').classList.add('save-ok');
    document.getElementById('save-btn').textContent = '已保存 ✓  再次保存';
    loadOthers();
  } catch(e) {
    showToast('保存失败，检查网络');
  }
}

// ============ OTHERS SUMMARY ============
function loadOthers() {
  const key = todayKey();
  const r = window._dbRef(window._db, `records/${key}`);
  window._dbGet(r).then(snap => {
    const data = snap.exists() ? snap.val() : {};
    const others = Object.keys(PERSONS).filter(p => p !== currentUser);
    const grid = document.getElementById('others-grid');
    grid.innerHTML = others.map(pid => {
      const p = PERSONS[pid];
      const d = data[pid] || {};
      const w = d.morning || d.evening || '未填写';
      const wNum = parseFloat(d.morning || d.evening);
      let diffBadge = '';
      const note = d.note ? `<div class="log-note" style="margin-top:6px">${escHtml(d.note)}</div>` : '';
      const periodBadge = d.period ? `<span class="badge badge-period">生理期</span>` : '';
      const planText = d.plan ? `<div style="font-size:12px;color:var(--text3);margin-top:2px">${escHtml(d.plan)}</div>` : '';
      return `<div class="other-card">
        <div class="other-name">${p.name}</div>
        <div class="other-weight ${p.colorClass === 'p0' ? 'p0c' : p.colorClass === 'p1' ? 'p1c' : 'p2c'}">${w === '未填写' ? '—' : w + ' 斤'}</div>
        ${periodBadge}${planText}${note}
      </div>`;
    }).join('');
  });
}

// ============ NAVIGATION ============
function switchPage(page, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  btn.classList.add('active');
  if (page === 'trend') renderTrend();
  if (page === 'log') renderLog();
}

// ============ TREND ============
async function renderTrend() {
  const r = window._dbRef(window._db, 'records');
  const snap = await window._dbGet(r);
  if (!snap.exists()) return;
  const all = snap.val();

  const sortedDates = Object.keys(all).sort();
  const last30 = sortedDates.slice(-30);

  const labels = last30.map(d => { const dd = new Date(d+'T00:00:00'); return `${dd.getMonth()+1}/${dd.getDate()}`; });
  const datasets = [
    { key: 'pafu', color: '#D4537E' },
    { key: 'keke', color: '#1D9E75' },
    { key: 'xuan', color: '#378ADD' }
  ].map(({key, color}) => ({
    data: last30.map(d => {
      const rec = all[d]?.[key];
      const v = parseFloat(rec?.morning || rec?.evening || '');
      return isNaN(v) ? null : v;
    }),
    borderColor: color,
    backgroundColor: color + '15',
    tension: 0.3,
    pointRadius: 3,
    borderWidth: 2,
    spanGaps: true
  }));

  if (trendChart) trendChart.destroy();
  trendChart = new Chart(document.getElementById('trendChart'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: ctx => `${['泡芙','珂珂','小璇'][ctx.datasetIndex]}: ${ctx.parsed.y} 斤` }
      }},
      scales: {
        y: { ticks: { font: { size: 11 }, callback: v => v + '斤' }, grid: { color: '#f0ede6' } },
        x: { ticks: { font: { size: 10 }, maxTicksLimit: 8 }, grid: { display: false } }
      }
    }
  });

  // Stats
  const statGrid = document.getElementById('stat-grid');
  const personKeys = ['pafu', 'keke', 'xuan'];
  const colors = ['p0c', 'p1c', 'p2c'];
  statGrid.innerHTML = personKeys.map((key, i) => {
    const weights = sortedDates.map(d => {
      const rec = all[d]?.[key];
      const v = parseFloat(rec?.morning || rec?.evening || '');
      return isNaN(v) ? null : v;
    }).filter(v => v !== null);
    const first = weights[0] || 0;
    const last = weights[weights.length - 1] || 0;
    const change = Math.round((last - first) * 10) / 10;
    const p = PERSONS[key];
    return `<div class="stat-card">
      <div class="stat-name">${p.name}</div>
      <div class="stat-val ${colors[i]}">${last || '—'}</div>
      <div class="stat-sub">${change !== 0 ? (change > 0 ? '↑' : '↓') + Math.abs(change) + '斤' : '→ 持平'}</div>
    </div>`;
  }).join('');
}

// ============ LOG ============
async function renderLog() {
  const r = window._dbRef(window._db, 'records');
  const snap = await window._dbGet(r);
  const logList = document.getElementById('log-list');
  if (!snap.exists()) { logList.innerHTML = '<div style="color:var(--text3);text-align:center;padding:40px">暂无记录</div>'; return; }
  const all = snap.val();
  const sortedDates = Object.keys(all).sort().reverse();

  logList.innerHTML = sortedDates.map(date => {
    const dayNum = getDayNumber(new Date(date + 'T00:00:00'));
    const recs = all[date];
    const entries = Object.entries(PERSONS).map(([key, p]) => {
      const d = recs?.[key];
      if (!d) return '';
      const w = [d.morning, d.evening].filter(Boolean).join(' / ');
      if (!w && !d.note && !d.plan && !d.exercise) return '';
      const weightStr = w ? `<span class="log-w">${w} 斤</span>` : '';
      const meta = [d.exercise, d.plan, d.done ? '已完成' : ''].filter(Boolean).join(' · ');
      const periodBadge = d.period ? `<span class="badge badge-period" style="margin-left:4px">生理期</span>` : '';
      return `<div class="log-person-row">
        <span class="log-person-tag ${p.tagClass}">${p.name}</span>
        ${weightStr}${periodBadge}
        ${meta ? `<span style="font-size:12px;color:var(--text3)">${escHtml(meta)}</span>` : ''}
      </div>
      ${d.note ? `<div class="log-note">${escHtml(d.note)}</div>` : ''}`;
    }).join('');
    if (!entries.trim()) return '';
    const hasPeriod = Object.values(recs || {}).some(d => d?.period);
    return `<div class="log-entry${hasPeriod ? ' has-period' : ''}">
      <div class="log-date-header"><span>${fmtDate(date)}</span><span>第${dayNum}天</span></div>
      ${entries}
    </div>`;
  }).filter(Boolean).join('');
}

// ============ CHAT ============
function listenChat() {
  const r = window._dbRef(window._db, 'chat');
  chatUnsubscribe = window._dbOnValue(r, snap => {
    const box = document.getElementById('chat-messages');
    if (!snap.exists()) { box.innerHTML = '<div style="text-align:center;color:var(--text3);padding:40px;font-size:14px">快来聊天吧！</div>'; return; }
    const msgs = snap.val();
    const arr = Object.values(msgs).sort((a,b) => (a.ts||0)-(b.ts||0));
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    box.innerHTML = arr.map(m => {
      const p = PERSONS[m.user];
      const isMe = m.user === currentUser;
      const time = m.ts ? new Date(m.ts).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}) : '';
      return `<div class="msg-row ${isMe ? 'me' : ''}">
        <div class="msg-sender-name">${p.name}</div>
        <div class="msg-bubble ${p.bubbleClass}">${escHtml(m.text)}</div>
        <div class="msg-time">${time}</div>
      </div>`;
    }).join('');
    if (atBottom || arr[arr.length-1]?.user === currentUser) {
      box.scrollTop = box.scrollHeight;
    }
  });
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  input.style.height = 'auto';
  try {
    await window._dbPush(window._dbRef(window._db, 'chat'), {
      user: currentUser,
      text: text,
      ts: Date.now()
    });
  } catch(e) {
    showToast('发送失败');
  }
}

// ============ UTILS ============
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

window.login = login;
window.logout = logout;
window.switchPage = switchPage;
window.saveToday = saveToday;
window.toggleChip = toggleChip;
window.calcDiff = calcDiff;
window.sendChat = sendChat;
window.autoResize = autoResize;
