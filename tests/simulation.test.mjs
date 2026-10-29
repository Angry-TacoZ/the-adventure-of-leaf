import { test } from 'node:test'; import assert from 'node:assert/strict'; import {defaults,initial,step,surface,obstacle} from '../src/simulation.ts';
const neutral={x:0,z:0,raise:0,lower:0}; function run(s,seconds,dt,input=neutral){for(let t=0;t<seconds-1e-9;t+=dt)step(s,defaults,input,dt);return s}
test('current carries the leaf downstream and it remains near the surface',()=>{const s=run(initial(),4,1/120);assert.ok(s.z < -2);assert.ok(Math.abs(s.y-surface(s.x,s.z,s.time,defaults,s.intensity))<.15)});
test('wind changes motion and trigger intensity returns to natural conditions',()=>{const s=run(initial(),2,1/120,{x:1,z:0,raise:1,lower:0});assert.ok(s.x>.2 && s.intensity>.9);const before=s.intensity;run(s,2,1/120);assert.ok(s.intensity<before)});
test('obstacle rejects penetration',()=>{const s=initial();s.x=obstacle.x;s.z=obstacle.z+obstacle.r+.29;s.vz=-2;step(s,defaults,neutral,1/120);assert.ok(Math.hypot(s.x-obstacle.x,s.z-obstacle.z)>=obstacle.r+.28-1e-9);assert.ok(s.collision)});
test('simulation is stable across frame step sizes',()=>{const a=run(initial(),3,1/60),b=run(initial(),3,1/120);assert.ok(Math.abs(a.z-b.z)<.05);assert.ok(Math.abs(a.y-b.y)<.02)});
