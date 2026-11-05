import {chromium} from "playwright";
import assert from "node:assert/strict";
import {writeFile} from "node:fs/promises";
const native = process.env.LEAF_OPTICS_NATIVE === "1";
const browser = await chromium.launch(native ? {channel:"chrome",headless:true} : {headless:true,args:["--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
try {
 const p=await browser.newPage({viewport:{width:1280,height:720}});p.setDefaultTimeout(60000);
 const errors=[],results=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 for(const z of [0,-140]){
  await p.goto(`${process.env.LEAF_BASE_URL||'http://127.0.0.1:5200'}/?testMode=manual&journeyZ=${z}&journeyX=2.7${native?'':'&forceWebGL'}`);
  await p.waitForFunction(()=>window.advanceTime);await p.evaluate(()=>window.advanceTime(500));
  await p.screenshot(); await p.evaluate(()=>window.advanceTime(0));
  const on=await p.screenshot({path:`output/web-game/whitewater-${native?'native':'webgl2'}-${z}.png`});
  await p.evaluate(()=>{window.setVerificationWhitewater(false);window.advanceTime(0)});
  const off=await p.screenshot({path:`output/web-game/whitewater-${native?'native':'webgl2'}-${z}-off.png`});
  const metrics=await p.evaluate(async([a,b])=>{
   const decode=async(data)=>{const i=new Image();i.src=`data:image/png;base64,${data}`;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);return ctx.getImageData(0,0,c.width,c.height)};
   const [on,off]=await Promise.all([decode(a),decode(b)]);let changed=0,bright=0;
   for(let y=330;y<on.height;y++)for(let x=60;x<on.width-60;x++){
    const j=(y*on.width+x)*4;const delta=on.data[j]+on.data[j+1]+on.data[j+2]-off.data[j]-off.data[j+1]-off.data[j+2];
    if(Math.abs(delta)>20)changed++;
    if(delta>20&&Math.min(on.data[j],on.data[j+1],on.data[j+2])>180)bright++;
   }return{changed,bright};
  },[on.toString('base64'),off.toString('base64')]);
  const state=JSON.parse(await p.evaluate(()=>window.render_game_to_text()));assert.equal(state.waterGrid.vertices,34151);
  if(z===0)assert.equal(metrics.changed,0,'whitewater leaked into calm headwaters');
  else assert.ok(metrics.changed>500&&metrics.bright>200,JSON.stringify(metrics));
  results.push({z,metrics,backend:state.renderer});
 }
 assert.deepEqual(errors,[]);await writeFile(`output/web-game/whitewater-${native?'native':'webgl2'}.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close()}
