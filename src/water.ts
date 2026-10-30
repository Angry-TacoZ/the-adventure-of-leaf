import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { Refractor } from "three/addons/objects/Refractor.js";

// Scene captures are supplied by Three.js's MIT-licensed planar helpers.
// The displaced geometry and its normals still come from the shared CPU surface.
export function createRiverWater(geometry: THREE.BufferGeometry) {
  const options = { textureWidth: 512, textureHeight: 512, clipBias: 0.003 };
  const reflection = new Reflector(geometry, options);
  const refraction = new Refractor(geometry, options);
  const reflected = reflection.material as THREE.ShaderMaterial;
  const refracted = refraction.material as THREE.ShaderMaterial;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      reflectionMap: { value: reflection.getRenderTarget().texture },
      refractionMap: { value: refraction.getRenderTarget().texture },
      reflectionMatrix: reflected.uniforms.textureMatrix,
      refractionMatrix: refracted.uniforms.textureMatrix,
      reflectionWeight: { value: 1 },
      refractionWeight: { value: 1 },
    },
    vertexShader: `varying vec3 worldPoint; varying vec3 worldNormal; varying vec3 localPoint;
  void main(){localPoint=position;worldPoint=(modelMatrix*vec4(position,1.)).xyz;worldNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*vec4(worldPoint,1.);}`,
    fragmentShader: `uniform sampler2D reflectionMap; uniform sampler2D refractionMap;
  uniform mat4 reflectionMatrix; uniform mat4 refractionMatrix;
  uniform float reflectionWeight; uniform float refractionWeight;
  varying vec3 worldPoint; varying vec3 worldNormal; varying vec3 localPoint;
  vec2 projected(vec4 p){return p.xy/p.w;}
  float edgeFade(vec2 uv){return smoothstep(0.,.02,uv.x)*smoothstep(0.,.02,uv.y)*smoothstep(0.,.02,1.-uv.x)*smoothstep(0.,.02,1.-uv.y);}
  void main(){
   vec3 N=normalize(worldNormal);vec3 eye=normalize(cameraPosition-worldPoint);
   float fresnel=.02037+.97963*pow(1.-max(dot(N,eye),0.),5.);
   vec3 ray=refract(-eye,N,1./1.333);
   // Shallow riverbed approximation: bend the viewing ray to the existing bed.
   float distanceToBed=max(0.,worldPoint.y+.41)/max(.08,-ray.y);
   vec3 bedPoint=worldPoint+ray*distanceToBed;
   vec3 bedLocal=vec3(bedPoint.x,-bedPoint.z,bedPoint.y);
   vec2 refractedUV=projected(refractionMatrix*vec4(bedLocal,1.));
   vec2 reflectedUV=projected(reflectionMatrix*vec4(localPoint,1.))+N.xz*.025;
   vec3 above=texture2D(reflectionMap,clamp(reflectedUV,vec2(.001),vec2(.999))).rgb;
   vec2 originalUV=projected(refractionMatrix*vec4(localPoint,1.));
   vec3 undistorted=texture2D(refractionMap,clamp(originalUV,vec2(.001),vec2(.999))).rgb;
   vec3 below=mix(undistorted,texture2D(refractionMap,clamp(refractedUV,vec2(.001),vec2(.999))).rgb,edgeFade(refractedUV));
   vec3 tint=vec3(.12,.31,.29);
   below=mix(tint,below,refractionWeight)*vec3(.72,.93,.9);
   above=mix(tint,above,reflectionWeight*edgeFade(reflectedUV));
   gl_FragColor=vec4(mix(below,above,fresnel),1.);
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  let refractionExcluded: THREE.Object3D | undefined;
  let captures = 0;
  let captureSize = 512;
  mesh.onBeforeRender = (renderer, scene, camera, g, m, group) => {
    mesh.visible = false;
    try {
      reflection.matrixWorld.copy(mesh.matrixWorld);
      refraction.matrixWorld.copy(mesh.matrixWorld);
      reflection.onBeforeRender(renderer, scene, camera, g, reflected, group);
      const wasVisible = refractionExcluded?.visible;
      if (refractionExcluded) refractionExcluded.visible = false;
      try {
        refraction.onBeforeRender(renderer, scene, camera, g, refracted, group);
      } finally {
        if (refractionExcluded && wasVisible !== undefined)
          refractionExcluded.visible = wasVisible;
      }
      captures++;
    } finally {
      mesh.visible = true;
    }
  };
  return {
    mesh,
    material,
    excludeFromRefraction: (object: THREE.Object3D) => {
      refractionExcluded = object;
    },
    setQuality: (quality: number) => {
      const size = Math.round(512 * Math.min(1, Math.max(0.25, quality)));
      if (size !== captureSize) {
        reflection.getRenderTarget().setSize(size, size);
        refraction.getRenderTarget().setSize(size, size);
        captureSize = size;
      }
    },
    diagnostics: () => ({
      mode: "planar-reflection-and-snells-refraction",
      captures,
      size: captureSize,
    }),
  };
}
