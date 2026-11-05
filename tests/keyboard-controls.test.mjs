import test from "node:test";
import assert from "node:assert/strict";
import {createKeyboardControls} from "../src/keyboard-controls.ts";
import {initial,defaults,updateWind} from "../src/simulation.ts";
const tick=(keys,state)=>updateWind(state,defaults,{x:0,z:0,...keys.step()},1/120);
test("short and repeated taps between frames each change one wind level",()=>{
 const keys=createKeyboardControls(),state=initial();
 for(let i=0;i<3;i++){keys.press("e");keys.release("e")}
 for(let i=0;i<20;i++)keys.read();
 for(let i=0;i<8;i++)tick(keys,state);
 assert.equal(state.windLevel,3);
 keys.press("e");for(let i=0;i<50;i++){keys.press("e",true);tick(keys,state)}
 assert.equal(state.windLevel,4);
 keys.release("e");tick(keys,state);keys.press("q");keys.release("q");tick(keys,state);tick(keys,state);
 assert.equal(state.windLevel,3);
});
test("clearing input removes queued actions and releases the previous button",()=>{
 const keys=createKeyboardControls(),state=initial();keys.press("e");tick(keys,state);
 keys.press("q");keys.release("q");keys.clear();keys.press("e");keys.release("e");
 for(let i=0;i<6;i++)tick(keys,state);
 assert.equal(state.windLevel,2);assert.equal(keys.keys.size,0);
});
test("opposing keyboard level buttons cancel while held together",()=>{
 const keys=createKeyboardControls(),state=initial();keys.press("e");keys.press("q");
 for(let i=0;i<20;i++)tick(keys,state);assert.equal(state.windLevel,0);
});
