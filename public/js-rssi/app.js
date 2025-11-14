// js-rssi/app.js
import { fb, initFirebase } from './firebaseApp.js';
import { MAX_POINTS, COLS, MARK_COLS } from './constants.js';
import { toJSTISO, parseTimeAny, haversineM, matchFilter, sheetKey, labelForLegend, seriesKeyOf } from './utils.js';
import { ColorMgr } from './colorMgr.js';
import { initChart, getChart, ensureSeries, pruneIfHeavy, clearChartAndLegend } from './charting.js';
import { saveXlsx } from './excel.js';

// ===== DOM refs =====
const statusEl = document.getElementById('status');
const lastEl   = document.getElementById('last');
const selRecv  = document.getElementById('sel-receiver');
const filterEl = document.getElementById('filter');
const btnStart = document.getElementById('btn-start');
const btnMark  = document.getElementById('btn-mark');
const btnStop  = document.getElementById('btn-stop');
const btnClear = document.getElementById('btn-clear');

// ===== Chart init =====
initChart();

// ===== Runtime state =====
let isRunning = false;
let detach = null;
let startedAt = 0;

// 距離
let startPos = null;
let lastPos  = null;
let cumDistM = 0;

// Excel rows
let allRows = [ [...COLS] ];
let byName  = new Map();
let markRows = [ [...MARK_COLS] ];
let markCount = 0;

function annoKey(ts){ return `mark_${ts}`; }

function resetView(){
  ColorMgr.reset();
  clearChartAndLegend();
  allRows = [ [...COLS] ];
  byName.clear();
  markRows = [ [...MARK_COLS] ];
  markCount = 0;
}

function addLocalMark(){
  if (!isRunning) return;
  const chart = getChart();
  const ts = Date.now();
  const label = `tap#${++markCount}`;
  markRows.push([label, toJSTISO(ts)]);

  chart.options.plugins.annotation.annotations[annoKey(ts)] = {
    type: 'line',
    xMin: ts,
    xMax: ts,
    borderColor: '#10b981',
    borderWidth: 2,
    label: {
      display: true,
      content: label,
      position: 'start',
      backgroundColor: 'rgba(16,185,129,.15)',
      color: '#064e3b',
      padding: 4
    }
  };
  chart.update('none');
  statusEl.textContent = `マーク: ${label} @ ${new Date(ts).toLocaleTimeString()}`;
}

function pushRows(v, localNowMs, distFromStartM, cumDistMCurrent){
  const clientMs = Number.isFinite(v.client_ts) ? v.client_ts : parseTimeAny(v.time);
  const serverMs = Number.isFinite(v.server_ts) ? v.server_ts : parseTimeAny(v.server_time);
  const localMs  = localNowMs;

  const cISO = toJSTISO(Number.isFinite(clientMs)?clientMs:NaN);
  const sISO = toJSTISO(Number.isFinite(serverMs)?serverMs:NaN);
  const lISO = toJSTISO(Number.isFinite(localMs)?localMs:NaN);

  const lat = (typeof v.lat === 'number') ? v.lat : '';
  const lng = (typeof v.lng === 'number') ? v.lng : '';
  const alt = (typeof v.alt === 'number') ? v.alt : '';

  const row = [
    String(v.name ?? ''), (v.rssi!=null ? String(v.rssi) : ''),
    String(lat), String(lng), String(alt),
    cISO, sISO, lISO,
    Number.isFinite(distFromStartM) ? String(Math.round(distFromStartM)) : '',
    Number.isFinite(cumDistMCurrent) ? String(Math.round(cumDistMCurrent)) : ''
  ];

  allRows.push(row);
  const key = sheetKey(v);
  if (!byName.has(key)) byName.set(key, [ [...COLS] ]);
  byName.get(key).push(row);
}

// ===== Firebase bootstrap =====
const { app, db, auth } = initFirebase();

// 匿名ログイン → 受信機一覧
fb.onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  try {
    const snap = await fb.get(fb.child(fb.ref(db), 'beacon_logs'));
    const keys = snap.exists() ? Object.keys(snap.val()) : [];
    selRecv.innerHTML = keys.map(k => `<option value="${k}">${k}</option>`).join('') || `<option>(なし)</option>`;
    statusEl.textContent = 'ログイン済み。受信機を選んで開始できます。';
  } catch (e) {
    statusEl.textContent = '初期ロードでエラー: ' + (e?.message || e);
    console.error(e);
  }
});
fb.signInAnonymously(auth).catch((e) => {
  statusEl.textContent = 'サインイン失敗: ' + (e?.message || e);
  console.error(e);
});

// ===== Start/Stop =====
async function start(){
  if (isRunning) return;
  if (!selRecv.value) return alert('受信機が選ばれていません');

  resetView();
  startPos = null; lastPos = null; cumDistM = 0;
  startedAt = Date.now(); isRunning = true;

  btnStart.disabled=true; btnStop.disabled=false; btnMark.disabled=false;
  lastEl.textContent='— 記録中…';
  statusEl.textContent='リアルタイム受信を開始しました。';

  const receiverId = selRecv.value;
  const q = fb.query(fb.ref(db, `beacon_logs/${receiverId}`), fb.limitToLast(1));

  const off = fb.onChildAdded(q, (s) => {
    const chart = getChart();
    const localNow = Date.now();
    const v = s.val() || {};
    if (!matchFilter(v, filterEl.value)) return;

    const tForChart = parseTimeAny(v.client_ts ?? v.time ?? v.server_ts) || localNow;
    const ds = ensureSeries(seriesKeyOf(v), labelForLegend(v));
    if (v.rssi!=null) ds.data.push({ x:tForChart, y:v.rssi });
    pruneIfHeavy(ds);
    chart.update('none');

    // 距離
    let distFromStartM = NaN;
    const lat = (typeof v.lat === 'number') ? v.lat : NaN;
    const lng = (typeof v.lng === 'number') ? v.lng : NaN;
    if (Number.isFinite(lat) && Number.isFinite(lng)){
      if (!startPos) startPos = { lat, lng };
      distFromStartM = haversineM(startPos.lat, startPos.lng, lat, lng);
      if (lastPos){
        const step = haversineM(lastPos.lat, lastPos.lng, lat, lng);
        if (Number.isFinite(step) && step <= 2000) cumDistM += step;
      }
      lastPos = { lat, lng };
    }

    // Excel 行
    pushRows(v, localNow, distFromStartM, cumDistM);

    const showD = d => Number.isFinite(d) ? `${Math.round(d)} m` : '—';
    statusEl.textContent = `リアルタイム受信中｜始点からの直線距離: ${showD(distFromStartM)}｜累積距離: ${showD(cumDistM)}`;
    lastEl.textContent=`— 更新: ${new Date().toLocaleTimeString()}`;
  }, (err)=>{ statusEl.textContent = 'エラー: '+(err?.message||String(err)); });

  detach = () => off();
}

async function stop(){
  if (!isRunning) return;
  isRunning=false;
  if (detach) { detach(); detach=null; }
  btnStart.disabled=false; btnStop.disabled=true; btnMark.disabled=true;

  statusEl.textContent='停止しました。Excel を保存します…';
  try {
    await saveXlsx(byName, allRows, markRows, selRecv.value, startedAt);
    statusEl.textContent='停止し、Excel を保存しました。';
  } catch (e) {
    console.error(e);
    statusEl.textContent='保存時にエラーが発生しました。';
  }
  lastEl.textContent='— 停止中';
}

// ===== UI events =====
btnStart.addEventListener('click', start);
btnStop .addEventListener('click', stop);
btnClear.addEventListener('click', ()=>{
  const chart = getChart();
  chart.data.datasets.forEach(ds=>ds.data=[]);
  chart.update();
});
btnMark .addEventListener('click', addLocalMark);
