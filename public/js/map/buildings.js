// js/map/buildings.js
export function enableBuildings(map){
  try{
    const srcs=map.getStyle().sources || {};
    if(srcs['openmaptiles'] && !map.getLayer('3d-buildings')){
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
