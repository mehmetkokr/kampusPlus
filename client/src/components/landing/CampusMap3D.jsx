import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import data from './turkeyMap.json';

// Kabartma Türkiye haritası ve 81 il merkezi (React Three Fiber).
// Batıdan doğuya periyodik bir ışık dalgası illeri sırayla yakar; fareyle
// harita hafifçe eğilir. Bir ilin üzerine gelince (ya da dokununca) adı
// üst bileşene bildirilir. Veri: Natural Earth sınırı, Wikidata il merkezleri
// (bkz. turkeyMap.json); koordinatlar önceden izdüşümlü.

const pts = data.rings.flat();
const MIN_X = Math.min(...pts.map((p) => p[0]));
const MAX_X = Math.max(...pts.map((p) => p[0]));
const MIN_Y = Math.min(...pts.map((p) => p[1]));
const MAX_Y = Math.max(...pts.map((p) => p[1]));
const CX = (MIN_X + MAX_X) / 2;
const CY = (MIN_Y + MAX_Y) / 2;
const WIDTH = MAX_X - MIN_X;
const HEIGHT = MAX_Y - MIN_Y;
const DEPTH = 0.32;
const TOP = DEPTH + 0.04; // eğim payı dahil üst yüzey
const TILT = -0.6;
const FOV = 30;

// Sabit nesne: her yeniden çizimde yeni bir dizi verilirse R3F kamerayı sıfırlar
const CAMERA = { fov: FOV, near: 0.1, far: 200, position: [0, 0, 20] };
const GL = { antialias: true, alpha: true, powerPreference: 'low-power' };

const PROVINCES = data.provinces.map((p) => ({ ...p, x: p.x - CX, y: p.y - CY, phase: (p.x - MIN_X) / WIDTH }));

const COLORS = {
  light: { land: '#ffffff', edge: '#0071e3', dot: '#0071e3', halo: '#0071e3', hover: '#d70015' },
  dark: { land: '#1f2330', edge: '#0a84ff', dot: '#409cff', halo: '#0a84ff', hover: '#ff453a' },
};

function Land({ colors }) {
  const geometry = useMemo(() => {
    const shapes = data.rings.map((ring) => {
      const s = new THREE.Shape();
      ring.forEach(([x, y], i) => (i ? s.lineTo(x - CX, y - CY) : s.moveTo(x - CX, y - CY)));
      return s;
    });
    return new THREE.ExtrudeGeometry(shapes, { depth: DEPTH, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 1 });
  }, []);
  const outlines = useMemo(
    () => data.rings.map((ring) => new THREE.BufferGeometry().setFromPoints(ring.map(([x, y]) => new THREE.Vector3(x - CX, y - CY, TOP + 0.005)))),
    []
  );
  useEffect(() => () => [geometry, ...outlines].forEach((g) => g.dispose()), [geometry, outlines]);

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={colors.land} roughness={0.9} metalness={0} />
      </mesh>
      {outlines.map((g, i) => (
        <lineLoop key={i} geometry={g}>
          <lineBasicMaterial color={colors.edge} transparent opacity={0.55} />
        </lineLoop>
      ))}
    </group>
  );
}

function Provinces({ colors, animate, hovered, onHover }) {
  const dots = useRef([]);
  const halos = useRef([]);

  useFrame(({ clock }) => {
    // Dalga: soldan sağa 1,6 sn'lik tarama, arada kısa bir duraklama
    const t = animate ? (clock.elapsedTime * 0.3) % 1.6 : -1;
    PROVINCES.forEach((p, i) => {
      const d = t - p.phase;
      const glow = animate ? Math.exp(-(d * d) / 0.005) : 0;
      const isHover = hovered === i;
      dots.current[i]?.scale.setScalar(1 + glow * 0.7 + (isHover ? 0.9 : 0));
      const halo = halos.current[i];
      if (halo) {
        halo.scale.setScalar(1 + glow * 2.4 + (isHover ? 1.6 : 0));
        halo.material.opacity = Math.max(glow * 0.45, isHover ? 0.35 : 0);
      }
    });
  });

  return (
    <group>
      {PROVINCES.map((p, i) => (
        <group key={p.name} position={[p.x, p.y, TOP]}>
          <mesh ref={(el) => (halos.current[i] = el)} position={[0, 0, 0.004]}>
            <circleGeometry args={[0.12, 24]} />
            <meshBasicMaterial color={colors.halo} transparent opacity={0} depthWrite={false} />
          </mesh>
          <mesh ref={(el) => (dots.current[i] = el)} position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.06, 20]} />
            <meshStandardMaterial
              color={hovered === i ? colors.hover : colors.dot}
              emissive={hovered === i ? colors.hover : colors.dot}
              emissiveIntensity={0.35}
              roughness={0.4}
            />
          </mesh>
          {/* Parmakla da kolay seçilsin diye noktadan büyük, görünmez alan */}
          <mesh
            visible={false}
            onPointerOver={(e) => {
              e.stopPropagation();
              onHover(i, e.nativeEvent);
            }}
            onPointerMove={(e) => {
              e.stopPropagation();
              onHover(i, e.nativeEvent);
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onHover(i, e.nativeEvent);
            }}
            onPointerOut={() => onHover(null)}
          >
            <sphereGeometry args={[0.3, 8, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Haritayı tuvale sığdır; fareyle hafif eğim (hareket kapalıysa sabit)
function Rig({ animate, children }) {
  const group = useRef();
  const fitted = useRef('');
  const { invalidate } = useThree();

  useFrame(({ pointer, camera, size }, dt) => {
    // Tuval boyutu değişince haritayı yeniden sığdır
    const key = `${size.width}x${size.height}`;
    if (fitted.current !== key && size.width > 0 && size.height > 0) {
      fitted.current = key;
      const aspect = size.width / size.height;
      const half = THREE.MathUtils.degToRad(FOV / 2);
      const visibleH = HEIGHT * Math.cos(TILT) + DEPTH;
      const dist = Math.max((WIDTH * 0.53) / (Math.tan(half) * aspect), (visibleH * 0.6) / Math.tan(half));
      camera.position.set(0, 0, dist);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      invalidate();
    }
    const g = group.current;
    if (!g) return;
    const tx = TILT + (animate ? pointer.y * -0.06 : 0);
    const ty = animate ? pointer.x * 0.1 : 0;
    const k = Math.min(1, dt * 3);
    g.rotation.x += (tx - g.rotation.x) * k;
    g.rotation.y += (ty - g.rotation.y) * k;
  });

  return (
    <group ref={group} rotation={[TILT, 0, 0]}>
      {children}
    </group>
  );
}

export default function CampusMap3D({ mode = 'dark', active = true, animate = true, hovered = null, onHover }) {
  const colors = COLORS[mode] || COLORS.dark;
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={CAMERA}
      gl={GL}
      frameloop={active ? (animate ? 'always' : 'demand') : 'never'}
      onPointerMissed={() => onHover?.(null)}
      style={{ touchAction: 'pan-y' }}
    >
      <ambientLight intensity={mode === 'light' ? 2.4 : 1.2} />
      <directionalLight position={[-3, -4, 9]} intensity={mode === 'light' ? 2.2 : 1.8} />
      <Rig animate={animate}>
        <Land colors={colors} />
        <Provinces colors={colors} animate={animate} hovered={hovered} onHover={(i, ev) => onHover?.(i, ev)} />
      </Rig>
    </Canvas>
  );
}

