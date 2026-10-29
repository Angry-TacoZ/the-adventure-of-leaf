export type Params = { current: number; variation: number; windStrength: number; windResponse: number; drag: number; buoyancy: number; alignment: number; turbulence: number; ripple: number; damping: number; cameraDistance: number; cameraHeight: number; cameraAngle: number; cameraSmoothing: number; quality: number; deadzone: number; windCurve: number };
export const defaults: Params = { current: 1.15, variation: .22, windStrength: .8, windResponse: 1.5, drag: 1.8, buoyancy: 8, alignment: 4, turbulence: .12, ripple: .11, damping: .7, cameraDistance: 7.5, cameraHeight: 4.5, cameraAngle: 1, cameraSmoothing: 3, quality: 1, deadzone: .16, windCurve: 1 };
export type State = { x:number; y:number; z:number; vx:number; vy:number; vz:number; windX:number; windZ:number; intensity:number; time:number; collision:boolean };
export const initial = (): State => ({x:0,y:.1,z:0,vx:0,vy:0,vz:0,windX:0,windZ:0,intensity:0,time:0,collision:false});
export const obstacle = {x:.25,z:-9,r:1.05};
export function surface(x:number,z:number,t:number,p:Params, intensity:number) {
 const a=p.ripple*(1+intensity*.55); const waves=a*(Math.sin(z*1.5+t*2.1+x*.5)*.55+Math.sin(x*2.2-z*.6+t*1.3)*.3+Math.sin(z*3.1+x*1.3+t*3)*.15)*p.damping; const distance=Math.hypot(x-obstacle.x,z-obstacle.z); const eddy=p.turbulence*.12*Math.sin(distance*5-t*3)*Math.exp(-Math.max(0,distance-obstacle.r)*1.8); return waves+eddy;
}
export function current(x:number,z:number,t:number,p:Params) { return Math.max(.15,p.current*(1+p.variation*Math.sin(z*.31+t*.37)+p.turbulence*.25*Math.sin(x*3+t))); }
export function step(s:State, p:Params, input:{x:number;z:number;raise:number;lower:number},dt:number) {
 s.time+=dt; const k=1-Math.exp(-p.windResponse*dt); const magnitude=Math.min(1,Math.hypot(input.x,input.z));
 s.intensity=Math.max(0,Math.min(1,s.intensity+(input.raise-input.lower)*dt*.6)); if(!input.raise&&!input.lower) s.intensity*=Math.exp(-dt*.32);
 s.windX+=(input.x*(magnitude?1:0)-s.windX)*k; s.windZ+=(input.z*(magnitude?1:0)-s.windZ)*k;
 const speed=current(s.x,s.z,s.time,p); const wind=p.windStrength*s.intensity; const targetX=s.windX*wind + p.turbulence*.15*Math.sin(s.time*2+s.z); const targetZ=Math.min(-.15,-speed+s.windZ*wind);
 const drag=1-Math.exp(-p.drag*dt); s.vx+=(targetX-s.vx)*drag; s.vz+=(targetZ-s.vz)*drag; s.x+=s.vx*dt; s.z+=s.vz*dt;
 s.x=Math.max(-3.65,Math.min(3.65,s.x)); if(Math.abs(s.x)>=3.65) s.vx*=.1;
 s.collision=false; const dx=s.x-obstacle.x,dz=s.z-obstacle.z,dist=Math.hypot(dx,dz); if(dist<obstacle.r+.28){const nx=dist?dx/dist:1,nz=dist?dz/dist:0; s.x=obstacle.x+nx*(obstacle.r+.28); s.z=obstacle.z+nz*(obstacle.r+.28); const dot=s.vx*nx+s.vz*nz; if(dot<0){s.vx-=dot*nx*1.15;s.vz-=dot*nz*1.15;} s.collision=true;}
 if(s.z < -27){s.z=-27;s.vz=0;}
 const targetY=surface(s.x,s.z,s.time,p,s.intensity)+.05; s.vy+=(targetY-s.y)*p.buoyancy*dt; s.vy*=Math.exp(-3*dt); s.y+=s.vy*dt;
}
