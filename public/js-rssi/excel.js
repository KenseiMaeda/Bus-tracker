// js-rssi/excel.js
import { excelSafeSheetName } from './utils.js';

// グローバル XLSX を使用
export async function saveXlsx(byName, allRows, markRows, selRecvValue, startedAt){
  const wb = XLSX.utils.book_new();
  const used = new Set();
  const uniq = (name)=>{
    let base = excelSafeSheetName(name);
    let n=1, out=base;
    while(used.has(out) || out===''){ out = (base.slice(0,29)) + '_' + (++n); }
    used.add(out); return out;
  };

  for (const [label, rows] of byName.entries()){
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, uniq(label));
  }

  const wsAll = XLSX.utils.aoa_to_sheet(allRows.length ? allRows : [['']]);
  XLSX.utils.book_append_sheet(wb, wsAll, "ALL");

  const wsMarks = XLSX.utils.aoa_to_sheet(markRows.length ? markRows : [['label','datetime_local']]);
  XLSX.utils.book_append_sheet(wb, wsMarks, "MARKERS");

  const fname = `rssi_${selRecvValue||'receiver'}_${new Date(startedAt||Date.now()).toISOString().replace(/[:.]/g,'-')}.xlsx`;
  XLSX.writeFile(wb, fname);
}
