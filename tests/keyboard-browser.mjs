import {chromium} from "playwright";
import assert from "node:assert/strict";
const native=process.env.LEAF_OPTICS_NATIVE==="1";
const b=await chromium.launch(native?{channel:"chrome",headless:true}:{headless:true,args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
try{
 const p=await b.newPage({viewport:{width:640,height:360}}),errors=[];p.on("pageerror",e=>errors.push(e.message));
 await p.goto(`${process.env.LEAF_BASE_URL||"http://127.0.0.1:5200"}/?testMode=manual${native?"":"&forceWebGL"}`);
 await p.waitForFunction(()=>window.advanceTime);
 const read=()=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
 // All transitions occur in one JS task: no animation frame can sample a held key.
 await p.evaluate(()=>{window.dispatchEvent(new KeyboardEvent("keydown",{key:"e"}));window.dispatchEvent(new KeyboardEvent("keyup",{key:"e"}));for(let i=0;i<20;i++)window.render_game_to_text();window.advanceTime(50)});
 assert.equal((await read()).windLevel,1,"a complete tap between physics steps was lost");
 await p.evaluate(()=>{for(let i=0;i<2;i++){window.dispatchEvent(new KeyboardEvent("keydown",{key:"e"}));window.dispatchEvent(new KeyboardEvent("keyup",{key:"e"}))}window.advanceTime(50)});
 assert.equal((await read()).windLevel,3,"queued taps were merged");
 await p.keyboard.press("r");
 await p.evaluate(()=>{window.dispatchEvent(new KeyboardEvent("keydown",{key:"e"}));for(let i=0;i<10;i++)window.dispatchEvent(new KeyboardEvent("keydown",{key:"e",repeat:true}));window.dispatchEvent(new KeyboardEvent("keyup",{key:"e"}));window.advanceTime(100)});
 assert.equal((await read()).windLevel,1,"key repeat selected extra levels");
 await p.evaluate(()=>{window.dispatchEvent(new KeyboardEvent("keydown",{key:"e"}));window.dispatchEvent(new KeyboardEvent("keyup",{key:"e"}));window.dispatchEvent(new Event("blur"));window.advanceTime(50)});
 assert.equal((await read()).windLevel,1,"blur retained a queued action");
 await p.evaluate(()=>{window.dispatchEvent(new KeyboardEvent("keydown",{key:"e"}));window.dispatchEvent(new KeyboardEvent("keyup",{key:"e"}))});
 await p.keyboard.press("Escape");await p.getByRole("button",{name:"Resume journey",exact:true}).click();await p.evaluate(()=>window.advanceTime(50));
 assert.equal((await read()).windLevel,1,"menu retained a queued action");
 assert.deepEqual(errors,[]);console.log("Between-frame keyboard taps, snapshots, repeat, blur and menus passed");
}finally{await b.close()}
