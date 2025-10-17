import { rectAround, deckAvailable, rssiToH } from './utils.js';
import { STOPS_3D, allStops, routeOuter } from './data.js';
import { MAPTILER_KEY } from './config.js';

// ========= ルート線 =========
function makeRouteGeoJSONFromStops(order){
  const coords = [];
  for (const n of order){ const pt = allStops[n]; if (pt) coords.push([pt[1], pt[0]]); }
  return { type:'Feature', geometry:{ type:'LineString', coordinates: coords } };
}
export function addOrUpdateRoute(map, feat){
  const srcId = 'route';
  if (!map.getSource(srcId)){
    map.addSource(srcId, { type:'geojson', data:{ type:'FeatureCollection', features:[feat] } });
    map.addLayer({ id:'route-glow',   type:'line', source:srcId, paint:{ 'line-color':'#334155','line-width':18,'line-opacity':0.12 }});
    map.addLayer({ id:'route-casing', type:'line', source:srcId, paint:{ 'line-color':'#0b1220','line-width':12,'line-opacity':0.25 }});
    map.addLayer({ id:'route-main',   type:'line', source:srcId, paint:{ 'line-color':'#1f2937','line-width':7,'line-opacity':0.95 }});
  }else{
    map.getSource(srcId).setData({ type:'FeatureCollection', features:[feat] });
  }
}
export async function tryDrawFromGeoJSON(map){
  try{
    const res = await fetch('/route.geojson', { cache:'no-cache' });
    if (!res.ok) return false;
    const gj = await res.json();
    let feat = null;
    if (gj.type === 'FeatureCollection' && gj.features?.length){
      feat = gj.features.find(f=>f.geometry?.type==='LineString');
    } else if (gj.type === 'Feature' && gj.geometry?.type === 'LineString'){
      feat = gj;
    }
    if (feat){ addOrUpdateRoute(map, feat); return true; }
  }catch(e){ console.warn('[Route] geojson load failed:', e); }
  return false;
}
export function drawRouteFromStops(map, order=routeOuter){ addOrUpdateRoute(map, makeRouteGeoJSONFromStops(order)); }

// ========= 停留所（symbol/circle + ラベル） =========
export function ensureStopsLayer(map){
  const stopsData = STOPS_3D.filter(d => d?.name && Number.isFinite(d.lat) && Number.isFinite(d.lng));
  if (!map.getSource('stops-geojson')) {
    const fc = {
      type: 'FeatureCollection',
      features: stopsData.map(d => ({
        type: 'Feature',
        properties: { name: d.name, hasBeacon: d.hasBeacon ? 1 : 0 },
        geometry: { type: 'Point', coordinates: [d.lng, d.lat] }
      }))
    };
    map.addSource('stops-geojson', { type: 'geojson', data: fc });
  }
  if (!map.getLayer('stops-circle')) {
    map.addLayer({
      id: 'stops-circle', type: 'circle', source: 'stops-geojson',
      paint: { 'circle-radius': 5, 'circle-color': '#22C55E','circle-stroke-color': '#fff','circle-stroke-width': 1.2 }
    });
  }
  if (!map.getLayer('stops-labels')) {
    map.addLayer({
      id: 'stops-labels', type: 'symbol', source: 'stops-geojson',
      layout: { 'text-field': ['get', 'name'], 'text-size': 12, 'text-allow-overlap': true, 'symbol-z-order': 'source', 'text-anchor': 'top', 'text-offset': [0, 0.8] },
      paint: { 'text-color': '#15803D','text-halo-color': '#fff','text-halo-width': 0.9,'text-halo-blur': 0.1 }
    });
  }
  const popup = new maplibregl.Popup({ closeButton: true, offset: 10 });
  map.on('click', (e) => {
    try{
      const feats = map.queryRenderedFeatures(e.point, { layers: ['stops-circle', 'stops-labels'] });
      if (feats && feats[0]) {
        const f = feats[0]; const [lng, lat] = f.geometry.coordinates; const name = f.properties.name;
        popup.setLngLat([lng, lat]).setHTML(`🟢 <b>${name}</b><br/>バス停`).addTo(map);
      }
    }catch(err){ console.warn('[stops pick] skip', err); }
  });
}

// ========= バス停：台座＋ポール（fill-extrusion） =========
export function addStopsExtrusions_BasePole(map){
  const features = [];
  const pedestalH = 1.2, poleH = 4.2, poleW = 0.45, pedestalW = 1.2;
  STOPS_3D.forEach(d => {
    const [lng, lat] = [d.lng, d.lat];
    features.push({
      type: 'Feature',
      properties: { name: d.name, part:'pedestal', base: 0, height: pedestalH, color: '#065F46' },
      geometry: { type: 'Polygon', coordinates: [rectAround([lng,lat], pedestalW, pedestalW)] }
    });
    features.push({
      type: 'Feature',
      properties: { name: d.name, part:'pole', base: pedestalH, height: pedestalH + poleH, color: '#9CA3AF' },
      geometry: { type: 'Polygon', coordinates: [rectAround([lng,lat], poleW, poleW)] }
    });
  });
  const fc = { type: 'FeatureCollection', features };
  if (!map.getSource('stops-extrusion')) map.addSource('stops-extrusion', { type: 'geojson', data: fc });
  else map.getSource('stops-extrusion').setData(fc);
  if (!map.getLayer('stops-extrusion')) {
    map.addLayer({
      id: 'stops-extrusion', type: 'fill-extrusion', source:'stops-extrusion', minzoom:14,
      paint:{
        'fill-extrusion-color':['get','color'],
        'fill-extrusion-opacity':['interpolate',['linear'],['zoom'],14,0.85,17,0.94],
        'fill-extrusion-height':['get','height'],
        'fill-extrusion-base':['get','base']
      }
    });
  }
  if (map.getLayer('stops-labels')) map.moveLayer('stops-labels');
}

// ========= 標識ディスク（SimpleMeshLayer：0/90/0, 10倍） =========
function createDiscMesh(radius=0.6, thickness=0.12, segments=32) {
  const positions = [], normals = [], indices = [];
  const halfT = thickness / 2;
  for (let i=0;i<segments;i++){
    const th = (i/segments)*Math.PI*2, x=Math.cos(th)*radius, y=Math.sin(th)*radius;
    positions.push(x,y, halfT); normals.push(0,0,1);
    positions.push(x,y,-halfT); normals.push(0,0,-1);
  }
  const topC = positions.length/3; positions.push(0,0, halfT); normals.push(0,0,1);
  const botC = positions.length/3; positions.push(0,0,-halfT); normals.push(0,0,-1);
  for (let i=0;i<segments;i++){
    const ni=(i+1)%segments, top_i=i*2, top_ni=ni*2, bot_i=i*2+1, bot_ni=ni*2+1;
    indices.push(topC, top_i, top_ni); indices.push(botC, bot_ni, bot_i);
    const v1=[positions[top_i*3], positions[top_i*3+1],  halfT];
    const v2=[positions[top_ni*3],positions[top_ni*3+1], halfT];
    const v3=[positions[bot_i*3], positions[bot_i*3+1], -halfT];
    const v4=[positions[bot_ni*3],positions[bot_ni*3+1],-halfT];
    const nx1=v1[0]/radius, ny1=v1[1]/radius, nx2=v2[0]/radius, ny2=v2[1]/radius;
    const base = positions.length/3;
    positions.push(...v1); normals.push(nx1,ny1,0);
    positions.push(...v3); normals.push(nx1,ny1,0);
    positions.push(...v2); normals.push(nx2,ny2,0);
    positions.push(...v4); normals.push(nx2,ny2,0);
    indices.push(base+0,base+1,base+2); indices.push(base+2,base+1,base+3);
  }
  return { positions:new Float32Array(positions), normals:new Float32Array(normals), indices:new Uint16Array(indices) };
}

/** 冪等化版：存在確認してから追加。removeLayerでコンソールエラーを出さない */
export function ensureSignMeshLayer(map){
  if (!deckAvailable()) { console.warn('[deck] not available, skip sign mesh'); return; }

  // 既にレイヤがあれば何もしない（再実行しても安全）
  if (map.getLayer('bus-stop-signs')) return;

  const mesh = createDiscMesh(0.6, 0.12, 32);
  const pedestalH=1.2, poleH=4.2, signBase=pedestalH+poleH;
  const data = STOPS_3D.map(d => ({ position:[d.lng,d.lat,signBase], name:d.name }));
  const green = [34,197,94,255]; // #22C55E

  const layer = new deck.MapboxLayer({
    id:'bus-stop-signs',
    type:deck.SimpleMeshLayer,
    data,
    mesh,
    getPosition: d=>d.position,
    getColor:   d=>green,
    getOrientation: ()=>[0,90,0], // [pitch,yaw,roll] 0/90/0（円柱の軸＝水平）
    sizeScale: 10,                // 10倍
    pickable:false,
    parameters:{ depthTest:true, depthMask:true }
  });

  map.addLayer(layer);
}

// ========= RSSI（ColumnLayer） =========
const rssiPoints = [];
let rssiLayer = null;
export function addRssiPoint(lat,lng,rssi){
  rssiPoints.push({ lat, lng, height: rssiToH(rssi) });
  if (rssiLayer) rssiLayer.setProps({ data: rssiPoints });
}
export function ensureRssiLayer(map){
  if (!deckAvailable()) { console.warn('[deck] not available, skip rssi layer'); return; }
  if (rssiLayer) return;
  rssiLayer = new deck.MapboxLayer({
    id:'rssi-columns', type:deck.ColumnLayer, data:rssiPoints,
    diskResolution:12, radius:8, extruded:true, pickable:true,
    getPosition:d=>[d.lng,d.lat], getElevation:d=>d.height, elevationScale:1,
    getFillColor:d=>d.color||[56,189,248], parameters:{ depthTest:false, depthMask:false }
  });
  map.addLayer(rssiLayer);
}

// ========= Terrain =========
export function enableTerrain(map){
  try{
    map.addSource('terrain-dem', {
      type:'raster-dem',
      url:`https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=${MAPTILER_KEY}`,
      tileSize:256
    });
    map.setTerrain({ source:'terrain-dem', exaggeration:1.6 });
  }catch(e){ console.warn('[terrain] skip', e); }
}

// ========= Buildings =========
export function enableBuildings(map){
  try{
    const sources = map.getStyle().sources;
    if (sources['openmaptiles'] && !map.getLayer('3d-buildings')) {
      map.addLayer({
        id:'3d-buildings', type:'fill-extrusion', source:'openmaptiles',
        'source-layer':'building', minzoom:15,
        paint:{
          'fill-extrusion-color':'#c8ccd2','fill-extrusion-opacity':0.7,
          'fill-extrusion-height':['coalesce',['get','render_height'],['get','height'],['interpolate',['linear'],['zoom'],15,0,16,10]],
          'fill-extrusion-base':['coalesce',['get','render_min_height'],['get','min_height'],0]
        }
      });
    }
  }catch(e){ console.warn('[3d-buildings] skip', e); }
}

// ========= 絵文字 =========
export function ensureBusEmojiLayer(map){
  if (!map.getSource('stops-geojson')) return;
  if (!map.getLayer('stops-emoji')) {
    map.addLayer({
      id:'stops-emoji', type:'symbol', source:'stops-geojson', minzoom:17,
      layout:{ 'text-field':'🚌','text-size':60,'text-allow-overlap':true,'text-anchor':'bottom','text-offset':[0,-1.2] },
      paint:{ 'text-opacity':0.9 }
    });
  }
}
