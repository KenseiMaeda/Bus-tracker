// js-rssi/charting.js
// 前提: Chart / chartjs-plugin-annotation はグローバル読み込み済み
import { ColorMgr } from './colorMgr.js';
import { MAX_POINTS } from './constants.js';

let chart = null;
let legendEl = null;

export function initChart() {
  const ctx = document.getElementById('chart');
  legendEl = document.getElementById('legend');

  chart = new Chart(ctx, {
    type: 'line',
    data: { datasets: [] },
    options: {
      animation: false, responsive: true, parsing: false,
      plugins: {
        legend: { display: false },
        annotation: { annotations: {} }
      },
      scales: { x: { type:'time', time:{ unit:'minute' } }, y:{ reverse:true, title:{ display:true, text:'RSSI (dBm)' } } },
      elements: { point:{ radius:0 }, line:{ borderWidth:1 } }
    }
  });
  return chart;
}

export function getChart(){ return chart; }
export function getLegend(){ return legendEl; }

export function ensureSeries(seriesKey, label){
  let ds = chart.data.datasets.find(d => d.seriesKey === seriesKey);
  if (!ds){
    const color = ColorMgr.colorFor(seriesKey);
    ds = { label: label ?? seriesKey, seriesKey, data: [], borderColor: color, backgroundColor:'transparent', tension:0.1 };
    chart.data.datasets.push(ds);

    // 凡例チップ
    const chip = document.createElement('div'); chip.className='chip'; chip.id='chip-'+seriesKey;
    chip.innerHTML = `<span class="dot" style="background:${color}"></span><span>${label ?? seriesKey}</span>`;
    legendEl.appendChild(chip);
  }
  return ds;
}

export function pruneIfHeavy(ds){
  if (ds.data.length > MAX_POINTS) ds.data = ds.data.filter((_,i)=>i%2===0);
}

export function clearChartAndLegend(){
  chart.data.datasets = [];
  chart.options.plugins.annotation.annotations = {};
  chart.update();
  legendEl.innerHTML = '';
}
