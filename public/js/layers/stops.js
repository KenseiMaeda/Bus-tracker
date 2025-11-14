// js/layers/stops.js
import { STOPS_3D } from '../data.js';

export function ensureStopsLayer(map){
  const valid = STOPS_3D.filter(d=>d?.name && Number.isFinite(d.lat) && Number.isFinite(d.lng));
  if(!map.getSource('stops-geojson')){
    const fc={ type:'FeatureCollection', features: valid.map(d=>({
      type:'Feature', properties:{ name:d.name, hasBeacon:d.hasBeacon?1:0 }, geometry:{ type:'Point', coordinates:[d.lng,d.lat] }
    }))};
    map.addSource('stops-geojson',{ type:'geojson', data:fc });
  }
  if(!map.getLayer('stops-circle')){
    map.addLayer({ id:'stops-circle', type:'circle', source:'stops-geojson',
      paint:{ 'circle-radius':5,'circle-color':'#22C55E','circle-stroke-color':'#fff','circle-stroke-width':1.2 }});
  }
  if(!map.getLayer('stops-labels')){
    map.addLayer({ id:'stops-labels', type:'symbol', source:'stops-geojson',
      layout:{ 'text-field':['get','name'], 'text-size':12, 'text-allow-overlap':true, 'symbol-z-order':'source', 'text-anchor':'top','text-offset':[0,0.8]},
      paint:{ 'text-color':'#15803D','text-halo-color':'#fff','text-halo-width':0.9,'text-halo-blur':0.1 }});
  }
  const popup=new maplibregl.Popup({ closeButton:true, offset:10 });
  map.on('click', (e)=>{
    try{
      const feats=map.queryRenderedFeatures(e.point,{ layers:['stops-circle','stops-labels'] });
      if(feats && feats[0]){
        const f=feats[0]; const [lng,lat]=f.geometry.coordinates; const name=f.properties.name;
        popup.setLngLat([lng,lat]).setHTML(`🟢 <b>${name}</b><br/>バス停`).addTo(map);
      }
    }catch(err){ console.warn('[stops pick] skip', err); }
  });
}
