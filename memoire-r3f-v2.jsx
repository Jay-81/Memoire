import { useRef, useMemo, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Sphere,
  Box,
  Cylinder,
  Cone,
  Plane,
  MeshDistortMaterial,
  MeshWobbleMaterial,
  Stars,
  Billboard,
  Text,
  Environment,
  Sparkles,
  Float,
  Trail,
  RoundedBox,
  Torus,
} from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, ToneMapping } from "@react-three/postprocessing";
import * as THREE from "three";

// ─── Palette ────────────────────────────────────────────────
const WARM_AMBER   = new THREE.Color(1.4, 0.65, 0.12);
const WARM_GOLD    = new THREE.Color(1.2, 0.55, 0.08);
const LANTERN_COL  = new THREE.Color(1.6, 0.7, 0.1);
const WINDOW_COL   = new THREE.Color(1.5, 0.62, 0.05);
const SKY_TOP      = "#1a0820";
const SKY_MID      = "#4a1830";
const SKY_HOR      = "#c04828";
const FOG_COL      = new THREE.Color(0.18, 0.07, 0.04);

// ─── Helpers ────────────────────────────────────────────────
function easeInOut(t) {
  return t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t;
}

// ─── Gradient sky ───────────────────────────────────────────
function GradientSky() {
  const meshRef = useRef();
  return (
    <mesh ref={meshRef} scale={[200, 200, 200]}>
      <sphereGeometry args={[1, 32, 16]} />
      <meshBasicMaterial side={THREE.BackSide} vertexColors>
        <primitive
          attach="color"
          object={new THREE.Color(SKY_HOR)}
        />
      </meshBasicMaterial>
    </mesh>
  );
}

// Better gradient sky using shader-like approach via background
function SkyDome() {
  const { scene } = useThree();
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2; canvas.height = 512;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0.0, "#0d0514");
    grad.addColorStop(0.25, "#1a0820");
    grad.addColorStop(0.5, "#3d1228");
    grad.addColorStop(0.72, "#8a2818");
    grad.addColorStop(0.85, "#c84020");
    grad.addColorStop(0.92, "#e06030");
    grad.addColorStop(1.0,  "#cc5820");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 2, 512);
    const tex = new THREE.CanvasTexture(canvas);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = tex;
    return () => { tex.dispose(); };
  }, [scene]);
  return null;
}

// ─── Ground ─────────────────────────────────────────────────
function Ground() {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#1a1208",
    roughness: 1,
    metalness: 0,
  }), []);
  return (
    <>
      <Plane args={[120, 120]} rotation={[-Math.PI/2, 0, 0]} position={[0,0,0]} receiveShadow>
        <primitive object={mat} attach="material" />
      </Plane>
      {/* Grass color variation patches */}
      {useMemo(() => Array.from({length: 60}, (_, i) => {
        const a = (i/60)*Math.PI*2;
        const r = 2 + Math.random()*20;
        const x = Math.cos(a)*r + (Math.random()-0.5)*4;
        const z = Math.sin(a)*r + 6 + (Math.random()-0.5)*4;
        const s = 0.8 + Math.random()*3;
        const g = 0.08 + Math.random()*0.06;
        return (
          <Plane key={i} args={[s, s*0.7]} rotation={[-Math.PI/2,0,Math.random()*Math.PI]} position={[x,0.01,z]}>
            <meshStandardMaterial color={new THREE.Color(0.06, g, 0.02)} roughness={1} />
          </Plane>
        );
      }), [])}
    </>
  );
}

// ─── Stone path ─────────────────────────────────────────────
function StonePath() {
  const stones = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 28; i++) {
      const t = i / 27;
      const z = 2.5 + t * 19;
      const curve = Math.sin(t * Math.PI * 2.5) * 0.4;
      const w = 0.7 + Math.random()*0.5;
      const d = 0.45 + Math.random()*0.3;
      const y_rot = (Math.random()-0.5)*0.3;
      arr.push({ x: curve, z, w, d, y_rot, c: 0.22 + Math.random()*0.08 });
      if (i % 2 === 0) arr.push({ x: curve + 0.75 + Math.random()*0.2, z: z+0.2, w: w*0.7, d: d*0.8, y_rot: (Math.random()-0.5)*0.4, c: 0.20 + Math.random()*0.07 });
      if (i % 3 === 0) arr.push({ x: curve - 0.75 - Math.random()*0.2, z: z-0.1, w: w*0.65, d: d*0.75, y_rot: (Math.random()-0.5)*0.35, c: 0.21 + Math.random()*0.08 });
    }
    return arr;
  }, []);
  return (
    <group>
      {stones.map((s, i) => (
        <Box key={i} args={[s.w, 0.09, s.d]} position={[s.x, 0.045, s.z]} rotation={[0, s.y_rot, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={new THREE.Color(s.c, s.c*0.85, s.c*0.7)} roughness={0.92} metalness={0.03} />
        </Box>
      ))}
    </group>
  );
}

// ─── Fence ──────────────────────────────────────────────────
function Fence({ side }) {
  const sx = side === 'left' ? -1 : 1;
  const posts = useMemo(() => Array.from({length: 12}, (_, i) => ({
    x: sx * (1.8 + 0.12), z: 3 + i * 1.6
  })), [sx]);
  return (
    <group>
      {posts.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <Box args={[0.1, 1.1, 0.1]} position={[0, 0.55, 0]} castShadow>
            <meshStandardMaterial color="#2a1808" roughness={0.9} />
          </Box>
          {i < posts.length - 1 && (
            <Box args={[0.06, 0.06, 1.6]} position={[0, 0.75, 0.8]} castShadow>
              <meshStandardMaterial color="#2a1808" roughness={0.9} />
            </Box>
          )}
          {i < posts.length - 1 && (
            <Box args={[0.06, 0.06, 1.6]} position={[0, 0.45, 0.8]} castShadow>
              <meshStandardMaterial color="#2a1808" roughness={0.9} />
            </Box>
          )}
        </group>
      ))}
    </group>
  );
}

// ─── Tree ────────────────────────────────────────────────────
function CozyTree({ position, height = 5.5, spread = 1.9, hue = 0.32, wobble = 0 }) {
  const ref = useRef();
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.4 + wobble) * 0.018;
    }
  });
  const trunkH = height * 0.32;
  const layers = 4;
  return (
    <group ref={ref} position={position}>
      {/* trunk */}
      <Cylinder args={[0.13, 0.22, trunkH, 7]} position={[0, trunkH/2, 0]} castShadow>
        <meshStandardMaterial color={new THREE.Color(0.12, 0.07, 0.03)} roughness={1} />
      </Cylinder>
      {/* layered canopy */}
      {Array.from({length: layers}, (_, l) => {
        const lh = height * (0.52 - l * 0.07);
        const lr = spread * (1.05 - l * 0.2);
        const ly = trunkH + l * lh * 0.38 + lh/2;
        const lightness = 0.07 + l * 0.022;
        return (
          <Cone key={l} args={[lr, lh, 9]} position={[0, ly, 0]} castShadow>
            <meshStandardMaterial
              color={new THREE.Color().setHSL(hue, 0.58, lightness)}
              roughness={1}
            />
          </Cone>
        );
      })}
    </group>
  );
}

// ─── Bush ────────────────────────────────────────────────────
function Bush({ position, scale = 1 }) {
  const ref = useRef();
  useFrame((s) => {
    if (ref.current) ref.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.3 + position[0]) * 0.02;
  });
  return (
    <group ref={ref} position={position}>
      {[
        [0, 0, 0, scale],
        [scale*0.4, -0.05, scale*0.3, scale*0.75],
        [-scale*0.38, -0.05, scale*0.2, scale*0.7],
        [scale*0.1, 0.1, -scale*0.3, scale*0.65],
      ].map(([x, y, z, s], i) => (
        <Sphere key={i} args={[s*0.42, 8, 6]} position={[x, y + s*0.42, z]}>
          <meshStandardMaterial
            color={new THREE.Color().setHSL(0.30+Math.random()*0.06, 0.52, 0.075 + i*0.01)}
            roughness={1}
          />
        </Sphere>
      ))}
    </group>
  );
}

// ─── Flower ──────────────────────────────────────────────────
function FlowerPatch({ cx, cz, count = 8 }) {
  const flowers = useMemo(() => Array.from({length: count}, (_, i) => {
    const a = (i/count)*Math.PI*2 + Math.random()*0.8;
    const r = Math.random()*1.1;
    const hue = Math.random() > 0.45 ? 0.0 + Math.random()*0.08 : 0.62 + Math.random()*0.1;
    const h = 0.28 + Math.random()*0.38;
    return { x: cx + Math.cos(a)*r, z: cz + Math.sin(a)*r, hue, h };
  }), [cx, cz, count]);
  return (
    <group>
      {flowers.map((f, i) => (
        <group key={i} position={[f.x, 0, f.z]}>
          <Cylinder args={[0.014, 0.014, f.h, 4]} position={[0, f.h/2, 0]}>
            <meshStandardMaterial color="#1e3a0e" roughness={1} />
          </Cylinder>
          <Sphere args={[0.07 + Math.random()*0.05, 7, 5]} position={[0, f.h + 0.06, 0]}>
            <meshStandardMaterial
              color={new THREE.Color().setHSL(f.hue, 0.82, 0.52)}
              roughness={0.6}
              emissive={new THREE.Color().setHSL(f.hue, 0.7, 0.08)}
              emissiveIntensity={0.4}
            />
          </Sphere>
        </group>
      ))}
    </group>
  );
}

// ─── Vine tendrils ───────────────────────────────────────────
function Vine({ position, height = 2.5, spread = 0.6 }) {
  const leaves = useMemo(() => Array.from({length: 14}, (_, i) => {
    const t = i/13;
    return {
      x: (Math.random()-0.5)*spread*t*2,
      y: t * height,
      z: (Math.random()-0.5)*0.25,
      rx: (Math.random()-0.5)*0.8,
      scale: 0.05 + Math.random()*0.08,
    };
  }), [height, spread]);
  return (
    <group position={position}>
      {leaves.map((l, i) => (
        <Sphere key={i} args={[l.scale, 5, 4]} position={[l.x, l.y, l.z]} rotation={[l.rx, 0, 0]}>
          <meshStandardMaterial
            color={new THREE.Color().setHSL(0.31, 0.56, 0.09 + Math.random()*0.04)}
            roughness={1}
          />
        </Sphere>
      ))}
    </group>
  );
}

// ─── Lantern ─────────────────────────────────────────────────
function Lantern({ position, intensity = 2.2, height = 2.8, poleR = 0.04 }) {
  const glowRef = useRef();
  useFrame((s) => {
    if (glowRef.current) {
      glowRef.current.intensity = intensity * (0.85 + Math.sin(s.clock.elapsedTime * 2.3 + position[0]) * 0.15);
    }
  });
  return (
    <group position={position}>
      {/* pole */}
      <Cylinder args={[poleR, poleR*1.3, height, 6]} position={[0, height/2, 0]} castShadow>
        <meshStandardMaterial color="#1a0e06" roughness={0.8} metalness={0.3} />
      </Cylinder>
      {/* arm */}
      <Box args={[0.35, 0.04, 0.04]} position={[0.17, height+0.02, 0]}>
        <meshStandardMaterial color="#1a0e06" roughness={0.8} metalness={0.3} />
      </Box>
      {/* lantern body */}
      <group position={[0.34, height - 0.14, 0]}>
        <Cylinder args={[0.13, 0.11, 0.32, 8]} castShadow>
          <meshStandardMaterial color={LANTERN_COL} emissive={WARM_GOLD} emissiveIntensity={3.5} transparent opacity={0.92} />
        </Cylinder>
        <Cylinder args={[0.09, 0.13, 0.08, 8]} position={[0, 0.2, 0]}>
          <meshStandardMaterial color="#1a0e06" roughness={0.9} />
        </Cylinder>
        <Cylinder args={[0.13, 0.09, 0.08, 8]} position={[0, -0.2, 0]}>
          <meshStandardMaterial color="#1a0e06" roughness={0.9} />
        </Cylinder>
        <pointLight ref={glowRef} color={LANTERN_COL} intensity={intensity} distance={7} decay={2} castShadow />
      </group>
    </group>
  );
}

// ─── Window glow panel ───────────────────────────────────────
function WindowGlow({ position, width = 1.0, height = 0.85, rotation = [0,0,0] }) {
  return (
    <group position={position} rotation={rotation}>
      {/* frame */}
      <Box args={[width+0.18, height+0.22, 0.14]} castShadow>
        <meshStandardMaterial color="#2c1508" roughness={0.85} />
      </Box>
      {/* cross bars */}
      <Box args={[width, 0.04, 0.04]} position={[0, 0, 0.09]}>
        <meshStandardMaterial color="#1e0e04" roughness={0.9} />
      </Box>
      <Box args={[0.04, height, 0.04]} position={[0, 0, 0.09]}>
        <meshStandardMaterial color="#1e0e04" roughness={0.9} />
      </Box>
      {/* glowing glass */}
      <Plane args={[width*0.88, height*0.88]} position={[0, 0, 0.1]}>
        <meshStandardMaterial
          color={WINDOW_COL}
          emissive={WINDOW_COL}
          emissiveIntensity={2.8}
          transparent opacity={0.9}
        />
      </Plane>
      {/* interior light cast */}
      <pointLight color={WINDOW_COL} intensity={3.2} distance={9} decay={2} position={[0, 0, 0.5]} />
    </group>
  );
}

// ─── Arched Door ─────────────────────────────────────────────
function Door({ isOpen }) {
  const pivotRef = useRef();
  const openAngle = -Math.PI * 0.68;
  const targetAngle = useRef(0);

  useFrame((_, dt) => {
    if (!pivotRef.current) return;
    const target = isOpen ? openAngle : 0;
    pivotRef.current.rotation.y = THREE.MathUtils.lerp(pivotRef.current.rotation.y, target, dt * 1.8);
  });

  const archPoints = useMemo(() => {
    const pts = [];
    const W = 0.9, H = 1.85;
    pts.push(new THREE.Vector2(-W/2, 0));
    pts.push(new THREE.Vector2(-W/2, H * 0.65));
    // arch curve top
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI - (i/12)*Math.PI;
      pts.push(new THREE.Vector2(Math.cos(a)*(W/2), H*0.65 + Math.sin(a)*(W/2)));
    }
    pts.push(new THREE.Vector2(W/2, H * 0.65));
    pts.push(new THREE.Vector2(W/2, 0));
    return pts;
  }, []);

  return (
    <group>
      {/* Door frame / arch surround */}
      <group position={[0, 0, -2.51]}>
        {/* stone arch decoration */}
        {Array.from({length:9}, (_, i) => {
          const a = Math.PI - (i/8)*Math.PI;
          const r = 0.95;
          return (
            <Box key={i} args={[0.18, 0.22, 0.18]}
              position={[Math.cos(a)*r, 1.85 + 0.65 + Math.sin(a)*r*0.82, 0]}
              rotation={[0, 0, -a + Math.PI/2]}>
              <meshStandardMaterial color="#3e2c1c" roughness={0.92} />
            </Box>
          );
        })}
        {/* vertical frame posts */}
        <Box args={[0.2, 1.9, 0.18]} position={[-0.55, 0.95, 0]}>
          <meshStandardMaterial color="#3a2614" roughness={0.88} />
        </Box>
        <Box args={[0.2, 1.9, 0.18]} position={[0.55, 0.95, 0]}>
          <meshStandardMaterial color="#3a2614" roughness={0.88} />
        </Box>
        {/* step threshold */}
        <Box args={[1.4, 0.1, 0.4]} position={[0, -0.05, 0.18]}>
          <meshStandardMaterial color="#2e1e0e" roughness={0.95} />
        </Box>
      </group>

      {/* Door pivot */}
      <group ref={pivotRef} position={[-0.45, 0, -2.51]}>
        <group position={[0.45, 0, 0]}>
          {/* door panel */}
          <Box args={[0.88, 1.82, 0.08]} position={[0, 0.91, 0]} castShadow>
            <meshStandardMaterial color="#4a2a10" roughness={0.75} metalness={0.08} />
          </Box>
          {/* door panels carved */}
          <Box args={[0.34, 0.52, 0.04]} position={[-0.19, 1.28, 0.04]} castShadow>
            <meshStandardMaterial color="#3a1e0a" roughness={0.8} />
          </Box>
          <Box args={[0.34, 0.52, 0.04]} position={[0.19, 1.28, 0.04]} castShadow>
            <meshStandardMaterial color="#3a1e0a" roughness={0.8} />
          </Box>
          <Box args={[0.34, 0.52, 0.04]} position={[-0.19, 0.62, 0.04]} castShadow>
            <meshStandardMaterial color="#3a1e0a" roughness={0.8} />
          </Box>
          <Box args={[0.34, 0.52, 0.04]} position={[0.19, 0.62, 0.04]} castShadow>
            <meshStandardMaterial color="#3a1e0a" roughness={0.8} />
          </Box>
          {/* door knob */}
          <Sphere args={[0.055, 10, 8]} position={[0.35, 0.92, 0.06]}>
            <meshStandardMaterial color="#b8860b" roughness={0.2} metalness={0.9} />
          </Sphere>
          {/* door arch top */}
          <group position={[0, 1.82, 0]}>
            {Array.from({length: 7}, (_, i) => {
              const a = (i/6)*Math.PI;
              const r = 0.44;
              return (
                <Box key={i} args={[0.13, 0.14, 0.08]}
                  position={[Math.cos(a)*r - 0.44, Math.sin(a)*r, 0]}
                  rotation={[0, 0, -a + Math.PI/2]}>
                  <meshStandardMaterial color="#4a2a10" roughness={0.75} />
                </Box>
              );
            })}
          </group>
        </group>
      </group>

      {/* Interior warm light seen through door */}
      <pointLight
        color={new THREE.Color(1.5, 0.7, 0.15)}
        intensity={isOpen ? 12 : 0.5}
        distance={14}
        decay={2}
        position={[0, 1.5, -1.8]}
      />
    </group>
  );
}

// ─── Stone Steps ─────────────────────────────────────────────
function Steps() {
  return (
    <group position={[0, 0, -2.2]}>
      {[0,1,2].map(i => (
        <Box key={i} args={[1.6 - i*0.18, 0.16, 0.38]} position={[0, i*0.16, i*0.35]} castShadow receiveShadow>
          <meshStandardMaterial color={new THREE.Color(0.22, 0.16, 0.1)} roughness={0.92} />
        </Box>
      ))}
    </group>
  );
}

// ─── Main cottage ────────────────────────────────────────────
function Cottage({ isOpen }) {
  const W = 6.0, H = 4.0, D = 5.2;
  const wallMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.30, 0.21, 0.13),
    roughness: 0.88,
    metalness: 0.02,
  }), []);
  const stoneMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.24, 0.17, 0.10),
    roughness: 0.95,
  }), []);

  return (
    <group position={[0, 0, -5]}>
      {/* Foundation / stone base */}
      <Box args={[W+0.35, 0.55, D+0.35]} position={[0, 0.28, 0]} receiveShadow castShadow>
        <primitive object={stoneMat} attach="material" />
      </Box>

      {/* Main walls */}
      <Box args={[W, H, D]} position={[0, H/2 + 0.55, 0]} castShadow receiveShadow>
        <primitive object={wallMat} attach="material" />
      </Box>

      {/* Side bump-out / bay */}
      <Box args={[1.6, H*0.7, 1.8]} position={[-W/2-0.7, H*0.7/2+0.55, -0.3]} castShadow receiveShadow>
        <primitive object={wallMat} attach="material" />
      </Box>
      <Box args={[1.6, H*0.7, 1.8]} position={[W/2+0.7, H*0.7/2+0.55, -0.3]} castShadow receiveShadow>
        <primitive object={wallMat} attach="material" />
      </Box>

      {/* Roof - main */}
      <Cone args={[5.0, 3.2, 4]} position={[0, H+0.55+1.6, 0]} rotation={[0, Math.PI/4, 0]} castShadow>
        <meshStandardMaterial color={new THREE.Color(0.10, 0.06, 0.03)} roughness={0.92} />
      </Cone>
      {/* side roofs */}
      <Cone args={[1.7, 1.8, 4]} position={[-W/2-0.7, H*0.7+0.55+0.9, -0.3]} rotation={[0, Math.PI/4, 0]} castShadow>
        <meshStandardMaterial color={new THREE.Color(0.10, 0.06, 0.03)} roughness={0.92} />
      </Cone>
      <Cone args={[1.7, 1.8, 4]} position={[W/2+0.7, H*0.7+0.55+0.9, -0.3]} rotation={[0, Math.PI/4, 0]} castShadow>
        <meshStandardMaterial color={new THREE.Color(0.10, 0.06, 0.03)} roughness={0.92} />
      </Cone>

      {/* Chimney */}
      <Box args={[0.5, 2.1, 0.5]} position={[1.4, H+0.55+1.8, -0.6]} castShadow>
        <meshStandardMaterial color={new THREE.Color(0.16, 0.10, 0.06)} roughness={0.95} />
      </Box>
      <Box args={[0.62, 0.18, 0.62]} position={[1.4, H+0.55+2.95, -0.6]}>
        <meshStandardMaterial color={new THREE.Color(0.14, 0.09, 0.05)} roughness={0.95} />
      </Box>

      {/* Windows front */}
      <WindowGlow position={[-1.8, H*0.62+0.55, -D/2-0.08]} />
      <WindowGlow position={[1.8, H*0.62+0.55, -D/2-0.08]} />
      {/* Upper window - arched */}
      <WindowGlow position={[0, H*0.82+0.55, -D/2-0.08]} width={0.75} height={0.7} />
      {/* Side windows */}
      <WindowGlow position={[-W/2-0.08, H*0.55+0.55, -0.2]} width={0.85} height={0.78} rotation={[0, Math.PI/2, 0]} />
      <WindowGlow position={[W/2+0.08, H*0.55+0.55, -0.2]} width={0.85} height={0.78} rotation={[0, -Math.PI/2, 0]} />

      {/* Climbing vines on facade */}
      <Vine position={[-W/2+0.35, 0.55, -D/2+0.12]} height={H*0.85} spread={0.8} />
      <Vine position={[W/2-0.35, 0.55, -D/2+0.12]} height={H*0.85} spread={0.8} />
      <Vine position={[-0.9, 0.55, -D/2+0.05]} height={H*0.6} spread={0.5} />
      <Vine position={[0.9, 0.55, -D/2+0.05]} height={H*0.6} spread={0.5} />

      {/* Door */}
      <Door isOpen={isOpen} />
      <Steps />

      {/* Arch entry lanterns */}
      <Lantern position={[-1.05, 0.55, -D/2-0.2]} height={2.4} intensity={2.8} />
      <Lantern position={[1.05, 0.55, -D/2-0.2]} height={2.4} intensity={2.8} />

      {/* Hanging chain lantern above door */}
      <group position={[0, H*0.55+0.55, -D/2-0.12]}>
        <Cylinder args={[0.03, 0.03, 0.5, 4]} position={[0, 0.25, 0]}>
          <meshStandardMaterial color="#1a0e06" roughness={0.8} />
        </Cylinder>
        <group position={[0, -0.06, 0]}>
          <Cylinder args={[0.16, 0.13, 0.38, 8]}>
            <meshStandardMaterial color={LANTERN_COL} emissive={WARM_GOLD} emissiveIntensity={4.0} transparent opacity={0.9} />
          </Cylinder>
          <pointLight color={LANTERN_COL} intensity={3.5} distance={8} decay={2} />
        </group>
      </group>

      {/* Door warmth glow on ground */}
      <pointLight color={new THREE.Color(1.2, 0.55, 0.08)} intensity={isOpen ? 8 : 1.8} distance={10} decay={2} position={[0, 0.2, -D/2+0.3]} />
    </group>
  );
}

// ─── Mailbox ──────────────────────────────────────────────────
function Mailbox({ position }) {
  return (
    <group position={position}>
      <Cylinder args={[0.04, 0.04, 1.0, 6]} position={[0, 0.5, 0]} castShadow>
        <meshStandardMaterial color="#1a0e06" roughness={0.85} metalness={0.2} />
      </Cylinder>
      <group position={[0, 1.12, 0]}>
        <Box args={[0.38, 0.26, 0.52]} position={[0, 0, 0]} castShadow>
          <meshStandardMaterial color="#2a1a1a" roughness={0.7} metalness={0.4} />
        </Box>
        {/* arched top */}
        <Cylinder args={[0.19, 0.19, 0.52, 8, 1, false, 0, Math.PI]} position={[0, 0.13, 0]} rotation={[Math.PI/2, 0, 0]}>
          <meshStandardMaterial color="#2a1a1a" roughness={0.7} metalness={0.4} />
        </Cylinder>
      </group>
    </group>
  );
}

// ─── Firefly ─────────────────────────────────────────────────
function Firefly({ origin, speed, radius, phase, blinkSpeed, blinkPhase }) {
  const ref = useRef();
  const lightRef = useRef();
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    const blink = Math.sin(t * blinkSpeed + blinkPhase);
    const visible = blink > 0.2;
    if (ref.current) {
      ref.current.position.set(
        origin[0] + Math.cos(t * speed + phase) * radius,
        origin[1] + Math.sin(t * speed * 0.7 + phase) * 0.5 + Math.sin(t * 0.4 + phase*1.3)*0.3,
        origin[2] + Math.sin(t * speed + phase + 1.4) * radius * 0.6
      );
      ref.current.visible = visible;
    }
    if (lightRef.current) {
      lightRef.current.intensity = visible ? (1.8 + blink * 0.8) : 0;
    }
  });
  return (
    <group ref={ref}>
      <Sphere args={[0.055, 6, 4]}>
        <meshStandardMaterial
          color={new THREE.Color(0.7, 1.0, 0.4)}
          emissive={new THREE.Color(0.5, 1.0, 0.3)}
          emissiveIntensity={5}
        />
      </Sphere>
      <pointLight ref={lightRef} color={new THREE.Color(0.6, 1.0, 0.3)} intensity={1.5} distance={2.5} decay={2} />
    </group>
  );
}

function Fireflies({ count = 48 }) {
  const flies = useMemo(() => Array.from({length: count}, (_, i) => {
    const angle = (i/count) * Math.PI * 2;
    const r = 2.5 + Math.random() * 12;
    return {
      origin: [
        Math.cos(angle)*r + (Math.random()-0.5)*3,
        0.5 + Math.random() * 3.5,
        Math.sin(angle)*r * 0.6 + 2 + Math.random()*6,
      ],
      speed: 0.28 + Math.random() * 0.45,
      radius: 0.4 + Math.random() * 1.3,
      phase: Math.random() * Math.PI * 2,
      blinkSpeed: 0.9 + Math.random() * 1.6,
      blinkPhase: Math.random() * Math.PI * 2,
    };
  }), [count]);
  return (
    <group>
      {flies.map((f, i) => <Firefly key={i} {...f} />)}
    </group>
  );
}

// ─── Floating dust motes ─────────────────────────────────────
function DustMotes() {
  return (
    <Sparkles
      count={140}
      scale={[22, 8, 18]}
      position={[0, 2.5, 2]}
      size={0.8}
      speed={0.12}
      opacity={0.22}
      color={new THREE.Color(1.0, 0.75, 0.3)}
      noise={0.5}
    />
  );
}

// ─── Smoke from chimney ──────────────────────────────────────
function ChimneySmoke() {
  const ref = useRef();
  useFrame((s) => {
    if (ref.current) {
      ref.current.position.y = 7.6 + Math.sin(s.clock.elapsedTime * 0.5) * 0.15;
      ref.current.rotation.y += 0.003;
    }
  });
  return (
    <group position={[1.4, 7.2, -5.6]}>
      {Array.from({length: 5}, (_, i) => (
        <Sphere key={i} args={[0.18 + i*0.09, 6, 5]} position={[
          Math.sin(i*1.2)*0.15,
          i * 0.35,
          Math.cos(i*0.9)*0.12
        ]}>
          <meshStandardMaterial
            color={new THREE.Color(0.4, 0.28, 0.18)}
            transparent
            opacity={0.12 - i*0.018}
            roughness={1}
          />
        </Sphere>
      ))}
    </group>
  );
}

// ─── Living Room (interior, behind front door) ─────────────────
// World-space anchor: the door threshold sits at x=0, z=-7.51 (cottage
// group at [0,0,-5] + door local z=-2.51), facing -Z toward the camera.
// "Inside" the house continues further in -Z. This room is a self-contained
// bubble placed just behind the doorway so the transition reads as one
// continuous space without needing to match the exterior shell's footprint.
const ROOM_DOOR_Z = -7.51;
const ROOM_DEPTH = 6.2;
const ROOM_WIDTH = 6.6;
const ROOM_HEIGHT = 3.4;
const ROOM_CENTER_Z = ROOM_DOOR_Z - ROOM_DEPTH / 2 - 0.05;

const WOOD_DARK     = new THREE.Color(0.14, 0.08, 0.04);
const PLASTER_WALL  = new THREE.Color(0.26, 0.18, 0.13);
const FIRE_COL      = new THREE.Color(1.6, 0.55, 0.08);

function WoodFloor() {
  const planks = useMemo(() => {
    const arr = [];
    const plankW = 0.42;
    const count = Math.ceil(ROOM_WIDTH / plankW);
    for (let i = 0; i < count; i++) {
      const x = -ROOM_WIDTH / 2 + i * plankW + plankW / 2;
      const shade = 0.16 + Math.random() * 0.08;
      arr.push({ x, shade });
    }
    return arr;
  }, []);
  return (
    <group position={[0, 0.001, ROOM_CENTER_Z]}>
      {planks.map((p, i) => (
        <Box key={i} args={[0.4, 0.02, ROOM_DEPTH]} position={[p.x, 0, 0]} receiveShadow>
          <meshStandardMaterial color={new THREE.Color(p.shade, p.shade * 0.62, p.shade * 0.32)} roughness={0.65} metalness={0.04} />
        </Box>
      ))}
    </group>
  );
}

function RoomShell() {
  // Walls + ceiling, built as an open box (no front wall, so the door
  // threshold reads straight through) so it doesn't fight the exterior.
  return (
    <group position={[0, 0, ROOM_CENTER_Z]}>
      {/* back wall */}
      <Box args={[ROOM_WIDTH, ROOM_HEIGHT, 0.15]} position={[0, ROOM_HEIGHT / 2, -ROOM_DEPTH / 2]} receiveShadow>
        <meshStandardMaterial color={PLASTER_WALL} roughness={0.92} />
      </Box>
      {/* left wall */}
      <Box args={[0.15, ROOM_HEIGHT, ROOM_DEPTH]} position={[-ROOM_WIDTH / 2, ROOM_HEIGHT / 2, 0]} receiveShadow>
        <meshStandardMaterial color={PLASTER_WALL} roughness={0.92} />
      </Box>
      {/* right wall */}
      <Box args={[0.15, ROOM_HEIGHT, ROOM_DEPTH]} position={[ROOM_WIDTH / 2, ROOM_HEIGHT / 2, 0]} receiveShadow>
        <meshStandardMaterial color={PLASTER_WALL} roughness={0.92} />
      </Box>
      {/* ceiling */}
      <Box args={[ROOM_WIDTH, 0.15, ROOM_DEPTH]} position={[0, ROOM_HEIGHT, 0]} receiveShadow>
        <meshStandardMaterial color={new THREE.Color(0.12, 0.08, 0.05)} roughness={0.95} />
      </Box>
      {/* ceiling beams */}
      {[-1.8, 0, 1.8].map((z, i) => (
        <Box key={i} args={[ROOM_WIDTH - 0.3, 0.14, 0.18]} position={[0, ROOM_HEIGHT - 0.1, z]} castShadow>
          <meshStandardMaterial color={WOOD_DARK} roughness={0.85} />
        </Box>
      ))}
    </group>
  );
}

function Fireplace({ position }) {
  const flameRef = useRef();
  const lightRef = useRef();
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (flameRef.current) {
      flameRef.current.scale.y = 1 + Math.sin(t * 9) * 0.08 + Math.sin(t * 5.3) * 0.05;
      flameRef.current.rotation.y = Math.sin(t * 1.7) * 0.15;
    }
    if (lightRef.current) {
      lightRef.current.intensity = 6 + Math.sin(t * 11) * 1.2 + Math.sin(t * 7) * 0.8;
    }
  });
  return (
    <group position={position}>
      {/* stone surround */}
      <Box args={[1.7, 1.5, 0.4]} position={[0, 0.75, -0.1]} castShadow receiveShadow>
        <meshStandardMaterial color={new THREE.Color(0.22, 0.18, 0.15)} roughness={0.95} />
      </Box>
      {/* firebox opening (dark recess) */}
      <Box args={[1.0, 0.9, 0.3]} position={[0, 0.55, 0.08]}>
        <meshStandardMaterial color="#0a0604" roughness={1} />
      </Box>
      {/* mantel */}
      <Box args={[2.0, 0.14, 0.5]} position={[0, 1.52, -0.05]} castShadow>
        <meshStandardMaterial color={WOOD_DARK} roughness={0.7} />
      </Box>
      {/* logs */}
      <Cylinder args={[0.06, 0.06, 0.7, 6]} position={[-0.12, 0.18, 0.1]} rotation={[0, 0, Math.PI / 2]}>
        <meshStandardMaterial color="#3a2410" roughness={0.9} />
      </Cylinder>
      <Cylinder args={[0.06, 0.06, 0.7, 6]} position={[0.1, 0.24, 0.12]} rotation={[0, 0.3, Math.PI / 2]}>
        <meshStandardMaterial color="#2e1c0c" roughness={0.9} />
      </Cylinder>
      {/* flame */}
      <group ref={flameRef} position={[0, 0.35, 0.12]}>
        <Sphere args={[0.18, 8, 8]} position={[0, 0.1, 0]}>
          <meshStandardMaterial color={FIRE_COL} emissive={FIRE_COL} emissiveIntensity={4} transparent opacity={0.85} />
        </Sphere>
        <Sphere args={[0.1, 8, 8]} position={[0, 0.28, 0]}>
          <meshStandardMaterial color="#ffcc66" emissive="#ffcc66" emissiveIntensity={5} transparent opacity={0.8} />
        </Sphere>
      </group>
      <pointLight ref={lightRef} color={FIRE_COL} intensity={6} distance={6.5} decay={2} position={[0, 0.5, 0.3]} castShadow />
    </group>
  );
}

function Sofa({ position, rotation = [0, 0, 0] }) {
  const fabric = new THREE.Color(0.32, 0.18, 0.13);
  return (
    <group position={position} rotation={rotation}>
      {/* base */}
      <RoundedBox args={[2.0, 0.42, 0.85]} radius={0.06} position={[0, 0.3, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={fabric} roughness={0.95} />
      </RoundedBox>
      {/* back cushion */}
      <RoundedBox args={[2.0, 0.55, 0.22]} radius={0.06} position={[0, 0.62, -0.32]} castShadow>
        <meshStandardMaterial color={fabric} roughness={0.95} />
      </RoundedBox>
      {/* arms */}
      <RoundedBox args={[0.22, 0.5, 0.85]} radius={0.06} position={[-0.9, 0.45, 0]} castShadow>
        <meshStandardMaterial color={fabric} roughness={0.95} />
      </RoundedBox>
      <RoundedBox args={[0.22, 0.5, 0.85]} radius={0.06} position={[0.9, 0.45, 0]} castShadow>
        <meshStandardMaterial color={fabric} roughness={0.95} />
      </RoundedBox>
      {/* seat cushions */}
      {[-0.5, 0.5].map((x, i) => (
        <RoundedBox key={i} args={[0.85, 0.16, 0.78]} radius={0.05} position={[x, 0.55, 0.02]} castShadow>
          <meshStandardMaterial color={new THREE.Color(0.36, 0.21, 0.15)} roughness={0.92} />
        </RoundedBox>
      ))}
      {/* legs */}
      {[[-0.85, -0.3], [0.85, -0.3], [-0.85, 0.32], [0.85, 0.32]].map(([x, z], i) => (
        <Cylinder key={i} args={[0.03, 0.03, 0.18, 6]} position={[x, 0.09, z]} castShadow>
          <meshStandardMaterial color={WOOD_DARK} roughness={0.7} />
        </Cylinder>
      ))}
    </group>
  );
}

function CoffeeTable({ position }) {
  return (
    <group position={position}>
      <RoundedBox args={[1.0, 0.06, 0.6]} radius={0.02} position={[0, 0.38, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={WOOD_DARK} roughness={0.45} metalness={0.05} />
      </RoundedBox>
      {[[-0.42, -0.24], [0.42, -0.24], [-0.42, 0.24], [0.42, 0.24]].map(([x, z], i) => (
        <Cylinder key={i} args={[0.025, 0.025, 0.36, 6]} position={[x, 0.18, z]} castShadow>
          <meshStandardMaterial color={WOOD_DARK} roughness={0.6} />
        </Cylinder>
      ))}
      {/* small book stack on top */}
      <Box args={[0.22, 0.04, 0.16]} position={[0.2, 0.43, 0.1]} castShadow>
        <meshStandardMaterial color="#6b2e1e" roughness={0.8} />
      </Box>
      <Box args={[0.19, 0.04, 0.14]} position={[0.2, 0.47, 0.1]} castShadow>
        <meshStandardMaterial color="#3a4a2e" roughness={0.8} />
      </Box>
    </group>
  );
}

function Bookshelf({ position, rotation = [0, 0, 0] }) {
  const shelves = 4;
  const W = 1.3, H = 2.0, D = 0.32;
  const bookColors = ["#6b2e1e", "#3a4a2e", "#4a3a6e", "#7a5a1e", "#2e4a5a", "#5a2e3a"];
  const shelfBooks = useMemo(() => Array.from({ length: shelves }, () =>
    Array.from({ length: 8 }, () => ({
      w: 0.06 + Math.random() * 0.035,
      h: 0.24 + Math.random() * 0.1,
      color: bookColors[Math.floor(Math.random() * bookColors.length)],
    }))
  ), []);
  return (
    <group position={position} rotation={rotation}>
      {/* frame */}
      <Box args={[W, H, D]} position={[0, H / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={WOOD_DARK} roughness={0.75} />
      </Box>
      {Array.from({ length: shelves }, (_, i) => {
        const y = (i + 1) * (H / (shelves + 1));
        const books = shelfBooks[i];
        let cursor = -W / 2 + 0.1;
        return (
          <group key={i} position={[0, y, D / 2 - 0.06]}>
            {books.map((b, bi) => {
              const x = cursor + b.w / 2;
              cursor += b.w + 0.012;
              return (
                <Box key={bi} args={[b.w, b.h, 0.14]} position={[x, b.h / 2 + 0.02, 0]} castShadow>
                  <meshStandardMaterial color={b.color} roughness={0.85} />
                </Box>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

function Rug({ position }) {
  return (
    <group position={[position[0], 0.012, position[2]]}>
      <Cylinder args={[1.3, 1.3, 0.015, 24]} receiveShadow>
        <meshStandardMaterial color={new THREE.Color(0.42, 0.13, 0.1)} roughness={1} />
      </Cylinder>
      <Cylinder args={[1.05, 1.05, 0.018, 24]} position={[0, 0.005, 0]} receiveShadow>
        <meshStandardMaterial color={new THREE.Color(0.5, 0.32, 0.12)} roughness={1} />
      </Cylinder>
    </group>
  );
}

function IndoorPlant({ position, scale = 1 }) {
  const fronds = useMemo(() => Array.from({ length: 6 }, (_, i) => ({
    a: (i / 6) * Math.PI * 2,
    h: 0.55 + Math.random() * 0.35,
  })), []);
  return (
    <group position={position} scale={scale}>
      <Cylinder args={[0.16, 0.13, 0.3, 10]} position={[0, 0.15, 0]} castShadow>
        <meshStandardMaterial color="#5a3420" roughness={0.85} />
      </Cylinder>
      {fronds.map((f, i) => (
        <group key={i} position={[0, 0.3, 0]} rotation={[0, f.a, 0]}>
          <Cylinder args={[0.012, 0.018, f.h, 4]} position={[0, f.h / 2, 0]} rotation={[0.25, 0, 0]}>
            <meshStandardMaterial color="#2a4018" roughness={1} />
          </Cylinder>
          <Sphere args={[0.13, 6, 5]} position={[0, f.h * 0.92, 0.06]} scale={[1, 0.5, 1.6]}>
            <meshStandardMaterial color={new THREE.Color().setHSL(0.30, 0.5, 0.16 + Math.random() * 0.05)} roughness={1} />
          </Sphere>
        </group>
      ))}
    </group>
  );
}

function LivingRoom() {
  return (
    <group>
      <RoomShell />
      <WoodFloor />
      <Rug position={[0, 0, ROOM_CENTER_Z + 0.4]} />

      <Fireplace position={[0, 0, ROOM_CENTER_Z - ROOM_DEPTH / 2 + 0.25]} />

      <Sofa position={[-0.1, 0, ROOM_CENTER_Z + 1.15]} rotation={[0, Math.PI, 0]} />
      <CoffeeTable position={[-0.1, 0, ROOM_CENTER_Z + 0.45]} />

      <Bookshelf position={[ROOM_WIDTH / 2 - 0.25, 0, ROOM_CENTER_Z - 0.6]} rotation={[0, -Math.PI / 2, 0]} />

      <IndoorPlant position={[-ROOM_WIDTH / 2 + 0.45, 0, ROOM_CENTER_Z + 1.9]} scale={1.1} />
      <IndoorPlant position={[ROOM_WIDTH / 2 - 0.45, 0, ROOM_CENTER_Z + 1.9]} scale={0.85} />

      {/* warm ambient room lighting */}
      <pointLight color={new THREE.Color(1.3, 0.7, 0.3)} intensity={2.2} distance={9} decay={2} position={[0, 2.2, ROOM_CENTER_Z + 0.5]} />
      <pointLight color={new THREE.Color(1.1, 0.6, 0.25)} intensity={1.4} distance={6} decay={2} position={[ROOM_WIDTH / 2 - 0.8, 1.8, ROOM_CENTER_Z - 0.6]} />
      <ambientLight color={new THREE.Color(0.25, 0.14, 0.08)} intensity={0.5} />
    </group>
  );
}

// ─── Cinematic Camera ─────────────────────────────────────────
function CinematicCamera({ isEntering, onEnterComplete }) {
  const { camera } = useThree();
  const t = useRef(0);
  const enterT = useRef(0);
  const interiorT = useRef(0);
  const phase = useRef("approach"); // approach → idle → entering → interior

  useEffect(() => {
    camera.position.set(0, 4.2, 32);
    camera.lookAt(0, 3.0, 0);
  }, [camera]);

  useFrame((_, dt) => {
    const clampedDt = Math.min(dt, 0.05);

    if (phase.current === "approach") {
      t.current = Math.min(t.current + clampedDt * 0.028, 1);
      const ease = easeInOut(t.current);
      const startZ = 32, endZ = 10.5;
      const startY = 4.2, endY = 3.8;
      camera.position.x = Math.sin(t.current * Math.PI * 0.4) * 0.3;
      camera.position.y = startY + (endY - startY) * ease + Math.sin(t.current * Math.PI * 2) * 0.08;
      camera.position.z = startZ + (endZ - startZ) * ease;
      camera.lookAt(
        Math.sin(t.current * Math.PI * 0.3) * 0.2,
        3.0 - ease * 0.3,
        -2
      );
      if (t.current >= 1) phase.current = "idle";
    }

    if (phase.current === "idle") {
      const et = Date.now() * 0.0004;
      camera.position.x = Math.sin(et * 0.28) * 0.18;
      camera.position.y = 3.8 + Math.sin(et * 0.42) * 0.08;
      camera.position.z = 10.5 + Math.sin(et * 0.31) * 0.12;
      camera.lookAt(Math.sin(et*0.22)*0.15, 3.0, -2);
    }

    if (phase.current === "entering") {
      enterT.current = Math.min(enterT.current + clampedDt * 0.35, 1);
      const ease = easeInOut(enterT.current);
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0, clampedDt*2);
      camera.position.y = 3.8 + (2.2 - 3.8) * ease;
      camera.position.z = 10.5 + (-0.5 - 10.5) * ease;
      camera.lookAt(0, 2.4, -4);
      if (enterT.current >= 1) phase.current = "interior";
    }

    if (phase.current === "interior") {
      // Continue smoothly through the now-open doorway into the living
      // room, settling on a resting view of the fireplace/sofa area.
      interiorT.current = Math.min(interiorT.current + clampedDt * 0.22, 1);
      const ease = easeInOut(interiorT.current);
      const startY = 2.2, endY = 1.65;
      const startZ = -0.5, endZ = ROOM_CENTER_Z + 1.6;
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0, clampedDt * 1.5);
      camera.position.y = startY + (endY - startY) * ease;
      camera.position.z = startZ + (endZ - startZ) * ease;
      camera.lookAt(0, 1.3, ROOM_CENTER_Z - ROOM_DEPTH / 2 + 0.5);
      if (interiorT.current >= 1 && onEnterComplete) {
        onEnterComplete();
        phase.current = "interiorIdle";
      }
    }

    if (phase.current === "interiorIdle") {
      const et = Date.now() * 0.0003;
      const restZ = ROOM_CENTER_Z + 1.6;
      camera.position.x = Math.sin(et * 0.25) * 0.12;
      camera.position.y = 1.65 + Math.sin(et * 0.4) * 0.04;
      camera.position.z = restZ + Math.sin(et * 0.3) * 0.08;
      camera.lookAt(Math.sin(et * 0.2) * 0.1, 1.3, ROOM_CENTER_Z - ROOM_DEPTH / 2 + 0.5);
    }
  });

  useEffect(() => {
    if (isEntering) phase.current = "entering";
  }, [isEntering]);

  return null;
}

// ─── Overlay UI ───────────────────────────────────────────────
function OverlayUI({ onEnter, entered }) {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 2200);
    return () => clearTimeout(timer);
  }, []);

  const handleEnter = () => {
    setFading(true);
    onEnter();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, pointerEvents: "none",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "flex-end", paddingBottom: "8vh",
      zIndex: 10,
    }}>
      {/* Wordmark */}
      <div style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: "clamp(2.6rem, 5.5vw, 5rem)",
        fontWeight: 300,
        letterSpacing: "0.24em",
        textTransform: "uppercase",
        color: "#f5e0b8",
        textShadow: "0 0 80px rgba(255,180,60,0.35), 0 2px 40px rgba(0,0,0,0.6)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 2.5s ease, transform 2.5s ease",
        marginBottom: "0.45em",
        userSelect: "none",
      }}>
        Memoire
      </div>

      {/* Tagline */}
      <div style={{
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        fontSize: "clamp(0.72rem, 1.3vw, 0.98rem)",
        fontWeight: 300,
        letterSpacing: "0.38em",
        textTransform: "uppercase",
        color: "#c4924a",
        opacity: visible ? 1 : 0,
        transition: "opacity 2s ease 1.4s",
        marginBottom: "3.8em",
        userSelect: "none",
      }}>
        A home for every memory
      </div>

      {/* Enter button */}
      {!fading && (
        <button
          onClick={handleEnter}
          style={{
            pointerEvents: "all",
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: "clamp(0.82rem, 1.4vw, 1.02rem)",
            fontWeight: 400,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: "#f5e0b8",
            background: "transparent",
            border: "1px solid rgba(245,200,110,0.42)",
            padding: "0.95em 3.4em",
            cursor: "pointer",
            opacity: visible ? 1 : 0,
            transition: "opacity 2s ease 2.2s, border-color 0.45s, box-shadow 0.45s, transform 0.3s",
            userSelect: "none",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = "rgba(245,200,110,0.78)";
            e.currentTarget.style.boxShadow = "0 0 50px rgba(245,180,60,0.18), inset 0 0 30px rgba(245,180,60,0.05)";
            e.currentTarget.style.transform = "translateY(-3px)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = "rgba(245,200,110,0.42)";
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          Enter Home
        </button>
      )}

      {/* Entered message */}
      {entered && (
        <div style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: "clamp(1rem, 2.2vw, 1.5rem)",
          fontWeight: 300,
          letterSpacing: "0.18em",
          color: "#f5e0b8",
          textShadow: "0 0 40px rgba(255,180,60,0.4)",
          animation: "fadeIn 1.8s ease forwards",
          textAlign: "center",
        }}>
          Your memories are waiting
        </div>
      )}

      {/* Vignette edges */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at 50% 50%, transparent 38%, rgba(6,2,1,0.62) 100%)",
        zIndex: -1,
      }} />
    </div>
  );
}

// ─── Fade overlay ─────────────────────────────────────────────
function FadeOverlay({ entering, onComplete }) {
  const [opacity, setOpacity] = useState(0);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (entering) {
      // Start fade after camera has moved halfway
      const t1 = setTimeout(() => setOpacity(1), 1800);
      const t2 = setTimeout(() => { setEntered(true); onComplete && onComplete(); }, 3200);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [entering]);

  return (
    <>
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: "#1a0d06",
        opacity, zIndex: 20,
        transition: "opacity 1.8s ease",
      }} />
      {entered && (
        <div style={{
          position: "fixed", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 30,
          animation: "fadeIn 2s ease forwards",
        }}>
          <p style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: "clamp(1.1rem, 2.8vw, 1.8rem)",
            fontWeight: 300,
            letterSpacing: "0.22em",
            color: "#f5e0b8",
            textShadow: "0 0 60px rgba(255,160,40,0.45)",
            textAlign: "center",
          }}>
            Your memories are waiting inside
          </p>
        </div>
      )}
    </>
  );
}

// ─── Scene ────────────────────────────────────────────────────
function Scene({ isEntering, onEnterComplete }) {
  return (
    <>
      <SkyDome />
      <CinematicCamera isEntering={isEntering} onEnterComplete={onEnterComplete} />

      {/* Global lighting */}
      <ambientLight color={new THREE.Color(0.28, 0.12, 0.06)} intensity={1.1} />

      {/* Sunset key light - warm orange from upper left */}
      <directionalLight
        color={new THREE.Color(1.0, 0.50, 0.16)}
        intensity={2.2}
        position={[-18, 22, 18]}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={80}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-bias={-0.001}
      />
      {/* Cool sky fill from above */}
      <directionalLight color={new THREE.Color(0.18, 0.08, 0.12)} intensity={0.6} position={[0, 20, -10]} />
      {/* Warm bounce from ground */}
      <hemisphereLight color={new THREE.Color(0.35, 0.16, 0.05)} groundColor={new THREE.Color(0.08, 0.05, 0.02)} intensity={0.8} />

      <Ground />
      <StonePath />
      <Fence side="left" />
      <Fence side="right" />

      {/* Trees - flanking both sides */}
      <CozyTree position={[-6.0, 0, -1]} height={6.5} spread={2.2} hue={0.31} wobble={0.3} />
      <CozyTree position={[-8.5, 0, 4]} height={7.5} spread={2.5} hue={0.30} wobble={-0.4} />
      <CozyTree position={[-10, 0, 9]} height={6} spread={2.0} hue={0.33} wobble={0.6} />
      <CozyTree position={[-7, 0, 14]} height={7} spread={2.3} hue={0.30} wobble={0.2} />
      <CozyTree position={[6.0, 0, -1]} height={6} spread={2.1} hue={0.32} wobble={-0.3} />
      <CozyTree position={[8.5, 0, 4]} height={7} spread={2.4} hue={0.31} wobble={0.5} />
      <CozyTree position={[10.5, 0, 9]} height={6.5} spread={2.2} hue={0.33} wobble={-0.6} />
      <CozyTree position={[7.5, 0, 14]} height={7.5} spread={2.6} hue={0.29} wobble={0.4} />
      {/* Background trees */}
      <CozyTree position={[-14, 0, -3]} height={9} spread={3.0} hue={0.28} wobble={0.1} />
      <CozyTree position={[14, 0, -3]} height={8.5} spread={2.8} hue={0.29} wobble={-0.2} />
      <CozyTree position={[-4, 0, -7]} height={5.5} spread={1.9} hue={0.33} wobble={0.7} />
      <CozyTree position={[4, 0, -7]} height={5} spread={1.8} hue={0.32} wobble={-0.5} />

      {/* Bushes along path */}
      {[[-2.0,0,2],[2.0,0,2.5],[-2.2,0,6],[2.2,0,6.5],[-2.0,0,10],[2.1,0,10.5],
        [-2.3,0,14],[2.3,0,14],[-3.8,0,4],[3.8,0,4.5],[-4,0,10],[4,0,10]].map(([x,y,z],i)=>(
        <Bush key={i} position={[x,y,z]} scale={0.4 + Math.random()*0.3} />
      ))}

      {/* Flower patches */}
      {[[-1.8,3.5],[-3,7],[1.8,4],[3,7.5],[-1.8,10.5],[1.8,11],
        [-2.8,13],[2.8,13.5],[-1.2,1.5],[1.2,2],[-4.5,6],[4.5,6.5]].map(([x,z],i)=>(
        <FlowerPatch key={i} cx={x} cz={z} count={7+Math.floor(Math.random()*5)} />
      ))}

      {/* Path lanterns */}
      <Lantern position={[-2.2, 0, 3]} intensity={2.0} height={2.6} />
      <Lantern position={[2.2, 0, 3.5]} intensity={2.0} height={2.6} />
      <Lantern position={[-2.4, 0, 8]} intensity={1.8} height={2.5} />
      <Lantern position={[2.4, 0, 8.5]} intensity={1.8} height={2.5} />
      <Lantern position={[-2.5, 0, 14]} intensity={1.5} height={2.4} />
      <Lantern position={[2.5, 0, 14.5]} intensity={1.5} height={2.4} />

      {/* Mailbox near entrance */}
      <Mailbox position={[-2.4, 0, 0.5]} />

      {/* Main cottage */}
      <Cottage isOpen={isEntering} />

      {/* Interior, revealed behind the open front door */}
      <LivingRoom />

      {/* Magic */}
      <Fireflies count={50} />
      <DustMotes />
      <ChimneySmoke />

      {/* Background depth fog glow near horizon */}
      <pointLight color={new THREE.Color(1.0, 0.35, 0.08)} intensity={3} distance={40} decay={1.5} position={[0, 3, -20]} />
    </>
  );
}

// ─── Post processing ──────────────────────────────────────────
function PostFX() {
  return (
    <EffectComposer>
      <Bloom
        intensity={1.8}
        luminanceThreshold={0.35}
        luminanceSmoothing={0.75}
        mipmapBlur
        radius={0.55}
      />
      <Vignette eskil={false} offset={0.28} darkness={0.72} />
      <ToneMapping />
    </EffectComposer>
  );
}

// ─── Root ─────────────────────────────────────────────────────
export default function App() {
  const [isEntering, setIsEntering] = useState(false);
  const [entered, setEntered] = useState(false);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0d0608", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&display=swap');
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { overflow: hidden; }
        button { outline: none; }
        button:focus-visible { outline: 2px solid rgba(245,200,110,0.6); outline-offset: 4px; }
      `}</style>

      <Canvas
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
          outputEncoding: THREE.sRGBEncoding,
        }}
        camera={{ fov: 52, near: 0.1, far: 300, position: [0, 4.2, 32] }}
        style={{ position: "absolute", inset: 0 }}
      >
        <fog attach="fog" args={[FOG_COL.getHexString(), 28, 90]} />
        <Suspense fallback={null}>
          <Scene isEntering={isEntering} onEnterComplete={() => setEntered(true)} />
          <PostFX />
        </Suspense>
      </Canvas>

      <OverlayUI onEnter={() => setIsEntering(true)} entered={entered} />
      <FadeOverlay entering={isEntering} />
    </div>
  );
}
