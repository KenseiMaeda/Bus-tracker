// DOM/表示
export const $ = id => document.getElementById(id);
export const setText = (el, txt) => { if (el) el.textContent = txt; };
export const appendChild = (el, child) => { if (el) el.appendChild(child); };

// 幾何/数値
const R2D = Math.PI/180;
export const ll2xy = ([lat,lng]) => [ lng * Math.cos(lat*R2D), lat ];
export function pointSegDist2(P, A, B){
  const a=ll2xy(A), b=ll2xy(B), p=ll2xy(P);
  const abx=b[0]-a[0], aby=b[1]-a[1];
  const apx=p[0]-a[0], apy=p[1]-a[1];
  const ab2=abx*abx+aby*aby || 1e-9;
  let t=(apx*abx+apy*aby)/ab2; t=Math.max(0,Math.min(1,t));
  const x=a[0]+t*abx, y=a[1]+t*aby;
  const dx=p[0]-x, dy=p[1]-y;
  return dx*dx+dy*dy;
}
export const meters = (a,b) => {
  const [lat1,lng1]=a,[lat2,lng2]=b;
  const x=(lng2-lng1)*Math.cos(((lat1+lat2)/2)*R2D), y=(lat2-lat1);
  return Math.hypot(x,y)*111000;
};

// 名前正規化
export const aliasMap = { "筑波大中央":"筑波大学中央", "大学会館":"大学会館前", "筑波病院入口前":"筑波病院入口" };
export function normalizeName(raw, allStops, beaconCoordinates){
  const s = (raw||'')
    .replace(/\s+/g,'')
    .replace(/[－―‐—–-]/g,'-')
    .replace(/[（）]/g, m => ({'（':'(', '）':')'}[m]))
    .trim();
  if (aliasMap[s]) return aliasMap[s];
  const dict = {};
  for (const k of Object.keys(allStops)) dict[k.replace(/\s+/g,'')] = k;
  for (const k of Object.keys(beaconCoordinates)) dict[k.replace(/\s+/g,'')] = k;
  return dict[s] || raw;
}

// 時刻
export function parseTime(t){
  if (typeof t === 'number') {
    if (t > 1e12) return t;
    if (t > 1e9)  return t*1000;
    if (t > 0)    return t;
    return 0;
  }
  if (typeof t === 'string'){
    const m = t.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
    if (m){
      const [_,Hs,Ms,Ss] = m;
      const now = new Date();
      const utcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), Number(Hs)-9, Number(Ms), Number(Ss), 0);
      let ms = utcMs; if (ms > Date.now()+60*1000) ms -= 24*3600*1000;
      return ms;
    }
    if (/^\d+$/.test(t)) {
      const n = Number(t);
      if (n > 1e12) return n;
      if (n > 1e9)  return n*1000;
    }
    const iso = /Z|([+-]\d{2}:?\d{2})$/.test(t) ? t : (t ? t+'Z' : '');
    const ms = Date.parse(iso);
    if (!isNaN(ms)) return ms;
  }
  console.warn('[TIME PARSE FAIL]', t);
  return 0;
}

// 矩形ポリゴン（m指定）
export function rectAround([lng, lat], widthM = 1.0, depthM = 1.0){
  const dLat = depthM / 111000;
  const dLng = widthM / (111000 * Math.cos(lat * Math.PI/180));
  return [
    [lng - dLng/2, lat - dLat/2],
    [lng + dLng/2, lat - dLat/2],
    [lng + dLng/2, lat + dLat/2],
    [lng - dLng/2, lat + dLat/2],
    [lng - dLng/2, lat - dLat/2],
  ];
}

// RSSI→高さ
export const rssiToH = (r, min=-100, max=-40, MAXH=60) => {
  if (typeof r !== 'number') return 0;
  const t = Math.max(min, Math.min(max, r));
  const norm = (t - min)/(max - min);
  return Math.pow(norm, 1.4) * MAXH;
};

// deck.gl 存在チェック
export const deckAvailable = () => { try { return !!(window.deck && deck.MapboxLayer && deck.SimpleMeshLayer); } catch { return false; } };
