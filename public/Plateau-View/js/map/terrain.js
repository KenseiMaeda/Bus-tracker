// js/map/terrain.js
import { MAPTILER_KEY } from '../config.js';

export function enableTerrain(map){
  try{
    if(!map.getSource('terrain-dem')){
      map.addSource('terrain-dem',{
        type:'raster-dem',
        url:`https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=${MAPTILER_KEY}`,
        tileSize:256,
        encoding:'mapbox'
      });
    }
    map.setTerrain({ source:'terrain-dem', exaggeration:1.6 });
  }catch(e){ console.warn('[terrain] skip', e); }
}
