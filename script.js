import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

console.clear();

const loader = new GLTFLoader();
let head = (
  await loader.loadAsync(
    "https://threejs.org/examples/models/gltf/LeePerrySmith/LeePerrySmith.glb"
  )
).scene.children[0];

class DepthMap extends THREE.WebGLRenderTarget{
  constructor(){
    super(innerWidth, innerHeight);
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.depthTexture = new THREE.DepthTexture();
    this.depthTexture.format = THREE.DepthFormat;
    this.depthTexture.type = THREE.FloatType;
    
    this.camera = new THREE.OrthographicCamera(-5, 5, 5, -5, -5, 0);
    
    this.render();
  }
  
  render(){
    renderer.setRenderTarget(this);
    renderer.render(head, this.camera);
    renderer.setRenderTarget(null);
  }
  
  resize(){
    this.setSize(innerWidth, innerHeight);
  }
}

class DisplacedLines extends THREE.LineSegments{
  constructor(){
    super();
    
    let g = new THREE.PlaneGeometry(10, 10, 500, 175);
    this.ToQuads(g);
    
    this.depthMap = new DepthMap();
    this.uniforms = {
      displacementMap: {value: this.depthMap.depthTexture},
      displacementScale: {value:5},
      displacementBias: {value: 0}
    }
    let m = new THREE.LineBasicMaterial({
      onBeforeCompile: shader => {
        shader.uniforms = {
          ...shader.uniforms,
          ...this.uniforms
        };
        shader.vertexShader = `
          #include <normal_pars_vertex>
          uniform sampler2D displacementMap;
          uniform float displacementScale;
          uniform float displacementBias;
          ${shader.vertexShader}
        `.replace(
          `#include <project_vertex>`,
          `
          transformed += normalize( normal ) * ( (1. - texture2D( displacementMap, uv ).x) * displacementScale + displacementBias );
          
          #include <project_vertex>`
        );
      }
    });
    
    this.geometry = g;
    this.material = m;
  }
    
  ToQuads(g) {
    let p = g.parameters;
    let segmentsX = (g.type == "TorusBufferGeometry" ? p.tubularSegments : p.radialSegments) || p.widthSegments || p.thetaSegments || (p.points.length - 1) || 1;
    let segmentsY = (g.type == "TorusBufferGeometry" ? p.radialSegments : p.tubularSegments) || p.heightSegments || p.phiSegments || p.segments || 1;
    let indices = [];
    for (let i = 0; i < segmentsY + 1; i++) {
      let index11 = 0;
      let index12 = 0;
      for (let j = 0; j < segmentsX; j++) {
        index11 = (segmentsX + 1) * i + j;
        index12 = index11 + 1;
        let index21 = index11;
        let index22 = index11 + (segmentsX + 1);
        indices.push(index11, index12);
        if (index22 < ((segmentsX + 1) * (segmentsY + 1) - 1)) {
          //indices.push(index21, index22);
        }
      }
      if ((index12 + segmentsX + 1) <= ((segmentsX + 1) * (segmentsY + 1) - 1)) {
        //indices.push(index12, index12 + segmentsX + 1);
      }
    }
    g.setIndex(indices);
  }
    
}


let gu = {
  time: {
    value: 0
  },
  aspect: {
    value: innerWidth / innerHeight
  }
};
let dpr = Math.min(devicePixelRatio, 1);
let scene = new THREE.Scene();
//scene.background = new THREE.Color(0x444444);
let camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 1, 1000);
camera.position.set(0, -0.4, 1).setLength(10);
let renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth * dpr, innerHeight * dpr);
document.body.appendChild(renderer.domElement);

window.addEventListener("resize", (event) => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth * dpr, innerHeight * dpr);
  gu.aspect.value = camera.aspect;
});

let camShift = new THREE.Vector3(0, 0, 0);
camera.position.add(camShift);
let controls = new OrbitControls(camera, renderer.domElement);
controls.target.add(camShift);
controls.enableDamping = true;

let light = new THREE.DirectionalLight(0xffffff, Math.PI * 1.75);
light.position.set(0.5, 1, 1).setLength(50);
scene.add(light, new THREE.AmbientLight(0xffffff, Math.PI * 0.25));

// stuff

let dl = new DisplacedLines();
scene.add(dl);

////////

let clock = new THREE.Clock();
let t = 0;

renderer.setAnimationLoop(() => {
  let dt = clock.getDelta();
  t += dt;
  gu.time.value = t;
  controls.update();
  
  renderer.render(scene, camera);
});