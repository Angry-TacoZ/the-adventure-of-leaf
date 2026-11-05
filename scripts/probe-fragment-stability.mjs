// Diagnostic only: does not alter gameplay or clamp engine velocities.
import {chromium} from "playwright";
import {mkdir,writeFile} from "node:fs/promises";
const browser=await chromium.launch({channel:"chrome",headless:true});
await mkdir("output",{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:640,height:360}});
 await page.goto(`${process.env.LEAF_BASE_URL||"http://127.0.0.1:5200"}/?testMode=manual`);
 await page.waitForFunction(()=>window.advanceTime);
 const results=await page.evaluate(async()=>{
  const R=await import("/node_modules/@dimforge/rapier3d/rapier.js");
  const {createRiverLeaf}=await import("/src/river-leaf.ts");
  const {initial,defaults,updateWind}=await import("/src/simulation.ts");
  const {waterLevel}=await import("/src/journey.ts");
  const cases=[];
  for(const [distance,isolate] of [[0,false],[200,false],[500,false],[500,true]]){
   const owner=await createRiverLeaf(),state={...initial(),x:2.7,y:0,z:0};
   const params={...defaults,current:0,variation:0,turbulence:0,ripple:0},neutral={x:0,z:0,raise:0,lower:0};
   let clone;
   try{
    owner.reset(state);
    for(let i=0;i<240;i++){updateWind(state,params,neutral,1/120);owner.step(state,params)}
    owner.forceTear();const small=[...owner.world.softBodies.getAll()].sort((a,b)=>a.numParticles()-b.numParticles())[0];
    for(let i=0;i<small.numParticles();i++){const p=small.particlePosition(i);p.z-=distance;p.y+=waterLevel(-distance);small.setParticlePosition(i,p)}
    let body=small,origin={...owner.diagnostics().origin};
    if(isolate){
     clone=R.World.restoreSnapshot(owner.world.takeSnapshot());body=clone.getSoftBody(small.handle);
     for(const other of clone.softBodies.getAll())if(other.handle!==body.handle)clone.removeSoftBody(other);
     const p=body.particlePosition(0),dx=Math.round(p.x),dz=Math.round(p.z);origin.x+=dx;origin.z+=dz;
     for(let i=0;i<body.numParticles();i++){const p=body.particlePosition(i);p.x-=dx;p.z-=dz;body.setParticlePosition(i,p)}
     clone.forEachRigidBody(b=>{if(b.isSoftFrame())return;const p=b.translation();p.x-=dx;p.z-=dz;b.setTranslation(p,false);if(b.isKinematic())b.setNextKinematicTranslation(p)});
     clone.forEachCollider(c=>{if(c.softBody()!==null||c.parent())return;const p=c.translation();p.x-=dx;p.z-=dz;c.setTranslation(p)});
    }
    let maxSpeed=0;
    for(let i=0;i<2400;i++){
     if(clone){
      // Isolated proof uses only flat-water buoyancy/drag, not gameplay acceptance.
      body.resetForces(true);
      for(let j=0;j<body.numParticles();j++){const p=body.particlePosition(j),v=body.particleVelocity(j),m=body.particleMass(j),wet=Math.max(0,Math.min(1,(waterLevel(-distance)-p.y+.02)/.04));body.addParticleForce(j,{x:-m*v.x*params.drag*wet,y:m*(19.62*wet-6*v.y*wet),z:m*(-.15-v.z)*params.drag*wet},true)}
      clone.step();
     }else{updateWind(state,params,neutral,1/120);owner.step(state,params);origin={...owner.diagnostics().origin}}
     for(let j=0;j<body.numParticles();j++){const v=body.particleVelocity(j);maxSpeed=Math.max(maxSpeed,Math.hypot(v.x,v.y,v.z))}
    }
    const p=body.centerOfMass();cases.push({distance,isolate,maxSpeed,centroid:{x:p.x+origin.x,y:p.y,z:p.z+origin.z},velocity:body.particleVelocity(0),finite:body.particlePositions().every(Number.isFinite)});
   }finally{clone?.free();owner.dispose()}
  }
  const geometryOwner=await createRiverLeaf();geometryOwner.reset({x:0,y:0,z:0});
  const geometry=geometryOwner.readFrame().fragments[0];
  const vertices=geometry.positions.slice(),indices=geometry.indices.slice();geometryOwner.dispose();
  for(const z of [0,-500]){
   const world=new R.World({x:0,y:0,z:0});world.timestep=1/120;
   try{const desc=R.SoftBodyDesc.trimesh(vertices,indices);const body=world.createSoftBody(desc.setMass(.002).setTranslation({x:0,y:0,z}).setMaterial(R.SoftBodyMaterial.uniform(30,1)).setLinearDamping(.02));
    const start=body.centerOfMass();for(let i=0;i<2400;i++)world.step();
    cases.push({zeroForce:true,z,start,end:body.centerOfMass(),velocity:body.particleVelocity(0)});
   }finally{world.free()}
  }
  return cases;
 });
 await writeFile("output/fragment-stability-probe.json",JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close()}
