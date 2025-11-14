// js/layers/route.js
import { allStops, routeOuter } from '../data.js';

const SRC_ID = 'route';
const LAYERS = [
  { id:'route-glow',   type:'line', paint:{ 'line-color':'#334155','line-width':18,'line-opacity':0.12 }},
  { id:'route-casing', type:'line', paint:{ 'line-color':'#0b1220','line-width':12,'line-opacity':0.25 }},
  { id:'route-main',   type:'line', paint:{ 'line-color':'#1f2937','line-width':7,'line-opacity':0.95  }},
];

function makeRouteGeoJSONFromStops(order){
  const coords=[]; for(const n of order){ const pt=allStops[n]; if(pt) coords.push([pt[1],pt[0]]); }
  return { type:'Feature', geometry:{ type:'LineString', coordinates:coords } };
}

function addOrUpdateRoute(map, feature){
  const fc={ type:'FeatureCollection', features:[feature] };
  if(!map.getSource(SRC_ID)){
    map.addSource(SRC_ID,{ type:'geojson', data:fc });
    for(const def of LAYERS){ map.addLayer({ id:def.id, type:def.type, source:SRC_ID, paint:def.paint }); }
  }else{
    map.getSource(SRC_ID).setData(fc);
  }
}

async function loadRouteGeoJSON(){
  const candidates=['./route.geojson','route.geojson','/route.geojson'];
  for(const url of candidates){
    try{
      const res=await fetch(url,{ cache:'no-cache' });
      if(!res.ok) continue;
      const gj=await res.json();
      if(gj?.type==='FeatureCollection'){
        const f=gj.features?.find(x=>x?.geometry?.type==='LineString'); if(f) return f;
      }else if(gj?.type==='Feature' && gj.geometry?.type==='LineString'){ return gj; }
    }catch(e){ console.warn('[route] load fail', url, e); }
  }
  return null;
}

export async function routeInit(map){
  const feat = await loadRouteGeoJSON();
  if (feat) addOrUpdateRoute(map, feat);
  else addOrUpdateRoute(map, makeRouteGeoJSONFromStops(routeOuter));
}

export async function routeEnsure(map){
  // no-op placeholder for future (e.g., hot reload/watch)
}
