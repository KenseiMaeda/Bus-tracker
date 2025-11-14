// js-rssi/utils.js
export function toJSTISO(ms){
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms + 9*3600*1000);
  const pad = (n, z=2)=>String(n).padStart(z,'0');
  const y = d.getUTCFullYear(), m = pad(d.getUTCMonth()+1), day = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours()), mm = pad(d.getUTCMinutes()), ss = pad(d.getUTCSeconds());
  const ms3 = pad(d.getUTCMilliseconds(),3);
  return `${y}-${m}-${day}T${hh}:${mm}:${ss}.${ms3}+09:00`;
}

export function parseTimeAny(t){
  if (typeof t === 'number') return (t>0 && t<1e12) ? t*1000 : t;
  if (typeof t === 'string'){
    if (/^\d+$/.test(t)) { const n = Number(t); return (n>0 && n<1e12) ? n*1000 : n; }
    const ms = Date.parse(t); if (!isNaN(ms)) return ms;
  }
  return NaN;
}

export function haversineM(lat1, lon1, lat2, lon2){
  if (![lat1,lon1,lat2,lon2].every(Number.isFinite)) return NaN;
  const R = 6371000, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function excelSafeSheetName(raw){
  const s = String(raw ?? '').replace(/[\\\/:\?\*\[\]]/g,'_').slice(0,31) || 'unknown';
  return s;
}

export function matchFilter(v, expr){
  if (!expr || !expr.trim()) return true;
  const parts = expr.split('&').map(s => s.trim()).filter(Boolean);
  for (const p of parts){
    const m = p.match(/^(\w+)\s*=\s*(.+)$/); if (!m) continue;
    const k=m[1], val=m[2]; const vv=(v[k]??'').toString(); if (vv!=val) return false;
  }
  return true;
}

export function sheetKey(v){
  if (v?.name) return v.name;
  if (v?.uuid && (v.major!=null) && (v.minor!=null)) return `${v.uuid} (${v.major},${v.minor})`;
  if (v?.mac) return v.mac;
  return 'unknown';
}

export function labelForLegend(v){
  if (v?.name) return v.name;
  if (v?.uuid && (v.major!=null) && (v.minor!=null)) return `${v.uuid} (${v.major},${v.minor})`;
  if (v?.mac) return v.mac;
  return 'unknown';
}

export function seriesKeyOf(v){
  if (v?.name) return `name:${v.name}`;
  if (v?.uuid && (v.major!=null) && (v.minor!=null)) return `id:${v.uuid}/${v.major}/${v.minor}`;
  if (v?.mac) return `mac:${v.mac}`;
  return 'beacon:unknown';
}
