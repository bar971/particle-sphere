import { describe, expect, it } from 'vitest';
import { distributeOnSphere, latLngToCartesian, projectPoint, rotatePoint } from './sphereMath';

describe('sphere math',()=>{
  it('converte latitudine e longitudine',()=>{expect(latLngToCartesian({latitudeDeg:0,longitudeDeg:0})).toEqual([0,0,1]);expect(latLngToCartesian({latitudeDeg:90,longitudeDeg:0})[1]).toBeCloseTo(1)});
  it('distribuisce gli elementi in modo stabile',()=>{expect(distributeOnSphere(5)).toEqual(distributeOnSphere(5));expect(distributeOnSphere(5)).toHaveLength(5)});
  it('applica yaw e pitch',()=>{expect(rotatePoint([0,0,1],Math.PI/2,0)[0]).toBeCloseTo(1);expect(rotatePoint([0,1,0],0,Math.PI/2)[2]).toBeCloseTo(1)});
  it('occulta il retro e mantiene cliccabile il fronte',()=>{expect(projectPoint([0,0,1],1000,800).visible).toBe(true);expect(projectPoint([0,0,-1],1000,800).visible).toBe(false)});
});
