import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { isSmallScreen } from '../../utils/webgl';
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

// 81 il: nokta, ışık halesi ve dokunma alanı. Her biri tek bir örneklenmiş
// (instanced) çizim: önceden 243 ayrı nesne ve malzeme her karede ayrı ayrı
// çiziliyor, kaydırmayı takıltıyordu. Hale saydamlığı il başına bir öznitelikle
// (instanceOpacity) verilir.
const N = PROVINCES.length;

function withInstanceOpacity(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float instanceOpacity;\nvarying float vInstanceOpacity;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInstanceOpacity = instanceOpacity;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vInstanceOpacity;')
      .replace('#include <opaque_fragment>', 'diffuseColor.a *= vInstanceOpacity;\n#include <opaque_fragment>');
  };
  return material;
}

function Provinces({ colors, animate, hovered, onHover }) {
  const dots = useRef();
  const halos = useRef();
  const hits = useRef();
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const dotColor = useMemo(() => new THREE.Color(colors.dot), [colors.dot]);
  const hoverColor = useMemo(() => new THREE.Color(colors.hover), [colors.hover]);
  const opacity = useMemo(() => new THREE.InstancedBufferAttribute(new Float32Array(N), 1), []);
  const haloMaterial = useMemo(
    () => withInstanceOpacity(new THREE.MeshBasicMaterial({ color: colors.halo, transparent: true, depthWrite: false })),
    [colors.halo]
  );
  useEffect(() => () => haloMaterial.dispose(), [haloMaterial]);

  // Dokunma alanları sabittir: bir kez yerleştirilir
  useEffect(() => {
    const mesh = hits.current;
    if (!mesh) return;
    PROVINCES.forEach((p, i) => {
      tmp.position.set(p.x, p.y, TOP);
      tmp.rotation.set(0, 0, 0);
      tmp.scale.setScalar(1);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [tmp]);

  useFrame(({ clock }) => {
    const d = dots.current;
    const h = halos.current;
    if (!d || !h) return;
    // Dalga: soldan sağa 1,6 sn'lik tarama, arada kısa bir duraklama
    const t = animate ? (clock.elapsedTime * 0.3) % 1.6 : -1;
    PROVINCES.forEach((p, i) => {
      const dist = t - p.phase;
      const glow = animate ? Math.exp(-(dist * dist) / 0.005) : 0;
      const isHover = hovered === i;

      tmp.position.set(p.x, p.y, TOP + 0.03);
      tmp.rotation.set(Math.PI / 2, 0, 0);
      tmp.scale.setScalar(1 + glow * 0.7 + (isHover ? 0.9 : 0));
      tmp.updateMatrix();
      d.setMatrixAt(i, tmp.matrix);
      d.setColorAt(i, isHover ? hoverColor : dotColor);

      tmp.position.set(p.x, p.y, TOP + 0.004);
      tmp.rotation.set(0, 0, 0);
      tmp.scale.setScalar(1 + glow * 2.4 + (isHover ? 1.6 : 0));
      tmp.updateMatrix();
      h.setMatrixAt(i, tmp.matrix);
      opacity.setX(i, Math.max(glow * 0.45, isHover ? 0.35 : 0));
    });
    d.instanceMatrix.needsUpdate = true;
    if (d.instanceColor) d.instanceColor.needsUpdate = true;
    h.instanceMatrix.needsUpdate = true;
    opacity.needsUpdate = true;
  });

  const handle = (e) => {
    e.stopPropagation();
    if (e.instanceId !== undefined) onHover(e.instanceId, e.nativeEvent);
  };

  return (
    <group>
      <instancedMesh ref={halos} args={[undefined, haloMaterial, N]} frustumCulled={false} renderOrder={1}>
        <circleGeometry args={[0.12, 24]}>
          <primitive object={opacity} attach="attributes-instanceOpacity" />
        </circleGeometry>
      </instancedMesh>
      <instancedMesh ref={dots} args={[undefined, undefined, N]} frustumCulled={false}>
        <cylinderGeometry args={[0.07, 0.07, 0.06, 20]} />
        <meshStandardMaterial color="#ffffff" emissive={colors.dot} emissiveIntensity={0.35} roughness={0.4} />
      </instancedMesh>
      {/* Parmakla da kolay seçilsin diye noktadan büyük, görünmez alan */}
      <instancedMesh
        ref={hits}
        args={[undefined, undefined, N]}
        visible={false}
        onPointerOver={handle}
        onPointerMove={handle}
        onPointerDown={handle}
        onPointerOut={() => onHover(null)}
      >
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshBasicMaterial />
      </instancedMesh>
    </group>
  );
}

// İlk kare gerçekten çizilince bir kez haber verir: düz harita ancak o zaman kaybolur
function FirstFrame({ onReady }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    requestAnimationFrame(() => onReady?.());
  });
  return null;
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

export default function CampusMap3D({ mode = 'dark', active = true, animate = true, hovered = null, onHover, onReady }) {
  const colors = COLORS[mode] || COLORS.dark;
  return (
    <Canvas
      // Telefonda çözünürlük biraz düşük tutulur (GPU ve pil)
      dpr={[1, isSmallScreen() ? 1.5 : 1.75]}
      camera={CAMERA}
      gl={GL}
      // Görünmezken "demand": yalnızca ilk kare (ve gerekirse sığdırma) çizilir,
      // sürekli çizim yapılmaz; görünür olunca dalga canlanır
      frameloop={active && animate ? 'always' : 'demand'}
      onPointerMissed={() => onHover?.(null)}
      style={{ touchAction: 'pan-y' }}
    >
      <ambientLight intensity={mode === 'light' ? 2.4 : 1.2} />
      <directionalLight position={[-3, -4, 9]} intensity={mode === 'light' ? 2.2 : 1.8} />
      <FirstFrame onReady={onReady} />
      <Rig animate={animate}>
        <Land colors={colors} />
        <Provinces colors={colors} animate={animate} hovered={hovered} onHover={(i, ev) => onHover?.(i, ev)} />
      </Rig>
    </Canvas>
  );
}

