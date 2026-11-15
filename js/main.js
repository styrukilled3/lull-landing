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

try {
  start();
} catch (err) {
  console.error('lull: WebGL scene failed, falling back to static background', err);
  document.body.classList.add('no-gl');
  loader.classList.add('gone');
}

function start() {
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
  const NIGHT = new THREE.Color('#12351E').multiplyScalar(0.5);
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  const PR = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 1.75);
  renderer.setPixelRatio(PR);
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(NIGHT, 1);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 420);
  const FOV_TAN = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

  /* ---------- sprite atlas (flower | leaf), drawn procedurally ---------- */
  const atlas = document.createElement('canvas');
  atlas.width = 256;
  atlas.height = 128;
  const g = atlas.getContext('2d');
  g.save();
  g.translate(64, 64);
  let gr = g.createRadialGradient(0, 0, 0, 0, 0, 62);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.18, 'rgba(255,255,255,0.85)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.18)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(-64, -64, 128, 128);
  for (let i = 0; i < 6; i++) {
    g.rotate(Math.PI / 3);
    const pg = g.createRadialGradient(0, -22, 0, 0, -22, 22);
    pg.addColorStop(0, 'rgba(255,255,255,0.9)');
    pg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = pg;
    g.beginPath();
    g.ellipse(0, -22, 9, 22, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  g.save();
  g.translate(192, 64);
  g.scale(0.4, 1);
  gr = g.createRadialGradient(0, 0, 0, 0, 0, 56);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(-64, -64, 128, 128);
  g.restore();
  const atlasTex = new THREE.CanvasTexture(atlas);
  atlasTex.minFilter = THREE.LinearFilter;
  atlasTex.generateMipmaps = false;

  /* ---------- flowers + leaves ---------- */
  const cGold = new THREE.Color('#CBA052');
  const cWood = new THREE.Color('#8B6425');
  const cWhite = new THREE.Color('#FFFFFF');
  const cLeafA = new THREE.Color('#12351E').lerp(cWhite, 0.2);
  const cLeafB = new THREE.Color('#2b6a3f');
  const tmp = new THREE.Color();

  function buildPoints(n, isLeaf) {
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    const type = new Float32Array(n);
    const col = new Float32Array(n * 3);
    const size = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const z = -Math.random() * L;
      const spread = (Math.random() + Math.random() + Math.random() - 1.5) * 2;
      const x = pathX(z) + spread * 16;
      const y = ground(x, z) + (isLeaf ? Math.random() * 0.5 : 0.2 + Math.random() * 1.9);
      pos.set([x, y, z], i * 3);
      seed[i] = Math.random();
      type[i] = isLeaf ? 1 : 0;
      if (isLeaf) {
        tmp.copy(cLeafA).lerp(cLeafB, Math.random());
        size[i] = 1.2 + Math.random() * 1.4;
      } else {
        const r = Math.random();
        if (r < 0.62) tmp.copy(cGold);
        else if (r < 0.84) tmp.copy(cGold).lerp(cWhite, 0.55);
        else tmp.copy(cWood).lerp(cGold, 0.3);
        size[i] = 0.55 + Math.random() * 0.75;
      }
      col.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aType', new THREE.BufferAttribute(type, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    return geo;
  }

  const uniforms = {
    uTime: { value: 0 },
    uScale: { value: 1 },
    uAspect: { value: innerWidth / innerHeight },
    uDisperse: { value: 0 },
    uReveal: { value: 0 },
    uSway: { value: reduced ? 0 : 1 },
    uMouse: { value: new THREE.Vector2(5, 5) },
    uMap: { value: atlasTex },
  };

  const vert = /* glsl */`
    uniform float uTime, uScale, uAspect, uDisperse, uReveal, uSway;
    uniform vec2 uMouse;
    attribute float aSeed, aType, aSize;
    attribute vec3 aColor;
    varying vec3 vColor;
    varying float vAlpha, vType, vGlow, vRot;
    void main() {
      vec3 p = position;
      float s = aSeed * 6.2831;
      float sway = (1.0 - uDisperse) * uSway;
      p.x += sin(uTime * 0.6 + s * 3.0 + p.z * 0.08) * 0.18 * sway;
      p.y += sin(uTime * 0.5 + s * 2.0) * 0.08 * sway;
      vec3 dir = normalize(vec3(sin(s * 7.0), abs(cos(s * 5.0)) * 0.9 + 0.25, cos(s * 3.0)));
      p += dir * uDisperse * (3.0 + aSeed * 9.0);
      p += vec3(sin(uTime * 0.45 + s * 5.0), cos(uTime * 0.38 + s * 4.0), sin(uTime * 0.3 + s * 3.0)) * uDisperse * 1.3;

      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      float dist = -mv.z;
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
      float grow = leaf ? smoothstep(260.0, 70.0, dist) : smoothstep(95.0, 16.0, dist);
      float sz = aSize * (leaf ? (0.35 + 0.65 * grow) : (0.18 + 0.82 * grow));
      sz *= mix(1.0, 0.55, uDisperse);
      gl_PointSize = clamp(sz * uScale / max(dist, 0.1), 0.0, 140.0);

      float nearFade = smoothstep(0.6, 3.0, dist);
      float farFade = leaf ? 0.55 * (1.0 - smoothstep(180.0, 300.0, dist)) : 1.0 - smoothstep(120.0, 260.0, dist);
      vAlpha = nearFade * farFade * uReveal * (1.0 + uDisperse * 0.5);
      vColor = aColor;
      vType = aType;
      vRot = s;
    }
  `;
  const frag = /* glsl */`
    uniform sampler2D uMap;
    varying vec3 vColor;
    varying float vAlpha, vType, vGlow, vRot;
    void main() {
      vec2 pc = gl_PointCoord - 0.5;
      float c = cos(vRot), sn = sin(vRot);
      pc = vec2(c * pc.x - sn * pc.y, sn * pc.x + c * pc.y) + 0.5;
      pc = clamp(pc, 0.001, 0.999);
      vec2 uv = vec2(pc.x * 0.5 + (vType > 0.5 ? 0.5 : 0.0), 1.0 - pc.y);
      float a = texture2D(uMap, uv).a;
      vec3 col = vColor * (1.0 + vGlow * 2.2);
      float alpha = a * vAlpha * (1.0 + vGlow * 0.8);
      if (alpha < 0.003) discard;
      gl_FragColor = vec4(col, alpha);
    }
  `;
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });

  const flowers = new THREE.Points(buildPoints(isMobile ? 5500 : 11000, false), mat);
  const leaves = new THREE.Points(buildPoints(isMobile ? 4500 : 9000, true), mat);
  flowers.frustumCulled = false;
  leaves.frustumCulled = false;
  scene.add(leaves, flowers);

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
    size: 0.22, map: glowTex, color: cGold, transparent: true, opacity: 0.55,
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
    depthWrite: false, depthTest: false, transparent: true, fog: false,
  }));
  moon.scale.set(110, 110, 1);
  moon.renderOrder = -1;
  scene.add(moon);

  /* ---------- post ---------- */
  const FxShader = {
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0 }, uSplit: { value: 0.0015 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse;
      uniform float uTime, uVig, uSplit;
      varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec2 o = (vUv - 0.5) * uSplit;
        vec4 c = vec4(texture2D(tDiffuse, vUv + o).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - o).b, 1.0);
        c.rgb += (h(vUv * vec2(1920.0, 1080.0) + fract(uTime) * 50.0) - 0.5) * 0.035;
        float d = distance(vUv, vec2(0.5));
        float v = 1.0 - smoothstep(0.28 - uVig * 0.1, 0.95, d);
        c.rgb *= mix(0.35, 1.0, v);
        gl_FragColor = c;
      }
    `,
  };
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(PR);
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), isMobile ? 0.7 : 0.95, 0.65, 0.12);
  composer.addPass(bloom);
  const fx = new ShaderPass(FxShader);
  composer.addPass(fx);
  composer.addPass(new OutputPass());

  /* ---------- input ---------- */
  const mouse = new THREE.Vector2(5, 5);
  const mouseS = new THREE.Vector2(5, 5);
  const tilt = new THREE.Vector2(0, 0);
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
    uniforms.uAspect.value = camera.aspect;
    uniforms.uScale.value = (innerHeight * PR) / (2 * FOV_TAN);
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
    uniforms.uMouse.value.copy(mouseS);

    const target = scrollProgress() * 0.94;
    const prev = tCur;
    tCur += (target - tCur) * Math.min(1, dt * 2.2) * (1 - hoverMix);
    const speed = Math.abs(tCur - prev) / Math.max(dt, 0.001);
    speedSm += (speed - speedSm) * Math.min(1, dt * 4);

    const pos = curve.getPointAt(tCur);
    camera.position.copy(pos);
    if (!reduced) camera.position.y += Math.sin(time * 0.7) * 0.05;
    const look = curve.getPointAt(Math.min(tCur + 0.025, 1));
    look.y -= 0.2;
    camera.lookAt(look);
    const off = reduced || mouse.x > 2;
    tilt.lerp(off ? new THREE.Vector2(0, 0) : mouse, Math.min(1, dt * 3));
    camera.rotateY(-tilt.x * 0.06);
    camera.rotateX(tilt.y * 0.04);

    camera.getWorldDirection(fwd);
    moon.position.copy(camera.position).addScaledVector(fwd, 340);
    moon.position.y += 90;

    uniforms.uTime.value = time;
    uniforms.uDisperse.value = disperse;
    uniforms.uReveal.value = Math.min(1, time / 2.5);
    fx.uniforms.uTime.value = time;
    fx.uniforms.uVig.value = Math.min(1, speedSm * 6) + disperse * 0.4;

    composer.render();

    if (++frames === 3) loader.classList.add('gone');
  }
  frame();
}
