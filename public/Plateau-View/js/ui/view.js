// js/ui/view.js
import { getPeople3D } from '../bus3d.js';

export function setGroundView(map){ map.easeTo({ pitch:85, bearing:map.getBearing(), zoom:Math.max(map.getZoom(),16), duration:600 }); }
export function setTopView(map){    map.easeTo({ pitch:0,  bearing:0,                duration:600 }); }
export function resetView(map){     map.easeTo({ center:[140.1036747,36.1113697], zoom:15, pitch:60, bearing:-20, duration:600 }); }

export function fitToCurrent(map){
  const routeSrc=map.getSource('route');
  let coords=null;
  if(routeSrc?.serialize){
    const fc=routeSrc.serialize()?.data;
    const f=fc?.features?.find?.(x=>x?.geometry?.type==='LineString');
    if(f) coords=f.geometry.coordinates;
  }
  if(Array.isArray(coords) && coords.length){
    let minLng=+Infinity,minLat=+Infinity,maxLng=-Infinity,maxLat=-Infinity;
    for(const [lng,lat] of coords){ if(lng<minLng)minLng=lng; if(lat<minLat)minLat=lat; if(lng>maxLng)maxLng=lng; if(lat>maxLat)maxLat=lat; }
    const padding={ top:80, bottom:240, left:30, right:30 };
    map.fitBounds([[minLng,minLat],[maxLng,maxLat]],{ padding, duration:700, maxZoom:17 });
    return;
  }
  const stopsSrc=map.getSource('stops-geojson');
  if(stopsSrc?.serialize){
    const pts=(stopsSrc.serialize()?.data?.features||[]).filter(f=>f?.geometry?.type==='Point');
    if(pts.length){
      let minLng=+Infinity,minLat=+Infinity,maxLng=-Infinity,maxLat=-Infinity;
      for(const f of pts){ const [lng,lat]=f.geometry.coordinates;
        if(lng<minLng)minLng=lng; if(lat<minLat)minLat=lat; if(lng>maxLng)maxLng=lng; if(lat>maxLat)maxLat=lat; }
      const padding={ top:80, bottom:240, left:30, right:30 };
      map.fitBounds([[minLng,minLat],[maxLng,maxLat]],{ padding, duration:700, maxZoom:17 });
      return;
    }
  }
  resetView(map);
}

export function jumpToFirstPerson(map){
  try{
    const bus=getPeople3D?.()||[];
    if(!bus.length){ map.easeTo({ zoom:Math.max(map.getZoom(),17), duration:400 }); return; }
    const p=bus[0]; map.easeTo({ center:[p.lng,p.lat], zoom:19, pitch:75, duration:600 });
  }catch(e){ console.warn('[jump] failed', e); }
}
