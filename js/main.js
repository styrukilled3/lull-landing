import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as audio from './audio.js';

const container = document.getElementById('valley');
const loader = document.getElementById('loader');
const go = document.getElementById('go');
const sound = document.getElementById('sound');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = matchMedia('(max-width: 820px)').matches || /Mobi|Android/i.test(navigator.userAgent);

/* UI that must work even if WebGL fails */
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.2 });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

sound.addEventListener('click', () => {
  const on = audio.toggle();
  if (on === null) return;
  sound.setAttribute('aria-pressed', String(on));
});

start().catch((err) => {
  console.error('lull: WebGL scene failed, falling back to static background', err);
  document.body.classList.add('no-gl');
  loader.classList.add('gone');
});

function loadTexture(url) {
  return new Promise((resolve, reject) => new THREE.TextureLoader().load(url, resolve, undefined, reject));
}

async function start() {
  /* ---------- terrain + path ---------- */
  const L = 600;
  const hash2 = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const vnoise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const sm = (a, b, v) => {
    const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const pathX = (z) => Math.sin(-z * 0.011) * 30 + Math.sin(-z * 0.027) * 8;
  const ground = (x, z) => {
    const dx = x - pathX(z);
    return Math.abs(dx) * 0.14 + vnoise(x * 0.04, z * 0.04) * 7 + vnoise(x * 0.12, z * 0.12) * 1.6 - 4;
  };

  const pts = [];
  for (let i = 0; i <= 48; i++) {
    const z = -(i / 48) * L;
    const x = pathX(z);
    pts.push(new THREE.Vector3(x, ground(x, z) + 2.0, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);

  /* ---------- renderer ---------- */
  const NIGHT = new THREE.Color('#12351E').multiplyScalar(0.22);
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  const PR = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 1.75);
  renderer.setPixelRatio(PR);
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(NIGHT, 1);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 420);
  const FOV_TAN = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

  /* ---------- sprite atlas: 4 cols x 3 rows, cells 0-7 flowers, 8-11 leaves ---------- */
  const atlasTex = await loadTexture('assets/sprites.png');
  atlasTex.colorSpace = THREE.SRGBColorSpace;
  atlasTex.generateMipmaps = true;
  atlasTex.minFilter = THREE.LinearMipmapLinearFilter;
  atlasTex.magFilter = THREE.LinearFilter;
  atlasTex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  /* ---------- flowers + leaves ---------- */
  const cGold = new THREE.Color('#CBA052');
  const cWood = new THREE.Color('#8B6425');
  const cWhite = new THREE.Color('#FFFFFF');
  const tmp = new THREE.Color();
  // cells that face the camera and look fine at any angle; the rest stay roughly upright
  const ROUND_CELLS = new Set([1, 2, 4, 5, 7]);

  function buildPoints(n, isLeaf) {
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    const type = new Float32Array(n);
    const col = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const cell = new Float32Array(n);
    const rot = new Float32Array(n);
    const bright = new Float32Array(n);
    let i = 0;
    let tries = 0;
    while (i < n && tries < n * 40) {
      tries++;
      const z = -Math.random() * L;
      const spread = (Math.random() + Math.random() + Math.random() - 1.5) * 2;
      const x = pathX(z) + spread * 16;
      // patches of growth with bare ground between them
      const d = vnoise(x * 0.07 + 3.1, z * 0.07);
      const keep = isLeaf ? 0.3 + 0.7 * sm(0.25, 0.6, d) : sm(0.42, 0.62, d);
      if (Math.random() > keep) continue;

      const y = ground(x, z) + (isLeaf ? Math.random() * 0.4 : 0.1 + Math.random() * 0.7);
      pos.set([x, y, z], i * 3);
      seed[i] = Math.random();
      type[i] = isLeaf ? 1 : 0;
      bright[i] = 0.72 + Math.random() * 0.5;

      let c;
      if (isLeaf) {
        c = 8 + Math.floor(Math.random() * 4);
        size[i] = 0.9 + Math.random() * 0.9;
        tmp.copy(cWhite);
      } else {
        // species come in patches: pick by a jittered coarse grid cell, with a few strays
        const jx = x + vnoise(x * 0.1, z * 0.1) * 12;
        const jz = z + vnoise(x * 0.1 + 9, z * 0.1) * 12;
        const base = Math.floor(hash2(Math.floor(jx / 15), Math.floor(jz / 15)) * 8);
        c = Math.random() < 0.78 ? base : Math.floor(Math.random() * 8);
        size[i] = 0.36 + Math.random() * 0.5;
        const r = Math.random();
        if (r < 0.65) tmp.copy(cGold);
        else if (r < 0.88) tmp.copy(cGold).lerp(cWhite, 0.5);
        else tmp.copy(cWood).lerp(cGold, 0.4);
      }
      cell[i] = c;
      rot[i] = ROUND_CELLS.has(c) || isLeaf ? Math.random() * Math.PI * 2 : (Math.random() - 0.5) * 1.0;
      col.set([tmp.r, tmp.g, tmp.b], i * 3);
      i++;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, i * 3), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed.subarray(0, i), 1));
    geo.setAttribute('aType', new THREE.BufferAttribute(type.subarray(0, i), 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col.subarray(0, i * 3), 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size.subarray(0, i), 1));
    geo.setAttribute('aCell', new THREE.BufferAttribute(cell.subarray(0, i), 1));
    geo.setAttribute('aRot', new THREE.BufferAttribute(rot.subarray(0, i), 1));
    geo.setAttribute('aBright', new THREE.BufferAttribute(bright.subarray(0, i), 1));
    return geo;
  }

  const shared = {
    uTime: { value: 0 },
    uScale: { value: 1 },
    uAspect: { value: innerWidth / innerHeight },
    uDisperse: { value: 0 },
    uReveal: { value: 0 },
    uSway: { value: reduced ? 0 : 1 },
    uMouse: { value: new THREE.Vector2(5, 5) },
  };

  const vert = /* glsl */`
    uniform float uTime, uScale, uAspect, uDisperse, uReveal, uSway, uSizeMul, uMax, uHalo;
    uniform vec2 uMouse;
    attribute float aSeed, aType, aSize, aCell, aRot, aBright;
    attribute vec3 aColor;
    varying vec3 vColor;
    varying float vAlpha, vGlow, vRot, vCell, vFog, vBright;
    void main() {
      vec3 p = position;
      float s = aSeed * 6.2831;
      float sway = (1.0 - uDisperse) * uSway;
      p.x += sin(uTime * 0.6 + s * 3.0 + p.z * 0.08) * 0.14 * sway;
      p.y += sin(uTime * 0.5 + s * 2.0) * 0.05 * sway;
      vec3 dir = normalize(vec3(sin(s * 7.0), abs(cos(s * 5.0)) * 0.9 + 0.25, cos(s * 3.0)));
      p += dir * uDisperse * (3.0 + aSeed * 9.0);
      p += vec3(sin(uTime * 0.45 + s * 5.0), cos(uTime * 0.38 + s * 4.0), sin(uTime * 0.3 + s * 3.0)) * uDisperse * 1.3;

      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      float dist = -mv.z;
      if (dist < 0.8) {
        gl_Position = vec4(3.0, 3.0, 3.0, 1.0);
        gl_PointSize = 0.0;
        return;
      }
      vec4 clip = projectionMatrix * mv;
      vec2 ndc = clip.xy / clip.w;

      vec2 d = ndc - uMouse;
      d.x *= uAspect;
      float len = length(d);
      float push = exp(-len * len * 22.0);
      vec2 dn = d / max(len, 0.0001);
      ndc += vec2(dn.x / uAspect, dn.y) * push * 0.11;
      vGlow = exp(-len * len * 60.0);
      clip.xy = ndc * clip.w;
      gl_Position = clip;

      bool leaf = aType > 0.5;
      float grow = leaf ? smoothstep(240.0, 60.0, dist) : smoothstep(90.0, 14.0, dist);
      float sz = aSize * (leaf ? (0.4 + 0.6 * grow) : (0.15 + 0.85 * grow)) * uSizeMul;
      sz *= mix(1.0, 0.5, uDisperse);
      gl_PointSize = clamp(sz * uScale / dist, 0.0, uMax);

      vFog = max(smoothstep(30.0, leaf ? 240.0 : 190.0, dist), 1.0 - uReveal);
      vAlpha = uHalo > 0.5 ? uReveal * (1.0 - vFog) * (0.25 + 0.75 * grow) * 0.45 * (1.0 + uDisperse * 0.8) : 1.0;
      vColor = aColor;
      vBright = aBright;
      vCell = aCell;
      vRot = aRot + (leaf ? 0.0 : sin(uTime * 0.4 + s * 2.0) * 0.08 * sway);
    }
  `;

  const fragSprite = /* glsl */`
    uniform sampler2D uAtlas;
    uniform vec3 uFogColor;
    varying vec3 vColor;
    varying float vAlpha, vGlow, vRot, vCell, vFog, vBright;
    void main() {
      vec2 pc = gl_PointCoord - 0.5;
      float c = cos(vRot), sn = sin(vRot);
      pc = vec2(c * pc.x - sn * pc.y, sn * pc.x + c * pc.y) * 1.3 + 0.5;
      if (pc.x < 0.0 || pc.x > 1.0 || pc.y < 0.0 || pc.y > 1.0) discard;
      float col = mod(vCell, 4.0);
      float row = floor(vCell / 4.0);
      vec2 uv = vec2((col + pc.x) * 0.25, 1.0 - (row + pc.y) / 3.0);
      vec4 t = texture2D(uAtlas, uv);
      if (t.a < 0.45) discard;
      vec3 rgb = t.rgb * vBright * (1.0 + vGlow * 1.6);
      rgb = mix(rgb, uFogColor, vFog);
      gl_FragColor = vec4(rgb, 1.0);
    }
  `;

  const fragHalo = /* glsl */`
    varying vec3 vColor;
    varying float vAlpha, vGlow;
    void main() {
      float d = length(gl_PointCoord - 0.5) * 2.0;
      float a = pow(max(1.0 - d, 0.0), 2.0) * vAlpha * (1.0 + vGlow * 0.8);
      if (a < 0.003) discard;
      gl_FragColor = vec4(vColor * (1.0 + vGlow * 2.0), a);
    }
  `;

  const spriteMat = new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uSizeMul: { value: 1.3 },
      uMax: { value: 150 },
      uHalo: { value: 0 },
      uAtlas: { value: atlasTex },
      uFogColor: { value: NIGHT.clone() },
    },
    vertexShader: vert,
    fragmentShader: fragSprite,
    transparent: false,
    depthTest: true,
    depthWrite: true,
  });
  const haloMat = new THREE.ShaderMaterial({
    uniforms: { ...shared, uSizeMul: { value: 2.6 }, uMax: { value: 130 }, uHalo: { value: 1 } },
    vertexShader: vert,
    fragmentShader: fragHalo,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const flowerGeo = buildPoints(isMobile ? 5500 : 9000, false);
  const leafGeo = buildPoints(isMobile ? 4500 : 9000, true);
  const spriteFlowers = new THREE.Points(flowerGeo, spriteMat);
  const spriteLeaves = new THREE.Points(leafGeo, spriteMat);
  const halo = new THREE.Points(flowerGeo, haloMat);
  [spriteFlowers, spriteLeaves, halo].forEach((o) => { o.frustumCulled = false; });
  scene.add(spriteLeaves, spriteFlowers, halo);

  /* ---------- dust ---------- */
  const glow = document.createElement('canvas');
  glow.width = glow.height = 64;
  const gg = glow.getContext('2d');
  const gg2 = gg.createRadialGradient(32, 32, 0, 32, 32, 32);
  gg2.addColorStop(0, 'rgba(255,255,255,1)');
  gg2.addColorStop(1, 'rgba(255,255,255,0)');
  gg.fillStyle = gg2;
  gg.fillRect(0, 0, 64, 64);
  const glowTex = new THREE.CanvasTexture(glow);

  const dn = isMobile ? 800 : 1800;
  const dpos = new Float32Array(dn * 3);
  for (let i = 0; i < dn; i++) {
    const z = -Math.random() * L;
    const x = pathX(z) + (Math.random() - 0.5) * 50;
    dpos.set([x, ground(x, z) + Math.random() * 14, z], i * 3);
  }
  const dgeo = new THREE.BufferGeometry();
  dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dgeo, new THREE.PointsMaterial({
    size: 0.2, map: glowTex, color: cGold, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  }));
  dust.frustumCulled = false;
  scene.add(dust);

  /* ---------- moon ---------- */
  const mc = document.createElement('canvas');
  mc.width = mc.height = 256;
  const mg = mc.getContext('2d');
  const mgr = mg.createRadialGradient(128, 128, 0, 128, 128, 128);
  mgr.addColorStop(0, 'rgba(255,246,222,1)');
  mgr.addColorStop(0.1, 'rgba(255,240,205,0.95)');
  mgr.addColorStop(0.13, 'rgba(255,230,180,0.35)');
  mgr.addColorStop(0.5, 'rgba(203,160,82,0.12)');
  mgr.addColorStop(1, 'rgba(203,160,82,0)');
  mg.fillStyle = mgr;
  mg.fillRect(0, 0, 256, 256);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(mc), blending: THREE.AdditiveBlending,
    depthWrite: false, depthTest: true, transparent: true, fog: false, opacity: 0.75,
  }));
  moon.scale.set(80, 80, 1);
  scene.add(moon);

  /* ---------- post: bloom, tilt-shift blur, split-RGB grain, vignette ---------- */
  const FxShader = {
    uniforms: {
      tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0 },
      uSplit: { value: 0.0015 }, uAspect: { value: 1 }, uTilt: { value: 0.014 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse;
      uniform float uTime, uVig, uSplit, uAspect, uTilt;
      varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec2 o = (vUv - 0.5) * uSplit;
        vec3 c = vec3(texture2D(tDiffuse, vUv + o).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - o).b);
        float k = smoothstep(0.2, 0.5, abs(vUv.y - 0.5)) * uTilt;
        if (k > 0.0004) {
          vec3 acc = vec3(0.0);
          for (int i = 0; i < 12; i++) {
            float a = float(i) * 2.39996;
            float r = sqrt((float(i) + 0.5) / 12.0);
            vec2 off = vec2(cos(a), sin(a)) * r * k;
            off.x /= uAspect;
            acc += texture2D(tDiffuse, vUv + off).rgb;
          }
          c = mix(c, acc / 12.0, smoothstep(0.0, 0.004, k));
        }
        c += (h(vUv * vec2(1920.0, 1080.0) + fract(uTime) * 50.0) - 0.5) * 0.03;
        float d = distance(vUv, vec2(0.5));
        float v = 1.0 - smoothstep(0.3 - uVig * 0.1, 0.98, d);
        c *= mix(0.3, 1.0, v);
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  };
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(PR);
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), isMobile ? 0.4 : 0.5, 0.6, 0.55);
  composer.addPass(bloom);
  const fx = new ShaderPass(FxShader);
  composer.addPass(fx);
  composer.addPass(new OutputPass());

  /* ---------- input ---------- */
  const mouse = new THREE.Vector2(5, 5);
  const mouseS = new THREE.Vector2(5, 5);
  const tilt = new THREE.Vector2(0, 0);
  const zero = new THREE.Vector2(0, 0);
  if (!reduced) {
    addEventListener('pointermove', (e) => {
      mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    });
    document.addEventListener('pointerleave', () => mouse.set(5, 5));
  }

  let hoverTarget = 0;
  let hoverMix = 0;
  go.addEventListener('pointerenter', () => { hoverTarget = 1; audio.setMuffled(true); });
  go.addEventListener('pointerleave', () => { hoverTarget = 0; audio.setMuffled(false); });

  function onResize() {
    renderer.setPixelRatio(PR);
    renderer.setSize(innerWidth, innerHeight);
    composer.setPixelRatio(PR);
    composer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    shared.uAspect.value = camera.aspect;
    shared.uScale.value = (innerHeight * PR) / (2 * FOV_TAN);
    fx.uniforms.uAspect.value = camera.aspect;
  }
  addEventListener('resize', onResize);
  onResize();

  const scrollProgress = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    return max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
  };

  /* ---------- loop ---------- */
  const clock = new THREE.Clock();
  let tCur = 0;
  let speedSm = 0;
  let frames = 0;
  const fwd = new THREE.Vector3();

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;

    hoverMix += (hoverTarget - hoverMix) * Math.min(1, dt * (hoverTarget ? 1.6 : 1.2));
    const disperse = hoverMix * hoverMix * (3 - 2 * hoverMix);

    mouseS.lerp(mouse, Math.min(1, dt * 8));
    shared.uMouse.value.copy(mouseS);

    const target = scrollProgress() * 0.94;
    const prev = tCur;
    tCur += (target - tCur) * Math.min(1, dt * 2.2) * (1 - hoverMix);
    const speed = Math.abs(tCur - prev) / Math.max(dt, 0.001);
    speedSm += (speed - speedSm) * Math.min(1, dt * 4);

    const pos = curve.getPointAt(tCur);
    camera.position.copy(pos);
    if (!reduced) camera.position.y += Math.sin(time * 0.7) * 0.05;
    const look = curve.getPointAt(Math.min(tCur + 0.025, 1));
    look.y -= 2.6;
    camera.lookAt(look);
    const off = reduced || mouse.x > 2;
    tilt.lerp(off ? zero : mouse, Math.min(1, dt * 3));
    camera.rotateY(-tilt.x * 0.06);
    camera.rotateX(tilt.y * 0.04);

    camera.getWorldDirection(fwd);
    moon.position.copy(camera.position).addScaledVector(fwd, 340);
    moon.position.y += 90;

    shared.uTime.value = time;
    shared.uDisperse.value = disperse;
    shared.uReveal.value = Math.min(1, time / 2.5);
    fx.uniforms.uTime.value = time;
    fx.uniforms.uVig.value = Math.min(1, speedSm * 6) + disperse * 0.4;

    composer.render();

    if (++frames === 3) loader.classList.add('gone');
  }
  frame();
}
