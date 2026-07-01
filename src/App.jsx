import { useRef, useMemo, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  PointerLockControls,
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

// ─── Demo memory images (base64, resized to 640px for bundle efficiency) ──
// Demo memory images now live in ./memory-images.js and are lazy-loaded
// after first paint (see the dynamic import() in the App component)
// instead of being embedded here as huge inline base64 literals.

// ─── Memory data schema (future-proof) ────────────────────────────────────
// Fields: id, title, date, description, image, audio, video,
//         location (3d world-space), favorite, type
const DEFAULT_MEMORIES = [
  {
    id: "demo-family-001",
    title: "Family Sunset",
    date: "2023-11-12",
    description: "The day Dad finally smiled after months.\nWe laughed until the sun disappeared.",
    image: null, // lazy-loaded shortly after first paint, see App()
    audio: null,
    video: null,
    location: "mantel",
    favorite: true,
    type: "family",
  },
  {
    id: "demo-grad-002",
    title: "Graduation Day",
    date: "2023-05-18",
    description: "I kept thinking I'd fail.\nTurns out...\nI just needed to believe.",
    image: null, // lazy-loaded shortly after first paint, see App()
    audio: null,
    video: null,
    location: "bookshelf",
    favorite: true,
    type: "milestone",
  },
  {
    id: "demo-trip-003",
    title: "Friends Trip",
    date: "2023-08-04",
    description: "No plans.\nNo hotels.\nJust five idiots making memories.",
    image: null, // lazy-loaded shortly after first paint, see App()
    audio: null,
    video: null,
    location: "coffeetable",
    favorite: false,
    type: "travel",
  },
];

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
        {/* castShadow removed: point-light shadows render 6 cube faces
            each, and with 6 lanterns in the scene this was the single
            most expensive shadow cost. The lantern glow itself (light +
            emissive material) is unchanged; only its own shadow-casting
            is disabled — the directional light still casts the primary
            shadows everywhere. */}
        <pointLight ref={glowRef} color={LANTERN_COL} intensity={intensity} distance={7} decay={2} />
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
function Door({ isOpen, onInteract }) {
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
        {/* vertical frame posts — thick wooden surround */}
        <Box args={[0.26, 1.95, 0.24]} position={[-0.58, 0.95, 0]}>
          <meshStandardMaterial color="#2f1d0f" roughness={0.85} />
        </Box>
        <Box args={[0.26, 1.95, 0.24]} position={[0.58, 0.95, 0]}>
          <meshStandardMaterial color="#2f1d0f" roughness={0.85} />
        </Box>
        {/* lintel cap across the top of the frame posts */}
        <Box args={[1.3, 0.18, 0.26]} position={[0, 1.92, 0]}>
          <meshStandardMaterial color="#2f1d0f" roughness={0.85} />
        </Box>
        {/* step threshold */}
        <Box args={[1.4, 0.1, 0.4]} position={[0, -0.05, 0.18]}>
          <meshStandardMaterial color="#2e1e0e" roughness={0.95} />
        </Box>
      </group>

      {/* Door pivot */}
      <group ref={pivotRef} position={[-0.45, 0, -2.51]}>
        <group position={[0.45, 0, 0]}>
          {/* door panel — clickable as a mouse fallback for the E-key interaction */}
          <Box args={[0.88, 1.82, 0.08]} position={[0, 0.91, 0]} castShadow
            onClick={(e) => { e.stopPropagation(); onInteract && onInteract(); }}
            onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
            onPointerOut={(e) => { document.body.style.cursor = "auto"; }}
          >
            <meshStandardMaterial color="#3a2113" roughness={0.7} metalness={0.06} />
          </Box>
          {/* hinge straps — heavy iron detail on the hinge side */}
          <Box args={[0.05, 0.32, 0.1]} position={[-0.41, 1.42, 0.05]} rotation={[0, 0, 0]} castShadow>
            <meshStandardMaterial color="#1c1410" roughness={0.4} metalness={0.85} />
          </Box>
          <Box args={[0.05, 0.32, 0.1]} position={[-0.41, 0.5, 0.05]} castShadow>
            <meshStandardMaterial color="#1c1410" roughness={0.4} metalness={0.85} />
          </Box>
          {/* door panels carved */}
          <Box args={[0.34, 0.52, 0.04]} position={[-0.19, 1.28, 0.04]} castShadow>
            <meshStandardMaterial color="#2c170c" roughness={0.78} />
          </Box>
          <Box args={[0.34, 0.52, 0.04]} position={[0.19, 1.28, 0.04]} castShadow>
            <meshStandardMaterial color="#2c170c" roughness={0.78} />
          </Box>
          <Box args={[0.34, 0.52, 0.04]} position={[-0.19, 0.62, 0.04]} castShadow>
            <meshStandardMaterial color="#2c170c" roughness={0.78} />
          </Box>
          <Box args={[0.34, 0.52, 0.04]} position={[0.19, 0.62, 0.04]} castShadow>
            <meshStandardMaterial color="#2c170c" roughness={0.78} />
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
                  <meshStandardMaterial color="#3a2113" roughness={0.7} />
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

// ─── Front entrance geometry constants ────────────────────────
// The doorway is carved out of the front facade as three pieces (two
// piers + a header) instead of one solid wall slab, so the door sits in
// a real recessed opening rather than overlapping solid geometry.
// Sized to hug the actual frame (posts at ±0.58, half-width 0.13 → outer
// edge ±0.71; lintel cap top at y≈2.10) with only a small architectural
// margin — a real cottage entrance, not a garage opening.
const DOOR_OPEN_W = 1.6;   // frame outer edge (±0.71) + ~0.09 margin each side
const DOOR_OPEN_H = 2.2;   // lintel top (~2.10) + a small margin
const WALL_T       = 0.34; // normal exterior wall thickness — door sits flush in it, no recess
const DOOR_BASE_Y  = 0.55; // foundation top — door threshold sits flush on it

function Steps() {
  const count = 4;
  const totalH = DOOR_BASE_Y;
  const stepH = totalH / count;
  return (
    <group position={[0, 0, -2.2]}>
      {Array.from({ length: count }, (_, i) => (
        <Box key={i} args={[1.7 - i * 0.16, stepH, 0.34]} position={[0, i * stepH + stepH / 2, i * 0.32]} castShadow receiveShadow>
          <meshStandardMaterial color={new THREE.Color(0.22, 0.16, 0.1)} roughness={0.92} />
        </Box>
      ))}
    </group>
  );
}

// ─── Main cottage ────────────────────────────────────────────
function Cottage({ doorOpen, onDoorClick }) {
  const W = ROOM_WIDTH, H = 4.0, D = 5.2;
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

      {/* Front facade — a single flush wall (WALL_T thick, same as any
          normal wall) with a true doorway opening cut directly through it.
          No recessed alcove, no deep duplicate wall mass behind it — the
          door sits right in this thickness and the living room begins
          immediately on the other side, like a real cottage entrance. */}
      {/* left door pier */}
      <Box
        args={[(W - DOOR_OPEN_W)/2, H, WALL_T]}
        position={[-(DOOR_OPEN_W/2 + (W - DOOR_OPEN_W)/4), H/2 + 0.55, -D/2 + WALL_T/2]}
        castShadow receiveShadow
      >
        <primitive object={wallMat} attach="material" />
      </Box>
      {/* right door pier */}
      <Box
        args={[(W - DOOR_OPEN_W)/2, H, WALL_T]}
        position={[DOOR_OPEN_W/2 + (W - DOOR_OPEN_W)/4, H/2 + 0.55, -D/2 + WALL_T/2]}
        castShadow receiveShadow
      >
        <primitive object={wallMat} attach="material" />
      </Box>
      {/* header above the doorway opening */}
      <Box
        args={[DOOR_OPEN_W, H - DOOR_OPEN_H, WALL_T]}
        position={[0, DOOR_OPEN_H + (H - DOOR_OPEN_H)/2 + 0.55, -D/2 + WALL_T/2]}
        castShadow receiveShadow
      >
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

      {/* Climbing vines on facade — outer pair on the far corners, inner
          pair moved onto the new door piers so nothing floats inside the
          open doorway gap. */}
      <Vine position={[-W/2+0.35, 0.55, -D/2+0.12]} height={H*0.85} spread={0.8} />
      <Vine position={[W/2-0.35, 0.55, -D/2+0.12]} height={H*0.85} spread={0.8} />
      <Vine position={[-(DOOR_OPEN_W/2 + 0.25), 0.55, -D/2+0.08]} height={H*0.6} spread={0.5} />
      <Vine position={[DOOR_OPEN_W/2 + 0.25, 0.55, -D/2+0.08]} height={H*0.6} spread={0.5} />

      {/* Door — embedded in the recessed opening, raised onto the
          foundation/threshold so it doesn't sink into the stone base */}
      <group position={[0, DOOR_BASE_Y, 0]}>
        <Door isOpen={doorOpen} onInteract={onDoorClick} />
      </group>
      <Steps />

      {/* Arch entry lanterns */}
      <Lantern position={[-0.85, 0.55, -D/2-0.2]} height={2.4} intensity={2.8} />
      <Lantern position={[0.85, 0.55, -D/2-0.2]} height={2.4} intensity={2.8} />

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
      <pointLight color={new THREE.Color(1.2, 0.55, 0.08)} intensity={doorOpen ? 8 : 1.8} distance={10} decay={2} position={[0, 0.2, -D/2+0.3]} />
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


// ─── PhotoFrame ─────────────────────────────────────────────────────────────
// A framed photo that rests naturally on furniture.
// `flat` = laying horizontally (coffee table). Otherwise vertical (mantel/shelf).
function PhotoFrame({ position, rotation, image, label, width = 0.28, height = 0.22, flat = false }) {
  const texRef = useRef();
  const meshRef = useRef();

  // Load image as Three.js texture from data-URL
  const texture = useMemo(() => {
    if (!image) return null;
    const t = new THREE.TextureLoader().load(image);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [image]);

  const frameDepth = 0.018;
  const matW = width  + 0.028; // frame mat border
  const matH = height + 0.028;
  const frameW = matW + 0.024;
  const frameH = matH + 0.024;

  return (
    <group position={position} rotation={rotation}>
      {/* outer wood frame */}
      <Box args={[frameW, frameH, frameDepth]} castShadow>
        <meshStandardMaterial color={new THREE.Color(0.18, 0.11, 0.06)} roughness={0.78} metalness={0.04} />
      </Box>
      {/* cream mat / border */}
      <Box args={[matW, matH, frameDepth + 0.001]} position={[0, 0, 0.001]}>
        <meshStandardMaterial color={new THREE.Color(0.88, 0.82, 0.72)} roughness={0.95} />
      </Box>
      {/* photo surface */}
      <Plane args={[width, height]} position={[0, 0, frameDepth * 0.5 + 0.002]}>
        {texture ? (
          <meshStandardMaterial map={texture} roughness={0.35} metalness={0.0} />
        ) : (
          <meshStandardMaterial color={new THREE.Color(0.12, 0.09, 0.07)} roughness={0.9} />
        )}
      </Plane>
      {/* thin stand leg for vertical frames */}
      {!flat && (
        <Box args={[0.012, 0.09, 0.08]}
          position={[0, -(frameH / 2 - 0.01), -0.025]}
          rotation={[0.32, 0, 0]}>
          <meshStandardMaterial color={new THREE.Color(0.14, 0.09, 0.05)} roughness={0.85} />
        </Box>
      )}
    </group>
  );
}

// ─── OrganicButterflies ─────────────────────────────────────────────────────
// 1–2 butterflies with organic, non-repeating flight. Each butterfly
// transitions between states: circling, drifting away, hovering, and resting.
function OrganicButterfly({ anchor, seed }) {
  const ref     = useRef();
  const wingL   = useRef();
  const wingR   = useRef();
  const stateRef = useRef("circle"); // circle | drift | hover | rest
  const stateT   = useRef(seed % 7 * 1.3);
  const stateDur  = useRef(4 + (seed % 5));
  const driftTarget = useRef([anchor[0], anchor[1], anchor[2]]);

  // per-butterfly personality offsets derived from seed
  const spd   = 0.38 + (seed % 9) * 0.042;
  const radius = 0.22 + (seed % 5) * 0.06;
  const baseY  = anchor[1];

  useFrame((s, dt) => {
    const t   = s.clock.elapsedTime + seed * 2.37;
    const clampedDt = Math.min(dt, 0.05);
    stateT.current += clampedDt;

    if (stateT.current >= stateDur.current) {
      stateT.current = 0;
      // pick next state with weighted probability
      const r = Math.sin(t * 13.7 + seed) * 0.5 + 0.5; // 0–1 pseudo-random
      if (stateRef.current === "rest") {
        stateRef.current = "circle";
        stateDur.current = 3.5 + r * 3.5;
      } else if (r < 0.35) {
        stateRef.current = "drift";
        stateDur.current = 2.0 + r * 2.5;
        const ang = t * 0.7 + seed;
        driftTarget.current = [
          anchor[0] + Math.cos(ang) * (0.4 + r * 0.5),
          anchor[1] + 0.08 + r * 0.25,
          anchor[2] + Math.sin(ang) * (0.3 + r * 0.4),
        ];
      } else if (r < 0.55) {
        stateRef.current = "rest";
        stateDur.current = 1.2 + r * 2.0;
      } else {
        stateRef.current = "hover";
        stateDur.current = 1.5 + r * 2.0;
      }
    }

    if (!ref.current) return;

    const phase = stateT.current / stateDur.current;

    if (stateRef.current === "circle") {
      const angle = t * spd + seed;
      const wobbleY = Math.sin(t * 1.3 + seed * 0.7) * 0.07;
      const wobbleR = radius + Math.sin(t * 0.8 + seed * 1.1) * 0.08;
      ref.current.position.set(
        anchor[0] + Math.cos(angle) * wobbleR,
        baseY     + wobbleY + Math.sin(t * 0.6 + seed) * 0.05,
        anchor[2] + Math.sin(angle) * wobbleR * 0.7,
      );
    } else if (stateRef.current === "drift") {
      const [tx, ty, tz] = driftTarget.current;
      ref.current.position.x += (tx - ref.current.position.x) * clampedDt * 1.8;
      ref.current.position.y += (ty - ref.current.position.y) * clampedDt * 1.8;
      ref.current.position.z += (tz - ref.current.position.z) * clampedDt * 1.8;
    } else if (stateRef.current === "hover") {
      ref.current.position.x += (anchor[0] - ref.current.position.x) * clampedDt * 1.2;
      ref.current.position.y = baseY + Math.sin(t * 2.1 + seed) * 0.035;
      ref.current.position.z += (anchor[2] - ref.current.position.z) * clampedDt * 1.2;
    } else { // rest — settle gently, barely move
      ref.current.position.y = anchor[1] - 0.04 + Math.sin(t * 0.55 + seed) * 0.008;
    }

    // Wing flap — slows during rest/hover
    const flapSpd = stateRef.current === "rest" ? 1.2 : stateRef.current === "hover" ? 6 : 14;
    const flapAmp = stateRef.current === "rest" ? 0.1 : 0.52;
    const flapAngle = Math.sin(t * flapSpd) * flapAmp;
    if (wingL.current) wingL.current.rotation.y =  flapAngle;
    if (wingR.current) wingR.current.rotation.y = -flapAngle;

    // body faces direction of travel when circling
    if (stateRef.current === "circle") {
      ref.current.rotation.y = t * spd + seed + Math.PI / 2;
    }
  });

  // Warm amber colour for the butterfly — matches the room palette
  const wingCol  = new THREE.Color(0.78, 0.42, 0.08);
  const wingCol2 = new THREE.Color(0.55, 0.25, 0.04);

  return (
    <group ref={ref} position={anchor}>
      {/* body */}
      <Cylinder args={[0.008, 0.006, 0.05, 5]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color={new THREE.Color(0.15, 0.09, 0.04)} roughness={0.9} />
      </Cylinder>
      {/* left wings */}
      <group ref={wingL} position={[-0.001, 0, 0]}>
        <Plane args={[0.055, 0.04]} position={[-0.027, 0.005, 0]} rotation={[0, 0, 0.15]}>
          <meshStandardMaterial color={wingCol} side={THREE.DoubleSide} transparent opacity={0.88}
            emissive={wingCol} emissiveIntensity={0.25} />
        </Plane>
        <Plane args={[0.038, 0.028]} position={[-0.019, -0.018, 0]} rotation={[0, 0, 0.35]}>
          <meshStandardMaterial color={wingCol2} side={THREE.DoubleSide} transparent opacity={0.82}
            emissive={wingCol2} emissiveIntensity={0.18} />
        </Plane>
      </group>
      {/* right wings */}
      <group ref={wingR} position={[0.001, 0, 0]}>
        <Plane args={[0.055, 0.04]} position={[0.027, 0.005, 0]} rotation={[0, 0, -0.15]}>
          <meshStandardMaterial color={wingCol} side={THREE.DoubleSide} transparent opacity={0.88}
            emissive={wingCol} emissiveIntensity={0.25} />
        </Plane>
        <Plane args={[0.038, 0.028]} position={[0.019, -0.018, 0]} rotation={[0, 0, -0.35]}>
          <meshStandardMaterial color={wingCol2} side={THREE.DoubleSide} transparent opacity={0.82}
            emissive={wingCol2} emissiveIntensity={0.18} />
        </Plane>
      </group>
    </group>
  );
}

function OrganicButterflies({ anchor, count = 2, seed = 0 }) {
  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <OrganicButterfly key={i} anchor={anchor} seed={seed + i * 11} />
      ))}
    </group>
  );
}

// ─── DigitalTV ──────────────────────────────────────────────────────────────
// Wall-mounted flat-panel TV that acts as a digital photo frame.
// Cycles through available memory images with a crossfade every 8–10 seconds.
// Falls back to a tasteful "Memoire" idle screen when memories is empty.
function DigitalTV({ position, memories = [] }) {
  const meshA = useRef();
  const meshB = useRef();
  const idxRef   = useRef(0);
  const timerRef = useRef(0);
  const fadeRef  = useRef(0);  // 0 = A visible, 1 = B visible
  const crossRef = useRef(0);  // 0–1 crossfade progress
  const fadingRef = useRef(false);

  const CYCLE = 9; // seconds between transitions
  const FADE  = 1.2; // crossfade duration in seconds

  const imagesWithMemory = useMemo(() =>
    memories.filter((m) => m.image).map((m) => m.image),
  [memories]);

  const textures = useMemo(() => {
    const imgs = imagesWithMemory.length > 0 ? imagesWithMemory : [null];
    return imgs.map((src) => {
      if (!src) return null;
      const t = new THREE.TextureLoader().load(src);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    });
  }, [imagesWithMemory]);

  // Idle canvas texture for when there are no images
  const idleTex = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 288;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, 0, 288);
    grad.addColorStop(0, "#1a0d1a");
    grad.addColorStop(1, "#0d0608");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 288);
    ctx.fillStyle = "rgba(245,224,184,0.22)";
    ctx.font = "italic 48px serif";
    ctx.textAlign = "center";
    ctx.fillText("Memoire", 256, 160);
    ctx.fillStyle = "rgba(196,146,74,0.35)";
    ctx.font = "16px serif";
    ctx.fillText("a home for every memory", 256, 200);
    const t = new THREE.CanvasTexture(canvas);
    return t;
  }, []);

  useFrame((_, dt) => {
    const clampedDt = Math.min(dt, 0.05);
    timerRef.current += clampedDt;

    if (!fadingRef.current && timerRef.current >= CYCLE) {
      fadingRef.current = true;
      crossRef.current  = 0;
      timerRef.current  = 0;
      // pre-load next texture into the off-screen mesh
      const nextIdx = (idxRef.current + 1) % Math.max(textures.length, 1);
      idxRef.current = nextIdx;
    }

    if (fadingRef.current) {
      crossRef.current += clampedDt / FADE;
      const t = Math.min(crossRef.current, 1);
      // A fades out, B fades in (or vice versa depending on fadeRef)
      if (meshA.current) meshA.current.material.opacity = fadeRef.current === 0 ? 1 - t : t;
      if (meshB.current) meshB.current.material.opacity = fadeRef.current === 0 ? t     : 1 - t;
      if (t >= 1) {
        fadingRef.current = false;
        fadeRef.current   = 1 - fadeRef.current;
      }
    }
  });

  const currentTex = textures[idxRef.current % Math.max(textures.length, 1)] ?? idleTex;
  const nextIdx    = (idxRef.current + 1) % Math.max(textures.length, 1);
  const nextTex    = textures[nextIdx] ?? idleTex;

  // TV dimensions — 16:9, ~70cm wide
  const TW = 0.72, TH = 0.405, TD = 0.028;
  const BEZEL = 0.022;

  return (
    <group position={position}>
      {/* mount bracket */}
      <Box args={[0.06, 0.12, 0.035]} position={[0, -TH / 2 - 0.04, -0.012]}>
        <meshStandardMaterial color="#111111" roughness={0.5} metalness={0.6} />
      </Box>
      {/* outer bezel */}
      <Box args={[TW + BEZEL * 2, TH + BEZEL * 2, TD]} castShadow>
        <meshStandardMaterial color="#0e0e0e" roughness={0.35} metalness={0.55} />
      </Box>
      {/* screen A */}
      <Plane ref={meshA} args={[TW, TH]} position={[0, 0, TD / 2 + 0.001]}>
        <meshStandardMaterial
          map={fadeRef.current === 0 ? currentTex : nextTex}
          emissiveMap={fadeRef.current === 0 ? currentTex : nextTex}
          emissive={new THREE.Color(0.95, 0.9, 0.85)}
          emissiveIntensity={0.55}
          transparent opacity={1}
          roughness={0.1} metalness={0}
        />
      </Plane>
      {/* screen B (cross-fade layer) */}
      <Plane ref={meshB} args={[TW, TH]} position={[0, 0, TD / 2 + 0.002]}>
        <meshStandardMaterial
          map={fadeRef.current === 0 ? nextTex : currentTex}
          emissiveMap={fadeRef.current === 0 ? nextTex : currentTex}
          emissive={new THREE.Color(0.95, 0.9, 0.85)}
          emissiveIntensity={0.55}
          transparent opacity={0}
          roughness={0.1} metalness={0}
        />
      </Plane>
      {/* screen glow cast on wall */}
      <pointLight color={new THREE.Color(0.9, 0.82, 0.75)} intensity={0.45} distance={1.8} decay={2} position={[0, 0, 0.15]} />
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

// ─── 3-D anchor positions for each memory in world space ──────────────────
// Each maps a memory `location` key to the world-position where the photo
// frame sits and the nearby-proximity sphere the player walks into.
const MEMORY_ANCHORS = {
  mantel:      { pos: [0,                     1.64, ROOM_CENTER_Z - ROOM_DEPTH / 2 + 0.28], range: 2.2 },
  bookshelf:   { pos: [ROOM_WIDTH / 2 - 0.28, 1.52, ROOM_CENTER_Z - 0.6],                   range: 2.0 },
  coffeetable: { pos: [-0.1,                  0.50, ROOM_CENTER_Z + 0.45],                   range: 1.8 },
};

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
      {/* castShadow removed here too, same reasoning as the lanterns —
          the flicker/glow is unaffected, only the (barely visible, since
          the firebox is a small recessed opening) shadow cast by this
          light is disabled. */}
      <pointLight ref={lightRef} color={FIRE_COL} intensity={6} distance={6.5} decay={2} position={[0, 0.5, 0.3]} />
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

function LivingRoom({ memories = DEFAULT_MEMORIES }) {
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
      <pointLight
        color={new THREE.Color(1.3, 0.7, 0.3)}
        intensity={2.2}
        distance={9}
        decay={2}
        position={[0, 2.2, ROOM_CENTER_Z + 0.5]}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0015}
      />
      <pointLight color={new THREE.Color(1.1, 0.6, 0.25)} intensity={1.4} distance={6} decay={2} position={[ROOM_WIDTH / 2 - 0.8, 1.8, ROOM_CENTER_Z - 0.6]} />
      {/* low warm fill near the hearth so the fireplace reads as the room's
          dominant light source rather than being flattened by exterior ambient */}
      <pointLight color={new THREE.Color(1.5, 0.55, 0.18)} intensity={1.1} distance={5} decay={2} position={[0, 0.9, ROOM_CENTER_Z - ROOM_DEPTH / 2 + 1.4]} />
      <ambientLight color={new THREE.Color(0.2, 0.11, 0.06)} intensity={0.32} />

      {/* ── Physical memory objects ── */}
      {/* Family photo on the fireplace mantel */}
      <PhotoFrame
        position={[0, 1.68, ROOM_CENTER_Z - ROOM_DEPTH / 2 + 0.22]}
        rotation={[0, 0, 0]}
        image={DEFAULT_MEMORIES[0].image}
        label={DEFAULT_MEMORIES[0].title}
        width={0.32} height={0.26}
      />
      <OrganicButterflies
        anchor={[0, 1.9, ROOM_CENTER_Z - ROOM_DEPTH / 2 + 0.55]}
        count={2}
        seed={0}
      />

      {/* Graduation photo on top bookshelf shelf */}
      <PhotoFrame
        position={[ROOM_WIDTH / 2 - 0.3, 1.56, ROOM_CENTER_Z - 0.55]}
        rotation={[0, Math.PI / 2, 0]}
        image={DEFAULT_MEMORIES[1].image}
        label={DEFAULT_MEMORIES[1].title}
        width={0.28} height={0.22}
      />
      <OrganicButterflies
        anchor={[ROOM_WIDTH / 2 - 0.8, 1.75, ROOM_CENTER_Z - 0.55]}
        count={2}
        seed={7}
      />

      {/* Friends trip photo casually on coffee table */}
      <PhotoFrame
        position={[-0.1, 0.44, ROOM_CENTER_Z + 0.44]}
        rotation={[-0.18, 0.25, 0.06]}
        image={DEFAULT_MEMORIES[2].image}
        label={DEFAULT_MEMORIES[2].title}
        width={0.26} height={0.20}
        flat
      />
      <OrganicButterflies
        anchor={[-0.1, 0.85, ROOM_CENTER_Z + 0.44]}
        count={1}
        seed={13}
      />

      {/* Digital TV above fireplace */}
      <DigitalTV
        position={[0, 2.15, ROOM_CENTER_Z - ROOM_DEPTH / 2 + 0.14]}
        memories={memories}
      />
    </group>
  );
}

// ─── Cinematic Camera ─────────────────────────────────────────
function CinematicCamera({ isEntering, onEnterComplete }) {
  const { camera } = useThree();
  const t = useRef(0);
  const enterT = useRef(0);
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
      // Walk through the actual front doorway and stop just inside the
      // threshold — the scripted camera no longer flies all the way to
      // the fireplace. Free look takes over from here.
      enterT.current = Math.min(enterT.current + clampedDt * 0.32, 1);
      const ease = easeInOut(enterT.current);
      const startY = 3.8, endY = 1.65;
      const startZ = 10.5, endZ = ROOM_DOOR_Z - 0.6; // just past the threshold
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0, clampedDt * 2);
      camera.position.y = startY + (endY - startY) * ease;
      camera.position.z = startZ + (endZ - startZ) * ease;
      camera.lookAt(0, 1.5, ROOM_DOOR_Z - 3.5);
      if (enterT.current >= 1) {
        phase.current = "freeLook";
        if (onEnterComplete) onEnterComplete();
      }
    }

    // "freeLook": scripted camera stops touching position/rotation entirely
    // from here on — FirstPersonController (mounted once freeLook begins)
    // owns the camera so the user can walk and look around naturally.
  });

  useEffect(() => {
    if (isEntering) phase.current = "entering";
  }, [isEntering]);

  return null;
}

// ─── First-person walking controller ───────────────────────────
// Mouse look via PointerLockControls + manual WASD movement with simple
// AABB collision against the room walls, furniture, the garden bounds and
// the exterior front wall. Y is locked to eye height — no flying, no
// teleporting; the player walks themselves there, in both directions.
const EYE_HEIGHT = 1.65;
const PLAYER_RADIUS = 0.32;
const WALK_SPEED = 2.6; // m/s, cinematic/calm pace
const WALK_ACCEL = 14;  // smoothing so steps don't feel like instant on/off

// Room walkable bounds (inset from the walls by the player radius/margin)
const ROOM_BOUND_MIN_X = -ROOM_WIDTH / 2 + 0.4;
const ROOM_BOUND_MAX_X = ROOM_WIDTH / 2 - 0.4;
const ROOM_BOUND_MIN_Z = ROOM_CENTER_Z - ROOM_DEPTH / 2 + 0.4;

// Garden walkable bounds — wide enough to wander the pathway, flowers and
// lanterns and walk around the outside of the cottage on both sides.
const GARDEN_BOUND_MIN_X = -8.6;
const GARDEN_BOUND_MAX_X = 8.6;
const GARDEN_BOUND_MAX_Z = 26;

// The shared wall plane between garden and living room — matched directly
// to the Cottage's actual pier geometry (group offset [0,0,-5], depth 5.2)
// rather than the door panel's recessed local offset. The door threshold
// (ROOM_DOOR_Z) sits slightly inside the wall band rather than flush on its
// inner face, which previously left a ~0.09 unit sliver near the piers
// where the player was already being treated as "indoors" (room-bound
// checks only, ±2.9) instead of the tight doorway checks (±0.42) — that
// sliver was the collision hole beside the door. Deriving the bounds from
// the pier's own position/thickness closes it without touching anything
// else about the door or room layout.
const COTTAGE_GROUP_Z = -5;   // Cottage's outer group position (see Cottage())
const COTTAGE_DEPTH   = 5.2;  // Cottage's D constant (see Cottage())
const FRONT_WALL_INNER_Z = COTTAGE_GROUP_Z - COTTAGE_DEPTH / 2;               // actual interior-facing pier face
const FRONT_WALL_OUTER_Z = FRONT_WALL_INNER_Z + WALL_T;                       // actual exterior-facing pier face
const DOORWAY_HALF_W = DOOR_OPEN_W / 2 - PLAYER_RADIUS - 0.06;

// Explicit collision boxes for the two solid piers flanking the doorway,
// matched to the same geometry the Cottage component actually renders
// (left/right pier width = (ROOM_WIDTH - DOOR_OPEN_W) / 2, centered in the
// wall band). Checking these directly — the same AABB-vs-player pattern
// already used for ROOM_OBSTACLES — closes the gap beside the door for any
// approach angle, including diagonal movement, instead of depending only
// on the thin z-band check below to classify indoor vs. outdoor.
const DOOR_PIER_Z = FRONT_WALL_INNER_Z + WALL_T / 2; // wall centerline, matches the piers' actual z
const DOOR_PIER_HALF_DEPTH = WALL_T / 2;
const DOOR_PIER_HALF_WIDTH = (ROOM_WIDTH - DOOR_OPEN_W) / 4; // half-width of each pier slab
const DOOR_PIERS = [
  { x: -(DOOR_OPEN_W / 2 + DOOR_PIER_HALF_WIDTH), z: DOOR_PIER_Z, hx: DOOR_PIER_HALF_WIDTH, hz: DOOR_PIER_HALF_DEPTH }, // left pier
  { x:  (DOOR_OPEN_W / 2 + DOOR_PIER_HALF_WIDTH), z: DOOR_PIER_Z, hx: DOOR_PIER_HALF_WIDTH, hz: DOOR_PIER_HALF_DEPTH }, // right pier
];

// Furniture obstacles as simple axis-aligned boxes (x, z, half-width, half-depth)
const ROOM_OBSTACLES = [
  { x: 0, z: ROOM_CENTER_Z - ROOM_DEPTH / 2 + 0.25, hx: 0.95, hz: 0.45 }, // fireplace
  { x: -0.1, z: ROOM_CENTER_Z + 1.15, hx: 1.05, hz: 0.5 }, // sofa
  { x: -0.1, z: ROOM_CENTER_Z + 0.45, hx: 0.55, hz: 0.35 }, // coffee table
  { x: ROOM_WIDTH / 2 - 0.25, z: ROOM_CENTER_Z - 0.6, hx: 0.5, hz: 0.5 }, // bookshelf
  { x: -ROOM_WIDTH / 2 + 0.45, z: ROOM_CENTER_Z + 1.9, hx: 0.3, hz: 0.3 }, // plant L
  { x: ROOM_WIDTH / 2 - 0.45, z: ROOM_CENTER_Z + 1.9, hx: 0.3, hz: 0.3 }, // plant R
];

// One unified collision check spanning both garden and living room, so the
// player can freely cross between them through the doorway. Below the
// wall plane = interior rules (room bounds + furniture). Above it =
// exterior rules (garden bounds). Crossing the wall thickness itself is
// only allowed within the doorway gap, and only while the door is open.
function isBlockedWorld(x, z, doorOpen) {
  const inDoorway = Math.abs(x) < DOORWAY_HALF_W;

  // Solid door piers — checked first, against their real geometry, so no
  // diagonal approach can slip around the corner where the interior/
  // exterior z-band check below hands off between the two rule sets.
  for (const p of DOOR_PIERS) {
    if (Math.abs(x - p.x) < p.hx + PLAYER_RADIUS && Math.abs(z - p.z) < p.hz + PLAYER_RADIUS) {
      return true;
    }
  }

  if (z <= FRONT_WALL_INNER_Z) {
    // ── interior (living room) ──
    if (x < ROOM_BOUND_MIN_X || x > ROOM_BOUND_MAX_X) return true;
    if (z < ROOM_BOUND_MIN_Z) return true;
    for (const o of ROOM_OBSTACLES) {
      if (Math.abs(x - o.x) < o.hx + PLAYER_RADIUS && Math.abs(z - o.z) < o.hz + PLAYER_RADIUS) {
        return true;
      }
    }
    return false;
  }

  // ── exterior (garden) ──
  if (x < GARDEN_BOUND_MIN_X || x > GARDEN_BOUND_MAX_X) return true;
  if (z > GARDEN_BOUND_MAX_Z) return true;
  if (z < FRONT_WALL_OUTER_Z) {
    // pressed up against the house's front wall — only the open doorway lets you through
    if (!inDoorway || !doorOpen) return true;
  }
  return false;
}

// World-space position of the door, used both for the "press E" proximity
// check and as the visual prompt anchor.
const DOOR_WORLD_POS = new THREE.Vector3(0, EYE_HEIGHT, ROOM_DOOR_Z + WALL_T / 2);
const DOOR_INTERACT_RANGE = 2.4;

function FirstPersonController({ active, doorOpen, memories, onToggleDoor, onLockChange, onNearDoorChange, onNearMemoryChange }) {
  const { camera } = useThree();
  const controlsRef = useRef();
  const keys = useRef({});
  const vel = useRef({ x: 0, z: 0 });

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e) => {
      keys.current[e.code] = true;
      if (e.code === "KeyE") {
        const dist = camera.position.distanceTo(DOOR_WORLD_POS);
        if (dist < DOOR_INTERACT_RANGE) onToggleDoor && onToggleDoor();
      }
    };
    const onKeyUp = (e) => { keys.current[e.code] = false; };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      keys.current = {};
    };
  }, [active, camera, onToggleDoor]);

  useEffect(() => {
    if (active) camera.position.y = EYE_HEIGHT;
  }, [active, camera]);

  const fwd = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    if (!active) return;
    const clampedDt = Math.min(dt, 0.05);

    camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    const rightX = fwd.z, rightZ = -fwd.x; // perpendicular in the XZ plane

    let mx = 0, mz = 0;
    if (keys.current.KeyW || keys.current.ArrowUp) { mx += fwd.x; mz += fwd.z; }
    if (keys.current.KeyS || keys.current.ArrowDown) { mx -= fwd.x; mz -= fwd.z; }
    if (keys.current.KeyD || keys.current.ArrowRight) { mx += rightX; mz += rightZ; }
    if (keys.current.KeyA || keys.current.ArrowLeft) { mx -= rightX; mz -= rightZ; }

    const len = Math.hypot(mx, mz);
    const targetVX = len > 0.0001 ? (mx / len) * WALK_SPEED : 0;
    const targetVZ = len > 0.0001 ? (mz / len) * WALK_SPEED : 0;

    // smooth acceleration/deceleration — no instant starts/stops, no jumps
    const accel = 1 - Math.exp(-WALK_ACCEL * clampedDt);
    vel.current.x += (targetVX - vel.current.x) * accel;
    vel.current.z += (targetVZ - vel.current.z) * accel;

    if (Math.hypot(vel.current.x, vel.current.z) > 0.001) {
      const dx = vel.current.x * clampedDt, dz = vel.current.z * clampedDt;

      // resolve X and Z independently so the player slides along walls
      // and furniture instead of stopping dead at a diagonal collision
      const nx = camera.position.x + dx;
      if (!isBlockedWorld(nx, camera.position.z, doorOpen)) camera.position.x = nx;
      else vel.current.x = 0;
      const nz = camera.position.z + dz;
      if (!isBlockedWorld(camera.position.x, nz, doorOpen)) camera.position.z = nz;
      else vel.current.z = 0;
    }

    camera.position.y = EYE_HEIGHT;

    if (onNearDoorChange) {
      onNearDoorChange(camera.position.distanceTo(DOOR_WORLD_POS) < DOOR_INTERACT_RANGE);
    }

    // Memory proximity — find closest memory anchor within range
    if (onNearMemoryChange && memories && MEMORY_ANCHORS) {
      let closest = null;
      let closestDist = Infinity;
      for (const mem of memories) {
        const anchor = MEMORY_ANCHORS[mem.location];
        if (!anchor) continue;
        const [ax, ay, az] = anchor.pos;
        // Manual distance calc — avoids allocating a new THREE.Vector3 every
        // frame for every memory anchor (was firing 60x/sec regardless of
        // player movement, causing steady GC pressure / periodic stutter).
        const dx = camera.position.x - ax;
        const dy = camera.position.y - ay;
        const dz = camera.position.z - az;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < anchor.range && dist < closestDist) {
          closestDist = dist;
          closest = mem.id;
        }
      }
      onNearMemoryChange(closest);
    }
  });

  if (!active) return null;
  return (
    <PointerLockControls
      ref={controlsRef}
      onLock={() => onLockChange && onLockChange(true)}
      onUnlock={() => onLockChange && onLockChange(false)}
    />
  );
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

  // Once the player has stepped inside, the landing UI (wordmark, tagline,
  // and Enter button) must never reappear — unmount it entirely instead of
  // just hiding the button.
  if (entered) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, pointerEvents: "none",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "flex-end", paddingBottom: "8vh",
      zIndex: 10,
      opacity: fading ? 0 : 1,
      transition: "opacity 1.2s ease",
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

      {/* Vignette edges */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at 50% 50%, transparent 38%, rgba(6,2,1,0.62) 100%)",
        zIndex: -1,
      }} />
    </div>
  );
}


// ─── Shared cozy panel styling tokens ──────────────────────────
const PANEL_BG = "rgba(28, 16, 10, 0.72)";
const PANEL_BORDER = "1px solid rgba(245,200,110,0.28)";
const PANEL_SHADOW = "0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(245,200,110,0.06) inset, 0 0 80px rgba(245,160,60,0.08) inset";
const TEXT_WARM = "#f5e0b8";
const TEXT_MUTED = "#c4924a";
const FONT_SERIF = "'Cormorant Garamond', Georgia, serif";

function GlassPanel({ children, style, maxWidth = 460 }) {
  return (
    <div
      style={{
        background: PANEL_BG,
        backdropFilter: "blur(18px) saturate(140%)",
        WebkitBackdropFilter: "blur(18px) saturate(140%)",
        border: PANEL_BORDER,
        borderRadius: 22,
        boxShadow: PANEL_SHADOW,
        padding: "2.4em 2.4em",
        maxWidth,
        width: "90vw",
        color: TEXT_WARM,
        fontFamily: FONT_SERIF,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function ModalBackdrop({ onClose, children, zIndex = 50 }) {
  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(8,4,2,0.55)",
        animation: "fadeIn 0.35s ease",
      }}
    >
      {children}
    </div>
  );
}

// ─── Exploration Menu (TAB) ────────────────────────────────────
function ExplorationMenu({ onUpload, onMyMemories, onResume }) {
  const items = [
    { icon: "📸", label: "Upload Memory", action: onUpload },
    { icon: "📚", label: "My Memories", action: onMyMemories },
    { icon: "▶", label: "Resume Exploring", action: onResume },
  ];
  return (
    <ModalBackdrop onClose={onResume} zIndex={60}>
      <GlassPanel maxWidth={420} style={{ textAlign: "center", padding: "3em 2.4em" }}>
        <div style={{
          fontSize: "1.9rem", fontWeight: 300, letterSpacing: "0.18em",
          textTransform: "uppercase", marginBottom: "0.2em",
          textShadow: "0 0 40px rgba(255,180,60,0.3)",
        }}>
          🏡 Memoire
        </div>
        <div style={{ fontSize: "0.78rem", letterSpacing: "0.32em", color: TEXT_MUTED, textTransform: "uppercase", marginBottom: "2.2em" }}>
          Exploration Paused
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.8em" }}>
          {items.map((it) => (
            <button
              key={it.label}
              onClick={it.action}
              style={{
                fontFamily: FONT_SERIF, fontSize: "1.05rem", letterSpacing: "0.06em",
                color: TEXT_WARM, background: "rgba(245,200,110,0.06)",
                border: "1px solid rgba(245,200,110,0.22)", borderRadius: 14,
                padding: "0.9em 1.2em", cursor: "pointer",
                transition: "background 0.25s, border-color 0.25s, transform 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(245,200,110,0.14)";
                e.currentTarget.style.borderColor = "rgba(245,200,110,0.5)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(245,200,110,0.06)";
                e.currentTarget.style.borderColor = "rgba(245,200,110,0.22)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              {it.icon}  {it.label}
            </button>
          ))}
        </div>
        <div style={{ marginTop: "1.8em", fontSize: "0.68rem", letterSpacing: "0.18em", color: "rgba(196,146,74,0.6)" }}>
          TAB to open · ESC to close
        </div>
      </GlassPanel>
    </ModalBackdrop>
  );
}

// ─── Upload Memory Modal ────────────────────────────────────────
function UploadMemoryModal({ onSave, onCancel }) {
  const [preview, setPreview] = useState(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");

  const handleImage = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      image: preview,
      title: title.trim(),
      date,
      note,
    });
  };

  const fieldStyle = {
    width: "100%", fontFamily: FONT_SERIF, fontSize: "0.98rem",
    color: TEXT_WARM, background: "rgba(245,200,110,0.05)",
    border: "1px solid rgba(245,200,110,0.22)", borderRadius: 10,
    padding: "0.65em 0.9em", outline: "none", marginTop: "0.35em",
  };
  const labelStyle = { fontSize: "0.72rem", letterSpacing: "0.16em", color: TEXT_MUTED, textTransform: "uppercase" };

  return (
    <ModalBackdrop onClose={onCancel} zIndex={70}>
      <GlassPanel maxWidth={460}>
        <div style={{ fontSize: "1.4rem", fontWeight: 400, letterSpacing: "0.08em", marginBottom: "1.4em", textAlign: "center" }}>
          📸 Upload Memory
        </div>

        <div style={{ marginBottom: "1.1em" }}>
          <label style={labelStyle}>Image</label>
          <div style={{
            marginTop: "0.4em", borderRadius: 14, overflow: "hidden",
            border: "1px dashed rgba(245,200,110,0.35)",
            background: "rgba(0,0,0,0.2)",
            minHeight: 140, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {preview ? (
              <img src={preview} alt="preview" style={{ width: "100%", maxHeight: 220, objectFit: "cover", display: "block" }} />
            ) : (
              <span style={{ color: "rgba(245,200,110,0.45)", fontSize: "0.9rem", padding: "1.5em" }}>No image selected</span>
            )}
          </div>
          <input type="file" accept="image/*" onChange={handleImage} style={{ ...fieldStyle, padding: "0.5em" }} />
        </div>

        <div style={{ marginBottom: "1.1em" }}>
          <label style={labelStyle}>Memory Title</label>
          <input
            type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="A quiet evening by the lake..."
            style={fieldStyle}
          />
        </div>

        <div style={{ marginBottom: "1.1em" }}>
          <label style={labelStyle}>Memory Date</label>
          <input
            type="date" value={date} onChange={(e) => setDate(e.target.value)}
            style={fieldStyle}
          />
        </div>

        <div style={{ marginBottom: "1.6em" }}>
          <label style={labelStyle}>Memory Note</label>
          <textarea
            value={note} onChange={(e) => setNote(e.target.value)}
            rows={3} placeholder="Write what you remember..."
            style={{ ...fieldStyle, resize: "vertical" }}
          />
        </div>

        <div style={{ display: "flex", gap: "0.8em", justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={{
            fontFamily: FONT_SERIF, fontSize: "0.95rem", color: TEXT_MUTED,
            background: "transparent", border: "1px solid rgba(245,200,110,0.22)",
            borderRadius: 10, padding: "0.6em 1.4em", cursor: "pointer",
          }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={!title.trim()} style={{
            fontFamily: FONT_SERIF, fontSize: "0.95rem", color: "#1a0f06",
            background: title.trim() ? "rgba(245,200,110,0.92)" : "rgba(245,200,110,0.35)",
            border: "none", borderRadius: 10, padding: "0.6em 1.6em",
            cursor: title.trim() ? "pointer" : "not-allowed", fontWeight: 600,
          }}>
            Save
          </button>
        </div>
      </GlassPanel>
    </ModalBackdrop>
  );
}

// ─── My Memories list ───────────────────────────────────────────
function MemoryListModal({ memories, onSelect, onClose }) {
  return (
    <ModalBackdrop onClose={onClose} zIndex={70}>
      <GlassPanel maxWidth={640}>
        <div style={{ fontSize: "1.4rem", fontWeight: 400, letterSpacing: "0.08em", marginBottom: "1.2em", textAlign: "center" }}>
          📚 My Memories
        </div>

        {memories.length === 0 ? (
          <div style={{ textAlign: "center", color: "rgba(245,200,110,0.5)", padding: "2em 1em", fontSize: "1rem" }}>
            No memories saved yet. Open the menu and choose "Upload Memory" to begin.
          </div>
        ) : (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: "1em", maxHeight: "55vh", overflowY: "auto", paddingRight: "0.3em",
          }}>
            {memories.map((m) => (
              <button
                key={m.id}
                onClick={() => onSelect(m)}
                style={{
                  textAlign: "left", cursor: "pointer", border: "1px solid rgba(245,200,110,0.2)",
                  borderRadius: 14, overflow: "hidden", background: "rgba(245,200,110,0.04)",
                  fontFamily: FONT_SERIF, padding: 0, transition: "transform 0.2s, border-color 0.2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = "rgba(245,200,110,0.5)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "rgba(245,200,110,0.2)"; }}
              >
                <div style={{ width: "100%", height: 100, background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {m.image ? (
                    <img src={m.image} alt={m.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: "1.6rem" }}>🖼️</span>
                  )}
                </div>
                <div style={{ padding: "0.6em 0.8em" }}>
                  <div style={{ color: TEXT_WARM, fontSize: "0.95rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {m.title}
                  </div>
                  <div style={{ color: TEXT_MUTED, fontSize: "0.72rem", letterSpacing: "0.06em", marginTop: "0.2em" }}>
                    {m.date || "Undated"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "center", marginTop: "1.6em" }}>
          <button onClick={onClose} style={{
            fontFamily: FONT_SERIF, fontSize: "0.92rem", color: TEXT_MUTED,
            background: "transparent", border: "1px solid rgba(245,200,110,0.22)",
            borderRadius: 10, padding: "0.55em 1.8em", cursor: "pointer",
          }}>
            Close
          </button>
        </div>
      </GlassPanel>
    </ModalBackdrop>
  );
}

// ─── Memory Viewer ───────────────────────────────────────────────
function MemoryViewerModal({ memory, onClose }) {
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [videoOpen,    setVideoOpen]    = useState(false);

  if (!memory) return null;

  // Description supports either `description` (new schema) or legacy `note`
  const bodyText = memory.description || memory.note || "No note written for this memory.";

  const mediaBtn = (icon, label, active, onClick, available) => (
    <button
      onClick={onClick}
      title={available ? undefined : "Not available for this memory"}
      style={{
        fontFamily: FONT_SERIF, fontSize: "0.88rem", letterSpacing: "0.06em",
        color: available ? (active ? "#1a0f06" : TEXT_WARM) : "rgba(245,224,184,0.3)",
        background: active ? "rgba(245,200,110,0.92)" : "rgba(245,200,110,0.07)",
        border: "1px solid " + (available ? "rgba(245,200,110,0.36)" : "rgba(245,200,110,0.12)"),
        borderRadius: 10, padding: "0.5em 1.1em", cursor: available ? "pointer" : "not-allowed",
        display: "flex", alignItems: "center", gap: "0.4em",
        transition: "background 0.2s, color 0.2s",
      }}
      onMouseEnter={(e) => {
        if (!available) return;
        e.currentTarget.style.background = active ? "rgba(245,200,110,1)" : "rgba(245,200,110,0.15)";
      }}
      onMouseLeave={(e) => {
        if (!available) return;
        e.currentTarget.style.background = active ? "rgba(245,200,110,0.92)" : "rgba(245,200,110,0.07)";
      }}
    >
      <span>{icon}</span> {label}
    </button>
  );

  return (
    <ModalBackdrop onClose={onClose} zIndex={80}>
      <GlassPanel maxWidth={560} style={{ padding: "1.8em" }}>
        {/* Photo */}
        <div style={{
          width: "100%", borderRadius: 14, overflow: "hidden",
          background: "rgba(0,0,0,0.25)", marginBottom: "1.2em",
          minHeight: 220, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {memory.image ? (
            <img src={memory.image} alt={memory.title}
              style={{ width: "100%", maxHeight: 360, objectFit: "cover", display: "block" }} />
          ) : (
            <span style={{ fontSize: "2rem" }}>🖼️</span>
          )}
        </div>

        {/* Title + date */}
        <div style={{ fontSize: "1.5rem", fontWeight: 400, letterSpacing: "0.04em", marginBottom: "0.2em" }}>
          {memory.title}
          {memory.favorite && <span style={{ marginLeft: "0.5em", fontSize: "1rem" }}>★</span>}
        </div>
        <div style={{ fontSize: "0.78rem", letterSpacing: "0.14em", color: TEXT_MUTED, textTransform: "uppercase", marginBottom: "1em" }}>
          {memory.date ? new Date(memory.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "Undated"}
          {memory.type && <span style={{ marginLeft: "1em", opacity: 0.7 }}>· {memory.type}</span>}
        </div>

        {/* Description */}
        <div style={{ fontSize: "1rem", lineHeight: 1.75, color: "rgba(245,224,184,0.88)", whiteSpace: "pre-wrap", marginBottom: "1.6em" }}>
          {bodyText}
        </div>

        {/* Media controls + Close */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.7em", flexWrap: "wrap" }}>
          {mediaBtn("🔊", audioPlaying ? "Pause Audio" : "Play Audio",
            audioPlaying, () => setAudioPlaying((p) => !p), !!memory.audio)}
          {mediaBtn("🎬", "Play Video",
            videoOpen,    () => setVideoOpen((p) => !p),    !!memory.video)}

          <div style={{ flex: 1 }} />

          <button onClick={onClose} style={{
            fontFamily: FONT_SERIF, fontSize: "0.92rem", color: "#1a0f06",
            background: "rgba(245,200,110,0.92)", border: "none",
            borderRadius: 10, padding: "0.6em 1.8em", cursor: "pointer", fontWeight: 600,
          }}>
            Close
          </button>
        </div>

        {/* Audio placeholder feedback */}
        {audioPlaying && !memory.audio && (
          <div style={{ marginTop: "0.9em", fontSize: "0.78rem", color: TEXT_MUTED, letterSpacing: "0.08em" }}>
            Audio will play here once attached to this memory.
          </div>
        )}
        {videoOpen && !memory.video && (
          <div style={{ marginTop: "0.9em", borderRadius: 10, background: "rgba(0,0,0,0.35)",
            padding: "1.4em", textAlign: "center", fontSize: "0.88rem", color: TEXT_MUTED, letterSpacing: "0.06em" }}>
            Video playback area — attach a video file to this memory to enable.
          </div>
        )}
      </GlassPanel>
    </ModalBackdrop>
  );
}

// ─── Scene ────────────────────────────────────────────────────
function Scene({ isEntering, freeLook, doorOpen, memories, onEnterComplete, onLockChange, onToggleDoor, onNearDoorChange, onNearMemoryChange, decorativesReady }) {
  return (
    <>
      <CinematicCamera isEntering={isEntering} onEnterComplete={onEnterComplete} />

      {/* True first-person walking, handed off once the scripted camera
          stops just inside the front doorway: WASD + mouse look + collision,
          the player controls where they go from here on — including
          walking back outside through the same door whenever they like. */}
      <FirstPersonController
        active={freeLook}
        doorOpen={doorOpen}
        memories={memories}
        onToggleDoor={onToggleDoor}
        onLockChange={onLockChange}
        onNearDoorChange={onNearDoorChange}
        onNearMemoryChange={onNearMemoryChange}
      />

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

      {/* Everything exterior — sky, ground, trees, fence, lanterns, yard
          dressing — stays mounted at all times now, inside or outside.
          The living room's side/back walls are solid, so none of this
          leaks into the room visually; it's only ever visible through the
          actual doorway opening — which is exactly what should happen
          when looking outside from just inside the front door. This also
          means there's a real garden for the player to walk back out into. */}
      <>
        <SkyDome />
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
        <CozyTree position={[-6.5, 0, -7]} height={5.5} spread={1.9} hue={0.33} wobble={0.7} />
        <CozyTree position={[6.5, 0, -7]} height={5} spread={1.8} hue={0.32} wobble={-0.5} />

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

        {/* Magic — deferred a tick past first paint (see decorativesReady in
            App()) so 50 firefly components + particle effects don't add to
            the single synchronous scene-build task on startup. Visually
            identical once mounted; they just appear a beat later. */}
        {decorativesReady && (
          <>
            <Fireflies count={50} />
            <DustMotes />
            <ChimneySmoke />
          </>
        )}

        {/* Background depth fog glow near horizon */}
        <pointLight color={new THREE.Color(1.0, 0.35, 0.08)} intensity={3} distance={40} decay={1.5} position={[0, 3, -20]} />
      </>

      {/* Main cottage — front wall, doorway and door live here */}
      <Cottage doorOpen={doorOpen} onDoorClick={onToggleDoor} />

      {/* Interior, revealed behind the open front door */}
      <LivingRoom memories={memories} />
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
  const [looking, setLooking] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const [nearDoor, setNearDoor] = useState(false);
  const [nearMemory, setNearMemory] = useState(null); // memory id or null

  // ── Exploration menu / memory features (frontend-only, React state) ──
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [viewerMemory, setViewerMemory] = useState(null);
  const [memories, setMemories] = useState(DEFAULT_MEMORIES);

  // Decorative flourishes (fireflies, dust motes, chimney smoke) aren't
  // needed for the scene to be visually complete or interactive, so their
  // mount is pushed to a tick after first paint. This splits scene
  // construction into two smaller chunks instead of one large synchronous
  // one, so the browser gets a chance to paint in between.
  const [decorativesReady, setDecorativesReady] = useState(false);
  useEffect(() => {
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 0));
    const cancelIdle = window.cancelIdleCallback || clearTimeout;
    const handle = idle(() => setDecorativesReady(true));
    return () => cancelIdle(handle);
  }, []);

  // The three built-in demo photos are fairly large base64 assets. They now
  // live in their own module (memory-images.js) instead of being embedded
  // directly in this file, and we only import + decode them after the first
  // paint has already happened, so they can't block initial startup. Once
  // loaded, they're merged into the existing memory entries by id — nothing
  // about the memories themselves changes, only when their images arrive.
  useEffect(() => {
    let cancelled = false;
    const idle =
      window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
    const cancelIdle = window.cancelIdleCallback || clearTimeout;
    const handle = idle(() => {
      import("./memory-images.js").then(({ FAMILY_IMG, GRAD_IMG, TRIP_IMG }) => {
        if (cancelled) return;
        const imagesById = {
          "demo-family-001": FAMILY_IMG,
          "demo-grad-002": GRAD_IMG,
          "demo-trip-003": TRIP_IMG,
        };
        setMemories((prev) =>
          prev.map((m) =>
            imagesById[m.id] && !m.image ? { ...m, image: imagesById[m.id] } : m
          )
        );
      });
    });
    return () => {
      cancelled = true;
      cancelIdle(handle);
    };
  }, []);

  const handleEnter = () => {
    setIsEntering(true);
    setDoorOpen(true); // pressing "Enter Home" is the interaction that opens the door for the walk-in
  };
  const toggleDoor = () => setDoorOpen((prev) => !prev);

  // Movement/camera control is paused (PointerLockControls unmounts,
  // restoring the cursor) whenever the exploration menu or any modal is
  // open — done purely by gating the `active`/freeLook flag handed to
  // FirstPersonController, without touching that component at all.
  const anyOverlayOpen = menuOpen || uploadOpen || listOpen || !!viewerMemory;
  const freeLookActive = entered && !anyOverlayOpen;

  const relockPointer = () => {
    // Re-engage pointer lock for "Resume Exploring" — the canvas element
    // is what PointerLockControls binds to.
    requestAnimationFrame(() => {
      const canvas = document.querySelector("canvas");
      if (canvas && canvas.requestPointerLock) canvas.requestPointerLock();
    });
  };

  const openMenu = () => {
    if (!entered) return;
    if (document.pointerLockElement && document.exitPointerLock) {
      document.exitPointerLock();
    }
    setLooking(false);
    setMenuOpen(true);
  };
  const resumeExploring = () => {
    setMenuOpen(false);
    setUploadOpen(false);
    setListOpen(false);
    setViewerMemory(null);
    relockPointer();
  };

  const openUpload = () => { setMenuOpen(false); setUploadOpen(true); };
  const openMyMemories = () => { setMenuOpen(false); setListOpen(true); };

  const saveMemory = (memory) => {
    setMemories((prev) => [memory, ...prev]);
    setUploadOpen(false);
    setMenuOpen(true); // back to the menu after saving
  };
  const cancelUpload = () => { setUploadOpen(false); setMenuOpen(true); };
  const closeList = () => { setListOpen(false); setMenuOpen(true); };
  const openMemory = (m) => { setListOpen(false); setViewerMemory(m); };
  const closeViewer = () => { setViewerMemory(null); setListOpen(true); };

  // Global key reservations: TAB pauses/opens the menu, ESC closes
  // whatever overlay is on top, F is reserved for a future memory
  // interaction (no-op today). WASD/mouse/E remain fully owned by
  // FirstPersonController and are untouched here.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === "Tab") {
        e.preventDefault();
        if (!entered) return;
        if (menuOpen) {
          resumeExploring();
        } else if (!uploadOpen && !listOpen && !viewerMemory) {
          openMenu();
        }
        return;
      }
      if (e.code === "Escape") {
        if (viewerMemory) { closeViewer(); return; }
        if (listOpen) { closeList(); return; }
        if (uploadOpen) { cancelUpload(); return; }
        if (menuOpen) { resumeExploring(); return; }
        return;
      }
      if (e.code === "KeyF") {
        if (nearMemory && !viewerMemory && !menuOpen && !uploadOpen && !listOpen) {
          const mem = memories.find((m) => m.id === nearMemory);
          if (mem) {
            if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
            setLooking(false);
            setViewerMemory(mem);
          }
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [entered, menuOpen, uploadOpen, listOpen, viewerMemory]);

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
        shadows="soft"
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
          <Scene
            isEntering={isEntering}
            freeLook={freeLookActive}
            doorOpen={doorOpen}
            memories={memories}
            onEnterComplete={() => setEntered(true)}
            onLockChange={setLooking}
            onToggleDoor={toggleDoor}
            onNearDoorChange={setNearDoor}
            onNearMemoryChange={setNearMemory}
            decorativesReady={decorativesReady}
          />
          <PostFX />
        </Suspense>
      </Canvas>

      <OverlayUI onEnter={handleEnter} entered={entered} />

      {entered && !looking && !anyOverlayOpen && (
        <div style={{
          position: "fixed", left: "50%", bottom: "8%", transform: "translateX(-50%)",
          color: "rgba(255,235,205,0.9)", fontFamily: "'Cormorant Garamond', serif",
          fontSize: "1.1rem", letterSpacing: "0.04em", textAlign: "center",
          textShadow: "0 2px 10px rgba(0,0,0,0.8)", pointerEvents: "none",
          animation: "fadeIn 1s ease",
        }}>
          Click to look around · WASD to walk
        </div>
      )}

      {entered && looking && nearDoor && !anyOverlayOpen && (
        <div style={{
          position: "fixed", left: "50%", bottom: "12%", transform: "translateX(-50%)",
          color: "rgba(255,235,205,0.95)", fontFamily: "'Cormorant Garamond', serif",
          fontSize: "1.05rem", letterSpacing: "0.05em", textAlign: "center",
          textShadow: "0 2px 10px rgba(0,0,0,0.85)", pointerEvents: "none",
          animation: "fadeIn 0.4s ease",
        }}>
          Press E to {doorOpen ? "close" : "open"} the door
        </div>
      )}

      {entered && looking && nearMemory && !anyOverlayOpen && (
        <div style={{
          position: "fixed", left: "50%", bottom: "20%", transform: "translateX(-50%)",
          color: "rgba(255,235,205,0.95)", fontFamily: "'Cormorant Garamond', serif",
          fontSize: "1.05rem", letterSpacing: "0.05em", textAlign: "center",
          textShadow: "0 2px 10px rgba(0,0,0,0.85)", pointerEvents: "none",
          animation: "fadeIn 0.4s ease",
        }}>
          Press F to Remember
        </div>
      )}

      {entered && !anyOverlayOpen && (
        <div style={{
          position: "fixed", right: "2.4em", top: "2.2em",
          color: "rgba(245,224,184,0.55)", fontFamily: "'Cormorant Garamond', serif",
          fontSize: "0.85rem", letterSpacing: "0.1em", textAlign: "right",
          textShadow: "0 2px 10px rgba(0,0,0,0.8)", pointerEvents: "none",
          animation: "fadeIn 1s ease",
        }}>
          TAB — Menu
        </div>
      )}

      {menuOpen && (
        <ExplorationMenu
          onUpload={openUpload}
          onMyMemories={openMyMemories}
          onResume={resumeExploring}
        />
      )}

      {uploadOpen && (
        <UploadMemoryModal onSave={saveMemory} onCancel={cancelUpload} />
      )}

      {listOpen && (
        <MemoryListModal memories={memories} onSelect={openMemory} onClose={closeList} />
      )}

      {viewerMemory && (
        <MemoryViewerModal memory={viewerMemory} onClose={closeViewer} />
      )}
    </div>
  );
}
