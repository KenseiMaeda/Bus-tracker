// firebaseLive.js — Firebase購読 → イベント通知（全ビーコンで発火）

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import {
  getDatabase, ref, onChildAdded, query, limitToLast, get, child, orderByKey
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";

import { firebaseConfig } from './config.js';
import { parseTime } from './utils.js';

// init
export const appFb = initializeApp(firebaseConfig);
export const db  = getDatabase(appFb);

// PC側位置（停留所テーブル）を強制するか
let FORCE_SERVER_POSITION = true;
export function setForceServerPosition(v){ FORCE_SERVER_POSITION = !!v; }
export function isForceServerPosition(){ return FORCE_SERVER_POSITION; }

function ensureUi(ui){
  if (ui && typeof ui.afterUpsert === 'function') return ui;
  return { ...(ui||{}), afterUpsert: () => {} };
}

// 停留所名の素朴な整形（任意）
function normalizeStopName(name){
  return String(name||'').trim();
}

// 必要イベントを投げる（全ビーコンで発火）
function emitBusEventByPolicy(v, timeISO){
  const name = v?.name ?? '';
  const rssi = v?.rssi;
  const stopName = v.stopName || v.nearestStop || normalizeStopName(name);

  if (FORCE_SERVER_POSITION) {
    // 停留所スナップを優先
    if (stopName) {
      window.dispatchEvent(new CustomEvent('bus-at-stop', {
        detail: { stopName, rssi, time: timeISO }
      }));
    } else if (typeof v.lat === 'number' && typeof v.lng === 'number') {
      // 停留所名が無いときだけ lnglat 直置き
      window.dispatchEvent(new CustomEvent('bus-at-lnglat', {
        detail: { lng: v.lng, lat: v.lat, rssi, time: timeISO }
      }));
    }
  } else {
    // 緯度経度優先、無ければ停留所へ
    if (typeof v.lat === 'number' && typeof v.lng === 'number') {
      window.dispatchEvent(new CustomEvent('bus-at-lnglat', {
        detail: { lng: v.lng, lat: v.lat, rssi, time: timeISO }
      }));
    } else if (stopName) {
      window.dispatchEvent(new CustomEvent('bus-at-stop', {
        detail: { stopName, rssi, time: timeISO }
      }));
    }
  }
}

function handleBeacon(map, ui, receiverId, v, t){
  ui = ensureUi(ui);
  const timeISO = t?.toISOString?.() || null;

  // ★ 全ビーコンで出す
  emitBusEventByPolicy(v, timeISO);

  // 軽いUI表示
  if (ui?.lastUpdatedEl) {
    ui.lastUpdatedEl.textContent =
      `— 更新: ${new Date().toLocaleTimeString()} | BUILD: ${new Date().toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}`;
  }
  ui.afterUpsert();
}

export async function backfillReceiver(map, ui, receiverId, n=20){
  try{
    ui = ensureUi(ui);
    const q = query(ref(db, `beacon_logs/${receiverId}`), orderByKey(), limitToLast(n));
    const snap = await get(q);
    if (!snap.exists()) return;
    const vals = snap.val();
    const keys = Object.keys(vals).sort();
    for (const k of keys){
      const v = vals[k]; if (!v) continue;
      const t = parseTime(v.time);
      handleBeacon(map, ui, receiverId, v, t);
    }
  }catch(e){ console.warn('[BACKFILL] failed', receiverId, e); }
}

export function subscribeReceiverLive(map, ui, receiverId, onErr){
  ui = ensureUi(ui);
  const q1 = query(ref(db, `beacon_logs/${receiverId}`), limitToLast(1));
  onChildAdded(q1, (logSnap) => {
    const v = logSnap.val(); if(!v) return;
    const t = parseTime(v.time);
    handleBeacon(map, ui, receiverId, v, t);
  }, (err) => { onErr?.(err); });
}

export async function initReceivers(map, ui, setErr){
  try{
    const root = ref(db);
    const recvSnap = await get(child(root, "beacon_logs"));
    if (recvSnap.exists()) {
      const receivers = Object.keys(recvSnap.val());
      for (const rid of receivers){
        await backfillReceiver(map, ui, rid, 20);
        subscribeReceiverLive(map, ui, rid, (e)=> setErr?.(e?.message ?? String(e)));
      }
    } else {
      console.warn("[DEBUG] beacon_logs が空 or 読み取り不可");
    }
  }catch(e){
    console.error("[DEBUG] initial get error:", e);
    setErr?.(e?.message ?? String(e));
  }
}
