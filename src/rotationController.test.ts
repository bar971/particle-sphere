import { describe, expect, it } from 'vitest';
import { RotationController } from './rotationController';

describe('RotationController',()=>{
  it('decelera in selezione e riprende dopo la chiusura',()=>{const r=new RotationController(20,true,false);r.select(true,0);expect(r.update(.25,250).speed).toBe(0);r.select(false,250);expect(r.update(.1,500).speed).toBe(0);expect(r.update(.5,1300).speed).toBe(1)});
  it('limita il pitch durante il drag',()=>{const r=new RotationController();r.startDrag();r.drag(20,10000);expect(r.pitch).toBeCloseTo(Math.PI/3);r.endDrag()});
  it('non ruota con movimento ridotto',()=>{const r=new RotationController(20,true,true);const before=r.yaw;r.update(1,1000);expect(r.yaw).toBe(before)});
});
