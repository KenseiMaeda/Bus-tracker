// bus3d.js — 足元オートリフト + スムージング + 向き適用後の足元推定 + 強制ベースリフト

let _map = null;
let _layer = null;
const _persons = new Map();

// ==== モデル設定（バス） ====
const MODEL_URL = new URL('../models/bus.glb', import.meta.url).href;
const SCALE = 1.0;           // glbが1unit=1m想定。違う場合はここを調整
const ORIENT = [0, 0, 90];   // [pitch, yaw, roll] deg（ScenegraphLayerに合わせる）

// ==== 地面・標高 ====
const USE_EXAGGERATED = true;
let   CLEARANCE_M = 0.40;          // 地面からの常時クリアランス
const FALLBACK_Z_M = 6.0;          // DEM未取得時の仮置き高さ
const NEIGHBOR_RADIUS_M = 2.0;     // 最大標高サンプリング半径
const MAX_DROP_PER_REFRESH_M = 0.15; // 1回で沈む最大量

// ==== Z安定化 ====
const EMA_UP = 0.55;           // 上は速く追従
const EMA_DOWN = 0.10;         // 下はゆっくり
const HYSTERESIS_M = 0.03;     // 3cm以内は無視
const STABLE_LOCK_TICKS = 6;   // 安定ロック
const UNLOCK_MOVE_M = 0.6;     // 移動でロック解除

// ==== 足元オフセット + 強制ベースリフト ====
let footOffsetM = null;        // glb最下点→原点の距離（ORIENT適用後に算出）
let HARD_LIFT_M = 40;          // 追加の“常時”底上げ（確実に浮かせるための固定値）
let extraLiftM = 0;            // その場の微調整

/* ---------- 標高取得 ---------- */
function groundAt(lng, lat) {
  try {
    const z = _map?.queryTerrainElevation({ lng, lat }, { exaggerated: USE_EXAGGERATED });
    if (Number.isFinite(z)) return z;
  } catch {}
  return NaN;
}
function metersToDegrees(lat, dxM, dyM) {
  const cos = Math.cos((lat * Math.PI) / 180);
  const dLng = dxM / (111320 * Math.max(cos, 1e-6));
  const dLat = dyM / 110540;
  return [dLng, dLat];
}
function groundMaxAround(lng, lat, rM = NEIGHBOR_RADIUS_M) {
  const samples = [[0,0],[ rM,0],[-rM,0],[0, rM],[0,-rM]];
  let maxZ = NaN;
  for (const [dx, dy] of samples) {
    const [dLng, dLat] = metersToDegrees(lat, dx, dy);
    const z = groundAt(lng + dLng, lat + dLat);
    if (Number.isFinite(z)) maxZ = Number.isFinite(maxZ) ? Math.max(maxZ, z) : z;
  }
  return Number.isFinite(maxZ) ? maxZ : NaN;
}

/* ---------- 目標Z計算 ---------- */
function computeTargetZ(lng, lat) {
  const g = groundMaxAround(lng, lat);
  const base = Number.isFinite(g) ? g : FALLBACK_Z_M;

  // 足元オフセット：未取得時は安全側 1.7m
  const foot = (footOffsetM ?? 1.7);

  // Z = 地面 + 足元オフセット*SCALE + クリアランス + ベースリフト + 追加微調整
  return base + foot * SCALE + CLEARANCE_M + HARD_LIFT_M + extraLiftM;
}

function _asArray(){ return Array.from(_persons.values()); }

/* ---------- Z更新（スムージング＋ロック＋沈み制限） ---------- */
function refreshAllZ() {
  let changed = false;
  for (const p of _persons.values()) {
    const target = computeTargetZ(p.lng, p.lat);

    if (p.locked) {
      if (Math.abs(target - (p.zDisp ?? target)) > 1.0) { p.locked = false; p.stableTicks = 0; }
      else continue;
    }

    const currentDisp = Number.isFinite(p.zDisp) ? p.zDisp : target;
    const diff = target - currentDisp;

    if (Math.abs(diff) <= HYSTERESIS_M) {
      p.stableTicks = (p.stableTicks || 0) + 1;
      if (p.stableTicks >= STABLE_LOCK_TICKS) p.locked = true;
      continue;
    } else {
      p.stableTicks = 0;
    }

    const alpha = diff > 0 ? EMA_UP : EMA_DOWN;
    let nextDisp = (1 - alpha) * currentDisp + alpha * target;

    if (nextDisp < currentDisp - MAX_DROP_PER_REFRESH_M) {
      nextDisp = currentDisp - MAX_DROP_PER_REFRESH_M;
    }

    if (!Number.isFinite(p.zDisp) || Math.abs(nextDisp - p.zDisp) > 1e-3) {
      p.zDisp = nextDisp;
      p.z = target;
      changed = true;
    }
  }
  if (changed && _layer) {
    const arr = _asArray().map(d => ({ ...d, z: Number.isFinite(d.zDisp) ? d.zDisp : d.z ?? FALLBACK_Z_M }));
    _layer.setProps({ data: arr });
  }
}

/* ---------- GLB足元オフセット（ORIENT適用後に推定） ---------- */
async function ensureFootOffsetMeters() {
  if (footOffsetM != null) return footOffsetM;

  const [{ GLTFLoader }, THREE] = await Promise.all([
    import('https://unpkg.com/three@0.161.0/examples/jsm/loaders/GLTFLoader.js').then(m => ({ GLTFLoader: m.GLTFLoader })),
    import('https://unpkg.com/three@0.161.0/build/three.module.js')
  ]);

  const loader = new GLTFLoader();
  const gltf = await new Promise((res, rej) => loader.load(MODEL_URL, res, undefined, rej));

  // 表示と同じ回転（ORIENT）を適用した“仮シーン”でバウンディングボックスを測る
  const clone = gltf.scene.clone(true);
  // pitch(x), yaw(y), roll(z)
  const toRad = (deg) => (deg * Math.PI) / 180;
  const euler = new THREE.Euler(toRad(ORIENT[0]), toRad(ORIENT[1]), toRad(ORIENT[2]), 'XYZ');
  clone.rotation.copy(euler);

  const box = new THREE.Box3().setFromObject(clone);
  const min = new THREE.Vector3();
  box.getMin(min);

  // ThreeはY-up。回転後のY(=上)軸に対する最下点を採用
  footOffsetM = Math.max(0, -min.y);

  console.log('[bus3d] footOffset(m) after ORIENT:', footOffsetM);
  return footOffsetM;
}

/* ---------- Deck.gl layer ---------- */
export function ensurePeople3DLayer(map){
  if (_layer) return;
  _map = map;

  _layer = new deck.MapboxLayer({
    id: 'bus-3d',
    type: deck.ScenegraphLayer,
    data: _asArray(),
    scenegraph: MODEL_URL,
    getPosition: d => [d.lng, d.lat, (Number.isFinite(d.zDisp) ? d.zDisp : d.z ?? FALLBACK_Z_M)],
    getScale: d => [SCALE, SCALE, SCALE],
    getOrientation: d => ORIENT,
    _lighting: 'pbr',
    pickable: false,
    parameters: { depthTest: true, depthMask: true },
    onError: (e) => console.warn('[bus3d] model load error:', e)
  });
  map.addLayer(_layer);

  ensureFootOffsetMeters().then(() => refreshAllZ()).catch(console.warn);

  const kick = () => setTimeout(refreshAllZ, 120);
  map.on('styledata',  kick);
  map.on('sourcedata', kick);
  map.on('moveend',    kick);
  map.on('zoomend',    kick);
  map.once('load',     kick);

  // 起動直後、DEM安定まで複数回再配置
  let count = 0;
  const bootTimer = setInterval(() => {
    refreshAllZ();
    if (++count >= 10) clearInterval(bootTimer);
  }, 500);

  // デバッグ/チューニングAPI
  window.bus3d = {
    setGroundClearance(m){ CLEARANCE_M = Math.max(0, Number(m)||0); refreshAllZ(); },
    setBaseLift(m){ HARD_LIFT_M = Math.max(0, Number(m)||0); refreshAllZ(); },
    nudgeAll(dz){ extraLiftM += Number(dz)||0; refreshAllZ(); },
    setExtraLift(m){ extraLiftM = Number(m)||0; refreshAllZ(); },
    refreshAllZ,
    getFootOffset(){ return footOffsetM; }
  };
}

/* ---------- 可視/配置API ---------- */
export function setPeople3DVisible(visible){
  if (!_layer || !_map) return;
  _map.setLayoutProperty(_layer.id, 'visibility', visible ? 'visible' : 'none');
}

export function upsertPerson3D(id, lng, lat, color='#38bdf8'){
  const nz = computeTargetZ(lng, lat);
  const prev = _persons.get(id);

  // 移動距離[m]でロック解除
  const moved = prev
    ? Math.hypot(
        (lng - prev.lng) * 111320 * Math.cos((lat*Math.PI)/180),
        (lat - prev.lat) * 110540
      )
    : Infinity;
  const unlock = moved > UNLOCK_MOVE_M;

  const zDisp = prev && !unlock ? (Number.isFinite(prev.zDisp) ? prev.zDisp : prev.z) : nz;
  const locked = prev && !unlock ? prev.locked : false;
  const stableTicks = prev && !unlock ? (prev.stableTicks || 0) : 0;

  _persons.set(id, {
    id, lng, lat,
    z: nz,
    zDisp,
    locked,
    stableTicks,
    color
  });

  if (_layer) {
    const arr = _asArray().map(d => ({ ...d, z: Number.isFinite(d.zDisp) ? d.zDisp : d.z ?? FALLBACK_Z_M }));
    _layer.setProps({ data: arr });
  }
}

export function getPeople3D(){ return _asArray(); }
