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
  document.body.classList.add('no-gl', 'ready');
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
    return Math.abs(dx) * 0.11 + vnoise(x * 0.04, z * 0.04) * 7 + vnoise(x * 0.12, z * 0.12) * 1.6 - 4;
  };

  const pts = [];
  for (let i = 0; i <= 48; i++) {
    const z = -(i / 48) * L;
    const x = pathX(z);
    pts.push(new THREE.Vector3(x, ground(x, z) + 2.4, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);

  /* ---------- renderer ---------- */
  const NIGHT = new THREE.Color('#000000');
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  let PR = Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 1.25);
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

  // ---- composition: two banks of flowers that swap dominance along the path, a thin winding trail between them ----
  const BANK_PERIOD = 90;
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;
  const bankWeight = (z, side) =>
    sm(0.12, 0.88, 0.5 + 0.5 * Math.cos((2 * Math.PI * (z + 15)) / BANK_PERIOD + (side < 0 ? 0 : Math.PI)));
  // each cluster sticks to two species so every patch reads as one colour family
  const LEFT_SETS = [[5, 7], [7, 4], [5, 4]];     // cream, cosmos, lily: cooler and paler
  const RIGHT_SETS = [[2, 1], [1, 6], [2, 3]];    // daisy, coneflower, bell, side view: warm gold and amber
  const COOL_CELLS = new Set([4, 5, 7]);

  function pack(list, isLeaf) {
    const n = list.length;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    const type = new Float32Array(n);
    const col = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const cell = new Float32Array(n);
    const rot = new Float32Array(n);
    const bright = new Float32Array(n);
    list.forEach((o, i) => {
      pos.set([o.x, o.y, o.z], i * 3);
      seed[i] = Math.random();
      type[i] = isLeaf ? 1 : 0;
      col.set([o.r, o.g, o.b], i * 3);
      size[i] = o.size;
      cell[i] = o.cell;
      rot[i] = o.rot;
      bright[i] = 0.72 + Math.random() * 0.48;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aType', new THREE.BufferAttribute(type, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aCell', new THREE.BufferAttribute(cell, 1));
    geo.setAttribute('aRot', new THREE.BufferAttribute(rot, 1));
    geo.setAttribute('aBright', new THREE.BufferAttribute(bright, 1));
    return geo;
  }

  function buildFlowers(n) {
    const list = [];
    let tries = 0;
    while (list.length < n && tries < n * 80) {
      tries++;
      const z = -Math.random() * L;
      const r = Math.random();
      let lat, cell, size, weight;
      if (r < 0.14) {
        // thin trail that snakes down the middle and points into the distance
        lat = 3.5 * Math.sin(z * 0.06 + 1.3) + gauss() * 0.9;
        weight = 0.55;
        const q = Math.random();
        cell = q < 0.6 ? 0 : q < 0.9 ? 5 : 2;
        size = 0.14 + Math.random() * 0.16;
      } else {
        const side = r < 0.57 ? -1 : 1;
        const bank = 8 + 2.5 * Math.sin(z * 0.04 + side);
        lat = side * (bank + Math.abs(gauss()) * 5 + 0.5);
        const patch = 0.35 + 0.65 * sm(0.3, 0.6, vnoise(lat * 0.2 + 3.1, z * 0.09));
        weight = bankWeight(z, side) * patch;
        const sets = side < 0 ? LEFT_SETS : RIGHT_SETS;
        const set = sets[Math.floor(hash2(Math.floor((z + 15) / BANK_PERIOD), side) * sets.length)];
        const q = Math.random();
        cell = q < 0.55 ? set[0] : q < 0.92 ? set[1] : Math.floor(Math.random() * 8);
        size = 0.22 + Math.random() * 0.28;
      }
      if (Math.random() > weight) continue;
      const x = pathX(z) + lat;
      const y = ground(x, z) + 0.1 + Math.random() * 0.6;
      if (COOL_CELLS.has(cell)) tmp.copy(cWhite).lerp(cGold, 0.25);
      else tmp.copy(cGold).lerp(cWood, Math.random() * 0.5);
      list.push({
        x, y, z, cell, size,
        rot: ROUND_CELLS.has(cell) ? Math.random() * Math.PI * 2 : (Math.random() - 0.5) * 1.0,
        r: tmp.r, g: tmp.g, b: tmp.b,
      });
    }
    return pack(list, false);
  }

  function buildLeaves(n) {
    const list = [];
    let tries = 0;
    while (list.length < n && tries < n * 20) {
      tries++;
      const z = -Math.random() * L;
      const lat = (Math.random() - 0.5) * 80;
      // a dark carpet everywhere, a bit thinner in the middle lane
      if (Math.random() > 0.45 + 0.55 * sm(2, 14, Math.abs(lat))) continue;
      const x = pathX(z) + lat;
      list.push({
        x, y: ground(x, z) + Math.random() * 0.4, z,
        cell: 8 + Math.floor(Math.random() * 4),
        size: 0.9 + Math.random() * 0.7,
        rot: Math.random() * Math.PI * 2,
        r: 1, g: 1, b: 1,
      });
    }
    return pack(list, true);
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
      float sz = aSize * uSizeMul;
      sz *= mix(1.0, 0.5, uDisperse);
      // tiny sprites fade to black before they vanish, so nothing pops or shimmers
      float px = sz * uScale / dist;
      if (px < 1.5) {
        gl_Position = vec4(3.0, 3.0, 3.0, 1.0);
        gl_PointSize = 0.0;
        return;
      }
      gl_PointSize = min(px, uMax);

      vFog = max(max(smoothstep(30.0, leaf ? 240.0 : 190.0, dist), 1.0 - smoothstep(1.5, 6.0, px)), 1.0 - uReveal);
      vAlpha = uHalo > 0.5 ? uReveal * (1.0 - vFog) * (0.25 + 0.75 * grow) * 0.3 * (1.0 + uDisperse * 0.8) : 1.0;
      vColor = aColor;
      vBright = aBright;
      vCell = aCell;
      vRot = aRot;
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
      if (t.a < 0.02) discard;
      vec3 rgb = t.rgb * vBright * 0.9 * (1.0 + vGlow * 0.5);
      rgb = mix(rgb, uFogColor, vFog);
      // alpha only drives alpha-to-coverage on the multisampled target, which smooths the cut-out edge
      gl_FragColor = vec4(rgb, t.a);
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
    alphaToCoverage: true,
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

  const flowerGeo = buildFlowers(isMobile ? 7000 : 15000);
  const leafGeo = buildLeaves(isMobile ? 5000 : 10000);
  const spriteFlowers = new THREE.Points(flowerGeo, spriteMat);
  const spriteLeaves = new THREE.Points(leafGeo, spriteMat);
  const halo = new THREE.Points(flowerGeo, haloMat);
  [spriteFlowers, spriteLeaves, halo].forEach((o) => { o.frustumCulled = false; });
  scene.add(spriteLeaves, spriteFlowers);

  /* ---------- post: bloom, tilt-shift blur, split-RGB grain, vignette ---------- */
  const FxShader = {
    uniforms: {
      tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0 },
      uSplit: { value: 0.0015 }, uAspect: { value: 1 }, uTilt: { value: 0.035 },
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
        // blur grows toward the edges: heavy on the near side (bottom, corners), light on the far side (top)
        vec2 fq = (vUv - vec2(0.5, 0.4)) * vec2(1.0, 1.35);
        float k = smoothstep(0.24, 0.72, length(fq));
        k *= mix(1.0, 0.4, smoothstep(0.4, 0.58, vUv.y));
        k *= uTilt;
        if (k > 0.0004) {
          vec3 acc = vec3(0.0);
          for (int i = 0; i < 10; i++) {
            float a = float(i) * 2.39996;
            float r = sqrt((float(i) + 0.5) / 10.0);
            vec2 off = vec2(cos(a), sin(a)) * r * k;
            off.x /= uAspect;
            acc += texture2D(tDiffuse, vUv + off).rgb;
          }
          c = mix(c, acc / 10.0, smoothstep(0.0, 0.004, k));
        }
        c += (h(vUv * vec2(1920.0, 1080.0)) - 0.5) * 0.01;
        float d = distance(vUv, vec2(0.5));
        float v = 1.0 - smoothstep(0.3 - uVig * 0.1, 0.98, d);
        c *= mix(0.3, 1.0, v);
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  };
  // multisampled target: gives alpha-to-coverage something to smooth the sprite edges with
  const msaaTarget = new THREE.WebGLRenderTarget(innerWidth * PR, innerHeight * PR, {
    type: THREE.HalfFloatType,
    samples: 2,
  });
  const composer = new EffectComposer(renderer, msaaTarget);
  composer.setPixelRatio(PR);
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), isMobile ? 0.12 : 0.16, 0.5, 0.85);
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
  let frameMs = 16;
  let hud = null;
  if (location.search.includes('debug')) {
    hud = document.createElement('div');
    hud.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:20;font:12px monospace;color:#CBA052';
    document.body.appendChild(hud);
  }

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
    const look = curve.getPointAt(Math.min(tCur + 0.025, 1));
    look.y -= 2.6;
    camera.lookAt(look);
    const off = reduced || mouse.x > 2;
    tilt.lerp(off ? zero : mouse, Math.min(1, dt * 3));
    camera.rotateY(-tilt.x * 0.06);
    camera.rotateX(tilt.y * 0.04);

    shared.uTime.value = time;
    shared.uDisperse.value = disperse;
    shared.uReveal.value = Math.min(1, time / 2.5);
    fx.uniforms.uTime.value = time;
    fx.uniforms.uVig.value = Math.min(1, speedSm * 6) + disperse * 0.4;

    composer.render();

    // adaptive resolution: if frames are slow, drop the pixel ratio a step instead of stuttering
    frameMs += (dt * 1000 - frameMs) * 0.05;
    if (hud) hud.textContent = Math.round(1000 / Math.max(frameMs, 1)) + ' fps  PR ' + PR.toFixed(2);
    if (frames > 90 && frames % 45 === 0 && frameMs > 26 && PR > 0.7) {
      PR = Math.max(0.7, PR - 0.2);
      onResize();
      frameMs = 16;
    }

    if (++frames === 3) loader.classList.add('gone');
    if (frames === 20) document.body.classList.add('ready');
  }
  frame();
}
