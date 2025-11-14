// js/app.js  — orchestrator only
import { MAPTILER_KEY } from './config.js';
import { routeInit, routeEnsure } from './layers/route.js';
import { ensureStopsLayer } from './layers/stops.js';
import { enableTerrain } from './map/terrain.js';
import { enableBuildings } from './map/buildings.js';
import { fitToCurrent, setGroundView, setTopView, resetView, jumpToFirstPerson } from './ui/view.js';
import { wireUi } from './ui/wire.js';
import { initReceivers, setForceServerPosition } from './firebaseLive.js';
import { ensurePeople3DLayer, setPeople3DVisible } from './bus3d.js';

const INITIAL_VIEW = { center:[140.1036747,36.1113697], zoom:15, pitch:60, bearing:-20 };

// MapLibre の初期化
export const map = new maplibregl.Map({
  container: 'map',
  style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
  ...INITIAL_VIEW, antialias:true, maxPitch:85, pitchWithRotate:true, dragRotate:true
});

//地図UI（操作ボタン）
map.addControl(new maplibregl.NavigationControl({ visualizePitch:true }), 'top-right');
map.addControl(new maplibregl.FullscreenControl(), 'top-right');
map.touchZoomRotate.enable(); 
map.touchZoomRotate.enableRotation();

// missing sprite image fallback
map.on('styleimagemissing', (e)=>{
  const id=(e?.id??'').trim(); if (!id || map.hasImage(id)) return;
  const c=document.createElement('canvas'); c.width=c.height=1;
  map.loadImage(c.toDataURL(), (err,img)=>{ if(!err && img && !map.hasImage(id)) map.addImage(id,img,{sdf:false}); });
});

// 地図読込完了 → 全機能を初期化
map.on('load', async ()=>{
  
  // Terrain（標高）と Buildings（3D建物）
  enableTerrain(map);
  enableBuildings(map);

  ensureStopsLayer(map);

  ensurePeople3DLayer(map);
  setPeople3DVisible(true);

  await routeInit(map);       // route.geojson 読込 or 停留所補間
  await routeEnsure(map);

  setForceServerPosition(true);

  const uiCtx = {
    lastUpdatedEl: document.getElementById('last-updated'),
    afterUpsert: ()=>{}, recomputeAndFilter: ()=>{}, updateTargetHighlight: ()=>{}
  };
  const setErr = (msg)=>{ const el=document.getElementById('err'); if (el) el.textContent = msg || ''; };
  await initReceivers(map, uiCtx, setErr);

  spawnProbeIfNeeded(map);    // ?probe=1 で赤い人スポーン
  wireUi({ map, fitToCurrent, setGroundView, setTopView, resetView, jumpToFirstPerson });
  fitToCurrent(map);
});

// optional small header status
(function(){
  const el=document.getElementById('conn'); if(!el) return;
  const set=(t)=> el.textContent=t;
  map.on('load', ()=>set('地図ロード完了'));
  map.on('error', (e)=>set('地図エラー: ' + (e?.error?.message || '')));
})();
