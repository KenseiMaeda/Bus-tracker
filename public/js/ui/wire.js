// js/ui/wire.js
import { setForceServerPosition } from '../firebaseLive.js';

export function wireUi({ map, fitToCurrent, setGroundView, setTopView, resetView, jumpToFirstPerson }){
  document.getElementById('btn-fit')?.addEventListener('click', ()=>fitToCurrent(map));
  document.getElementById('btn-reset')?.addEventListener('click', ()=>resetView(map));
  document.getElementById('btn-ground')?.addEventListener('click', ()=>setGroundView(map));
  document.getElementById('btn-top')?.addEventListener('click', ()=>setTopView(map));
  document.getElementById('btn-jump-person')?.addEventListener('click', ()=>jumpToFirstPerson(map));

  const chk=document.getElementById('chk-server-pos');
  if(chk){ chk.checked=true; chk.addEventListener('change', (e)=>setForceServerPosition(e.target.checked)); }
}
