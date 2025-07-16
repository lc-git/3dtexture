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

// 记录当前head对象，便于后续替换
let currentHead = head;

// 监听显示完整模型线框复选框
const showWireframeCheckbox = document.getElementById('show-wireframe');
let wireframeGroup = null; // 移到这里
if (showWireframeCheckbox) {
  showWireframeCheckbox.addEventListener('change', () => {
    if (showWireframeCheckbox.checked) {
      // 显示完整模型线框，隐藏平面效果
      if (wireframeGroup) {
        scene.add(wireframeGroup);
      }
      if (window.dl) {
        window.dl.visible = false;
      }
    } else {
      // 隐藏线框，显示平面效果
      if (wireframeGroup) {
        scene.remove(wireframeGroup);
      }
      if (window.dl) {
        window.dl.visible = true;
      }
    }
  });
}

// 监听线条颜色选择器
const lineColorInput = document.getElementById('line-color');
if (lineColorInput) {
  lineColorInput.addEventListener('input', (e) => {
    const color = new THREE.Color(e.target.value);
    // 更新平面线条颜色
    if (window.dl && window.dl.material) {
      window.dl.material.color.copy(color);
    }
    // 更新线框颜色
    if (wireframeGroup) {
      wireframeGroup.children.forEach(wireframe => {
        if (wireframe.material && wireframe.material.uniforms && wireframe.material.uniforms.uColor) {
          wireframe.material.uniforms.uColor.value.copy(color);
        }
      });
    }
  });
}

// 监听导出PNG按钮
const exportPngButton = document.getElementById('export-png');
if (exportPngButton) {
  exportPngButton.addEventListener('click', () => {
    // 临时切换到透明背景用于导出
    renderer.setClearColor(0x000000, 0);
    
    // 确保渲染一次最新画面
    renderer.render(scene, camera);
    
    // 将canvas内容转为数据URL
    const dataURL = renderer.domElement.toDataURL('image/png');
    
    // 恢复黑色背景用于展示
    renderer.setClearColor(0x000000, 1);
    
    // 创建下载链接
    const link = document.createElement('a');
    link.download = `3dtexture_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
    link.href = dataURL;
    
    // 触发下载
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}

// 监听文件上传
const uploadInput = document.getElementById('glb-upload');
if (uploadInput) {
  uploadInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      const gltf = await loader.loadAsync(url);
      // 只取第一个子对象
      const newHead = gltf.scene.children[0];
      // 自动居中和缩放
      const box = new THREE.Box3().setFromObject(newHead);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = maxDim > 0 ? 9 / maxDim : 1; // 目标最大尺寸为9
      newHead.scale.setScalar(scale);
      // 再次计算缩放后的包围盒，居中
      const box2 = new THREE.Box3().setFromObject(newHead);
      const center = new THREE.Vector3();
      box2.getCenter(center);
      newHead.position.sub(center); // 平移到原点
      // 生成完整模型线框
      if (wireframeGroup) scene.remove(wireframeGroup);
      wireframeGroup = new THREE.Group();
      
      gltf.scene.traverse((child) => {
        if (child.isMesh) {
          const lineMaterial = new THREE.ShaderMaterial({
            uniforms: {
              uColor: { value: new THREE.Color(lineColorInput ? lineColorInput.value : '#ffffff') },
              uLineDensity: { value: 70.0 } // 调整此值可改变线条密度
            },
            vertexShader: `
              varying vec3 vWorldPosition;
              void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * viewMatrix * worldPosition;
              }
            `,
            fragmentShader: `
              uniform vec3 uColor;
              uniform float uLineDensity;
              varying vec3 vWorldPosition;
              void main() {
                if (fract(vWorldPosition.y * uLineDensity) > 0.5) {
                  discard;
                }
                gl_FragColor = vec4(uColor, 1.0);
              }
            `
          });
          const meshWithLines = new THREE.Mesh(child.geometry, lineMaterial);
          
          // 应用子对象的变换
          meshWithLines.position.copy(child.position);
          meshWithLines.rotation.copy(child.rotation);
          meshWithLines.scale.copy(child.scale);
          
          wireframeGroup.add(meshWithLines);
        }
      });
      
      // 对整个线框组应用缩放和居中
      const wireframeBox = new THREE.Box3().setFromObject(wireframeGroup);
      const wireframeSize = new THREE.Vector3();
      wireframeBox.getSize(wireframeSize);
      const wireframeMaxDim = Math.max(wireframeSize.x, wireframeSize.y, wireframeSize.z);
      const wireframeScale = wireframeMaxDim > 0 ? 9 / wireframeMaxDim : 1;
      wireframeGroup.scale.setScalar(wireframeScale);
      
      // 居中线框组
      const wireframeBox2 = new THREE.Box3().setFromObject(wireframeGroup);
      const wireframeCenter = new THREE.Vector3();
      wireframeBox2.getCenter(wireframeCenter);
      wireframeGroup.position.sub(wireframeCenter);
      
      // 根据复选框状态决定显示模式
      if (showWireframeCheckbox && showWireframeCheckbox.checked) {
        scene.add(wireframeGroup);
        if (window.dl) window.dl.visible = false;
      } else {
        scene.remove(wireframeGroup);
        if (window.dl) window.dl.visible = true;
      }
      // 替换DisplacedLines中的head
      if (window.dl && window.dl.depthMap) {
        // 替换head引用
        currentHead = newHead;
        head = newHead;
        // 重新渲染depthMap
        window.dl.depthMap.render = function() {
          renderer.setRenderTarget(this);
          renderer.render(currentHead, this.camera);
          renderer.setRenderTarget(null);
        };
        window.dl.depthMap.render();
      }
    } catch (err) {
      alert('GLB文件加载失败: ' + err.message);
    }
    URL.revokeObjectURL(url);
  });
}

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
let renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth * dpr, innerHeight * dpr);
renderer.setClearColor(0x000000, 1); // 设置黑色背景用于展示
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
// 方便上传后访问DisplacedLines实例
window.dl = dl;

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