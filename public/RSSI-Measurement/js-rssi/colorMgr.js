// js-rssi/colorMgr.js
const SAFE_PALETTE = [
  "#4477AA","#EE6677","#228833","#CCBB44","#66CCEE","#AA3377",
  "#BBBBBB","#000000","#DDDDDD","#117733","#332288","#88CCEE",
  "#44AA99","#999933","#CC6677","#882255","#661100","#6699CC",
  "#AA4466","#88AA00"
];

let assigned = new Map();
let used = new Set();
let gen = 0;

const hsl = (h,s,l)=>`hsl(${Math.round(h)} ${Math.round(s*100)}% ${Math.round(l*100)}%)`;
function pick(){ for(const c of SAFE_PALETTE){ if(!used.has(c)) return c; } return null; }
function genColor(){ const GA=137.508; const c=hsl((gen++*GA)%360,0.75,0.52); return c; }

export const ColorMgr = {
  colorFor(k){
    if (assigned.has(k)) return assigned.get(k);
    const c = pick() ?? genColor();
    used.add(c); assigned.set(k,c);
    return c;
  },
  reset(){
    assigned = new Map(); used = new Set(); gen = 0;
  }
};
