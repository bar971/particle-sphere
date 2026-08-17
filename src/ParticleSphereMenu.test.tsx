import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ParticleSphereMenu, type SphereMenuItem } from './ParticleSphereMenu';

vi.mock('./webgpu-core',()=>({createParticleSphereRenderer:vi.fn().mockRejectedValue(new Error('no gpu'))}));
const items:SphereMenuItem[]=[{id:'lab',title:'Lab',summary:'Esperimenti',href:'/lab',icon:'◌'},{id:'note',title:'Note',summary:'Appunti',href:'/note'}];
describe('ParticleSphereMenu',()=>{
  beforeEach(()=>{vi.stubGlobal('requestAnimationFrame',vi.fn(()=>1));vi.stubGlobal('cancelAnimationFrame',vi.fn())});
  it('offre sempre il menu semantico e link standard',async()=>{render(<ParticleSphereMenu items={items}/>);fireEvent.click(screen.getByRole('button',{name:/^menu/i}));expect(screen.getByRole('navigation',{name:'Tutte le destinazioni'}).querySelector('a')).toHaveAttribute('href','/lab')});
  it('apre da dock mobile e chiude con pulsante o Escape',()=>{render(<ParticleSphereMenu items={items}/>);fireEvent.click(screen.getByRole('button',{name:'Apri Lab'}));expect(screen.getByRole('heading',{name:'Lab'})).toBeVisible();fireEvent.keyDown(window,{key:'Escape'});expect(screen.queryByRole('heading',{name:'Lab'})).not.toBeInTheDocument()});
  it('inoltra la navigazione dalla CTA',()=>{const onNavigate=vi.fn((_item,event)=>event.preventDefault());render(<ParticleSphereMenu items={items} onNavigate={onNavigate}/>);fireEvent.click(screen.getByRole('button',{name:'Apri Lab'}));fireEvent.click(screen.getByRole('link',{name:/Esplora/i}));expect(onNavigate).toHaveBeenCalledWith(items[0],expect.anything())});
  it('apre le impostazioni col gesto segreto solo quando abilitate',()=>{const {rerender}=render(<ParticleSphereMenu items={items} debugControls/>);fireEvent.doubleClick(screen.getByRole('button',{name:'Portfolio 2026'}));expect(screen.getByRole('complementary',{name:'Impostazioni WebGPU'})).toBeVisible();rerender(<ParticleSphereMenu items={items} debugControls={false}/>);expect(screen.queryByRole('complementary',{name:'Impostazioni WebGPU'})).not.toBeInTheDocument()});
  it('mantiene i beacon posteriori visibili ma non interattivi',()=>{render(<ParticleSphereMenu items={items}/>);const beacon=screen.getByRole('navigation',{name:'Navigazione principale'}).querySelector<HTMLAnchorElement>('.beacon')!;beacon.dataset.occluded='true';beacon.style.opacity='.14';beacon.style.pointerEvents='none';beacon.tabIndex=-1;expect(beacon).toHaveStyle({opacity:'.14',pointerEvents:'none'});expect(beacon).toHaveAttribute('tabindex','-1')});
});
