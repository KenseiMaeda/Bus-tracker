// DOM/表示
export const $ = id => document.getElementById(id);
export const setText = (el, txt) => { if (el) el.textContent = txt; };
export const appendChild = (el, child) => { if (el) el.appendChild(child); };

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

// deck.gl 存在チェック
export const deckAvailable = () => { try { return !!(window.deck && deck.MapboxLayer && deck.SimpleMeshLayer); } catch { return false; } };
