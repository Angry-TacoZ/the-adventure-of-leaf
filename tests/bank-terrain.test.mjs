import {test} from 'node:test';import assert from 'node:assert/strict';import {createBankData,bankHeight} from '../src/bank-terrain.ts';
import { waterHalfWidth, waterLevel, channelHalfWidth, riverExtent } from '../src/journey.ts';
test('sloped banks use finite upward-facing triangles and cover the water edges',()=>{
 for(const side of [-1,1]){
  const b=createBankData(side);assert.ok(b.positions.every(Number.isFinite));assert.equal(b.indices.length%3,0);
  for(let i=0;i<b.indices.length;i+=3){const a=b.indices[i]*3,c=b.indices[i+1]*3,d=b.indices[i+2]*3;const ux=b.positions[c]-b.positions[a],uz=b.positions[c+2]-b.positions[a+2],vx=b.positions[d]-b.positions[a],vz=b.positions[d+2]-b.positions[a+2];assert.ok(uz*vx-ux*vz>0,'inverted or degenerate bank triangle');}
  for(let z=riverExtent.end;z<=20;z+=5){const level=waterLevel(z), shift=channelHalfWidth(z)-3.7;assert.ok(bankHeight(side*waterHalfWidth(z),z)-level>0.15);assert.ok(bankHeight(side*(4+shift),z)<level);assert.ok(bankHeight(side*(15+shift),z)>level+0.7);}
 }
});
