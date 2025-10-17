// tools/make-route.js
const https = require('https');
const fs = require('fs');

// === 停留所一覧（lat, lng） ===
const allStops = {
  "つくばセンター":[36.08289942124152,140.11215823302055],
  "吾妻小学校":[36.08545454930246,140.10879643597397],
  "筑波大学春日エリア前":[36.087928739790094,140.10724560688118],
  "筑波メディカルセンター前":[36.09047561919198,140.10558471895652],
  "メディカルセンター病院":[36.092442694229675,140.10572185697816],
  "追越宿舎東":[36.0946576190114,140.10669902289703],
  "天久保2丁目":[36.097460240554796,140.10610406754512],
  "天久保3丁目":[36.10652731090851,140.1056473121722],
  "筑波病院入口":[36.093185892556335,140.1037914639882],
  "追越学生宿舎前":[36.095668888272726,140.1028445895598],
  "平砂学生宿舎前":[36.097919783656984,140.1020445108298],
  "筑波大学西":[36.103511800430105,140.10153750886695],
  "大学会館前":[36.10487541794868,140.10111729192286],
  "第一エリア前":[36.107965400224856,140.0998112941018],
  "第三エリア前":[36.11019180117873,140.0984365219353],
  "虹の広場":[36.11416118595694,140.0970178451117],
  "農林技術センター":[36.11867845255836,140.09621579653592],
  "一ノ矢学生宿舎前":[36.119539646538655,140.09900459735684],
  "大学植物見本園":[36.11624218198861,140.102200745114],
  "TARAセンター前":[36.11307129398093,140.10235269246826],
  "筑波大学中央":[36.111369694255615,140.10367466093868],
  "大学公園":[36.110020652055105,140.104041523001],
  "松美池":[36.10816512507706,140.10439364641243],
  "合宿所":[36.10384602305381,140.1067827908528],
  "天久保池":[36.100705339486716,140.10607356710554],
  "予備":[36.10948194674492,140.09998489081934]
};

// === ルート順 ===
const loopOrder = [
  "つくばセンター","吾妻小学校","筑波大学春日エリア前","筑波メディカルセンター前","メディカルセンター病院",
  "追越宿舎東","天久保2丁目","天久保池","合宿所","天久保3丁目","松美池","大学公園","筑波大学中央",
  "TARAセンター前","大学植物見本園","一ノ矢学生宿舎前","農林技術センター","虹の広場","第三エリア前","第一エリア前",
  "大学会館前","筑波大学西","平砂学生宿舎前","追越学生宿舎前","筑波病院入口","筑波メディカルセンター前","筑波大学春日エリア前","吾妻小学校","つくばセンター"
];

const OSRM = 'https://router.project-osrm.org/route/v1/driving/';

function buildCoords() {
  const parts = loopOrder.map(n => {
    const pt = allStops[n];
    if (!pt) throw new Error('missing stop: '+n);
    const [lat,lng] = pt;
    return `${lng},${lat}`; // OSRMは lng,lat
  });
  return parts.join(';');
}

function fetchOSRM(url){
  return new Promise((resolve,reject)=>{
    https.get(url, res=>{
      let buf=''; res.on('data',d=>buf+=d);
      res.on('end', ()=>{ try{ resolve(JSON.parse(buf)); }catch(e){ reject(e); }});
    }).on('error', reject);
  });
}

(async ()=>{
  try{
    const coords = buildCoords();
    const url = `${OSRM}${coords}?overview=full&geometries=geojson&steps=false&continue_straight=true`;
    console.log('[OSRM] GET', url.slice(0,140)+'...');
    const data = await fetchOSRM(url);
    const line = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(line) || !line.length) throw new Error('no route');
    // OSRMは [lng,lat]、このままLineStringで保存
    const gj = {
      type: 'Feature',
      properties: { source: 'osrm', generatedAt: new Date().toISOString() },
      geometry: { type: 'LineString', coordinates: line }
    };
    fs.mkdirSync('public', { recursive:true });
    fs.writeFileSync('public/route.geojson', JSON.stringify(gj, null, 2));
    console.log('✔ wrote public/route.geojson ('+line.length+' pts)');
  }catch(e){
    console.error('✖ failed:', e.message);
    process.exit(1);
  }
})();
