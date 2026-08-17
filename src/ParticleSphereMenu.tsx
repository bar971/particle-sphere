import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createParticleSphereRenderer, type ParticleSphereRenderer } from './webgpu-core';
import { distributeOnSphere, latLngToCartesian, projectPoint, rotatePoint } from './sphereMath';
import { RotationController } from './rotationController';

export interface SphereMenuItem { id:string; title:string; summary:string; href:string; icon?:React.ReactNode; accentColor?:string; position?:{latitudeDeg:number;longitudeDeg:number}; target?:'_self'|'_blank' }
export interface ParticleSphereMenuProps { items:SphereMenuItem[]; autoRotate?:boolean; rotationPeriodSeconds?:number; onNavigate?:(item:SphereMenuItem,event:React.MouseEvent<HTMLAnchorElement>)=>void; debugControls?:boolean; ariaLabel?:string; className?:string }

export function ParticleSphereMenu({ items, autoRotate=true, rotationPeriodSeconds=20, onNavigate, debugControls=false, ariaLabel='Navigazione principale', className='' }:ParticleSphereMenuProps) {
  const stageRef=useRef<HTMLDivElement>(null), canvasRef=useRef<HTMLCanvasElement>(null), beaconRefs=useRef(new Map<string,HTMLAnchorElement>()), cardRef=useRef<HTMLElement>(null), lineRef=useRef<SVGLineElement>(null);
  const [selected,setSelected]=useState<SphereMenuItem|null>(null), [menuOpen,setMenuOpen]=useState(false), [gpu,setGpu]=useState<'loading'|'ready'|'fallback'>('loading'), [settingsOpen,setSettingsOpen]=useState(false);
  const rendererRef=useRef<ParticleSphereRenderer|null>(null), secretTimer=useRef<number|undefined>(undefined);
  const [visuals,setVisuals]=useState({particleCount:40000,lineCount:40,trailCount:16,spriteSize:.018});
  const selectedRef=useRef<SphereMenuItem|null>(null); selectedRef.current=selected;
  const positions=useMemo(()=>{ const automatic=distributeOnSphere(items.filter(i=>!i.position).length); let a=0; return new Map(items.map(i=>[i.id,latLngToCartesian(i.position??automatic[a++],1.04)])); },[items]);
  const movement=useRef({id:-1,x:0,y:0,lastX:0,lastY:0,moved:false});

  useEffect(()=>{
    let raf=0, renderer:ParticleSphereRenderer|undefined, disposed=false, previous=performance.now();
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rotation=new RotationController(rotationPeriodSeconds,autoRotate,reduced);
    const canvas=canvasRef.current!, stage=stageRef.current!;
    createParticleSphereRenderer(canvas).then(r=>{if(disposed)r.destroy();else{renderer=rendererRef.current=r;setGpu('ready')}}).catch(()=>!disposed&&setGpu('fallback'));
    const tick=(now:number)=>{
      const dt=Math.min(.05,(now-previous)/1000); previous=now; rotation.select(Boolean(selectedRef.current),now); const orientation=rotation.update(dt,now); renderer?.render({time:now/1000,...orientation});
      const rect=stage.getBoundingClientRect();
      for(const item of items){const el=beaconRefs.current.get(item.id);if(!el)continue;const p=projectPoint(rotatePoint(positions.get(item.id)!,orientation.yaw,orientation.pitch),rect.width,rect.height);el.style.transform=`translate3d(${p.x}px,${p.y}px,0) translate(-50%,-50%) scale(${p.visible?p.scale:.68})`;el.style.opacity=p.visible?String(.35+.65*p.edge):'.14';el.style.pointerEvents=p.visible?'auto':'none';el.tabIndex=p.visible?0:-1;el.dataset.occluded=String(!p.visible);el.setAttribute('aria-hidden',String(!p.visible));}
      const active=selectedRef.current, line=lineRef.current, card=cardRef.current;
      if(active&&line&&card){const b=beaconRefs.current.get(active.id)?.getBoundingClientRect(),c=card.getBoundingClientRect(),s=stage.getBoundingClientRect();if(b){line.setAttribute('x1',String(b.left+b.width/2-s.left));line.setAttribute('y1',String(b.top+b.height/2-s.top));line.setAttribute('x2',String(c.left+c.width/2-s.left));line.setAttribute('y2',String(c.top+c.height/2-s.top));}}
      raf=requestAnimationFrame(tick);
    }; raf=requestAnimationFrame(tick);
    const down=(e:PointerEvent)=>{if((e.target as HTMLElement).closest('a,button,.detail-card'))return;movement.current={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};stage.setPointerCapture(e.pointerId);rotation.startDrag()};
    const move=(e:PointerEvent)=>{const m=movement.current;if(m.id!==e.pointerId)return;const dx=e.clientX-m.lastX,dy=e.clientY-m.lastY;m.lastX=e.clientX;m.lastY=e.clientY;if(Math.hypot(e.clientX-m.x,e.clientY-m.y)>7)m.moved=true;rotation.drag(dx,dy)};
    const up=(e:PointerEvent)=>{if(movement.current.id===e.pointerId){rotation.endDrag();movement.current.id=-1}};
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setSelected(null);setMenuOpen(false);setSettingsOpen(false)}if(debugControls&&e.key.toLowerCase()==='h')setSettingsOpen(value=>!value)};
    stage.addEventListener('pointerdown',down);stage.addEventListener('pointermove',move);stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',up);window.addEventListener('keydown',key);
    return()=>{disposed=true;cancelAnimationFrame(raf);window.clearTimeout(secretTimer.current);renderer?.destroy();rendererRef.current=null;stage.removeEventListener('pointerdown',down);stage.removeEventListener('pointermove',move);stage.removeEventListener('pointerup',up);stage.removeEventListener('pointercancel',up);window.removeEventListener('keydown',key)};
  },[items,positions,autoRotate,rotationPeriodSeconds,debugControls]);
  const choose=(item:SphereMenuItem,e?:React.SyntheticEvent)=>{e?.preventDefault();setSelected(item);setMenuOpen(false)};
  const updateVisual=(key:keyof typeof visuals,value:number)=>{const next={...visuals,[key]:value};setVisuals(next);rendererRef.current?.configure({[key]:value})};
  const startSecretPress=()=>{if(!debugControls)return;secretTimer.current=window.setTimeout(()=>setSettingsOpen(true),800)};
  const cancelSecretPress=()=>window.clearTimeout(secretTimer.current);
  return <section ref={stageRef} className={`sphere-menu ${className}`} aria-label={ariaLabel} onClick={e=>{if(e.target===e.currentTarget)setSelected(null)}}>
    <canvas ref={canvasRef} className="sphere-canvas" aria-hidden="true" />
    <div className="ambient" aria-hidden="true" />
    <header className="hero-copy"><button className="eyebrow secret-trigger" aria-label="Portfolio 2026" onDoubleClick={()=>debugControls&&setSettingsOpen(true)} onPointerDown={startSecretPress} onPointerUp={cancelSecretPress} onPointerCancel={cancelSecretPress} onPointerLeave={cancelSecretPress}>PORTFOLIO / 2026</button><h1>Idee in<br/><em>orbita.</em></h1><p>Trascina la sfera. Tocca un segnale.<br/>Scopri cosa c’è dall’altra parte.</p></header>
    <button className="menu-toggle" aria-expanded={menuOpen} onClick={()=>setMenuOpen(v=>!v)}><span>Menu</span><b>{String(items.length).padStart(2,'0')}</b></button>
    {gpu==='fallback'&&<div className="fallback-note"><span>Modalità essenziale</span><p>La tua rotta resta aperta anche senza WebGPU.</p></div>}
    <nav className="beacons" aria-label={ariaLabel}>{gpu!=='fallback'&&items.map((item,index)=><a key={item.id} ref={el=>{el?beaconRefs.current.set(item.id,el):beaconRefs.current.delete(item.id)}} href={item.href} target={item.target} className={`beacon ${selected?.id===item.id?'active':''}`} style={{'--accent':item.accentColor??'#7df9ff'} as React.CSSProperties} onClick={e=>choose(item,e)} onKeyDown={e=>{if(e.key===' '){e.preventDefault();choose(item,e)}}}><i>{item.icon??String(index+1).padStart(2,'0')}</i><span>{item.title}</span></a>)}</nav>
    <svg className={`connector ${selected?'visible':''}`}><line ref={lineRef}/></svg>
    {selected&&<aside ref={cardRef} className="detail-card" style={{'--accent':selected.accentColor??'#7df9ff'} as React.CSSProperties} aria-live="polite"><button className="close" aria-label="Chiudi" onClick={()=>setSelected(null)}>×</button><span className="card-index">SEGNALE / {String(items.indexOf(selected)+1).padStart(2,'0')}</span><div className="card-icon">{selected.icon}</div><h2>{selected.title}</h2><p>{selected.summary}</p><a className="explore" href={selected.href} target={selected.target} onClick={e=>onNavigate?.(selected,e)}>Esplora <span>↗</span></a></aside>}
    <nav className={`all-menu ${menuOpen||gpu==='fallback'?'open':''}`} aria-label="Tutte le destinazioni"><div className="all-menu-head"><span>Destinazioni</span><button onClick={()=>setMenuOpen(false)} aria-label="Chiudi menu">×</button></div><ol>{items.map((item,i)=><li key={item.id}><a href={item.href} target={item.target} onClick={e=>onNavigate?.(item,e)}><b>{String(i+1).padStart(2,'0')}</b><span>{item.title}<small>{item.summary}</small></span><i>↗</i></a></li>)}</ol></nav>
    <div className="mobile-dock" aria-label="Destinazioni rapide">{items.map(item=><button key={item.id} onClick={()=>setSelected(item)} aria-label={`Apri ${item.title}`} className={selected?.id===item.id?'active':''}><span>{item.icon}</span><small>{item.title}</small></button>)}</div>
    {debugControls&&settingsOpen&&<aside className="settings-panel" aria-label="Impostazioni WebGPU"><div className="settings-head"><span>Controlli WebGPU</span><button aria-label="Chiudi impostazioni" onClick={()=>setSettingsOpen(false)}>×</button></div><label>Particelle <output>{Math.round(visuals.particleCount/1000)}k</output><input type="range" min="5000" max="100000" step="5000" value={visuals.particleCount} onChange={e=>updateVisual('particleCount',+e.target.value)}/></label><label>Linee <output>{visuals.lineCount}</output><input type="range" min="0" max="80" step="1" value={visuals.lineCount} onChange={e=>updateVisual('lineCount',+e.target.value)}/></label><label>Scie <output>{visuals.trailCount}</output><input type="range" min="0" max="60" step="1" value={visuals.trailCount} onChange={e=>updateVisual('trailCount',+e.target.value)}/></label><label>Dimensione <output>{visuals.spriteSize.toFixed(3)}</output><input type="range" min="0.006" max="0.04" step="0.001" value={visuals.spriteSize} onChange={e=>updateVisual('spriteSize',+e.target.value)}/></label><button className="settings-reset" onClick={()=>{const defaults={particleCount:40000,lineCount:40,trailCount:16,spriteSize:.018};setVisuals(defaults);rendererRef.current?.configure(defaults)}}>Ripristina</button><small>WebGPU: {gpu} · doppio click o pressione lunga</small></aside>}
  </section>;
}
