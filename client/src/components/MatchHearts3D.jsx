import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Eşleşme anında ortadan dışa saçılan kalpler (React Three Fiber).
// Tek bir InstancedMesh: 70 kalp, her biri kendi hızı, dönüşü ve ömrüyle;
// yerçekimiyle yavaşlayıp küçülerek kaybolur. Yaklaşık 2,6 sn sürer, sonra
// çizim durur. Renkler uygulamanın paleti: kırmızı, mavi, mor.
const COUNT = 70;
const LIFE = 2.6;
const PALETTE = ['#ff375f', '#ff453a', '#0a84ff', '#5e5ce6', '#ff9fb2'];

function heartShape() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.25);
  s.bezierCurveTo(0, 0.5, -0.45, 0.55, -0.5, 0.25);
  s.bezierCurveTo(-0.55, -0.05, -0.2, -0.25, 0, -0.5);
  s.bezierCurveTo(0.2, -0.25, 0.55, -0.05, 0.5, 0.25);
  s.bezierCurveTo(0.45, 0.55, 0, 0.5, 0, 0.25);
  return s;
}

function Burst({ onDone }) {
  const mesh = useRef();
  const start = useRef(null);
  const done = useRef(false);
  const geometry = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(heartShape(), { depth: 0.18, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, curveSegments: 8 });
    g.center();
    return g;
  }, []);
  const particles = useMemo(
    () =>
      Array.from({ length: COUNT }, () => {
        const a = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 4.5;
        return {
          v: new THREE.Vector3(Math.cos(a) * speed, Math.sin(a) * speed + 2.2, (Math.random() - 0.5) * 3),
          spin: new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 4),
          size: 0.18 + Math.random() * 0.28,
          delay: Math.random() * 0.18,
        };
      }),
    []
  );
  const tmp = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const m = mesh.current;
    particles.forEach((_, i) => m.setColorAt(i, new THREE.Color(PALETTE[i % PALETTE.length])));
    m.instanceColor.needsUpdate = true;
    return () => geometry.dispose();
  }, [geometry, particles]);

  useFrame(({ clock }) => {
    if (done.current) return;
    if (start.current === null) start.current = clock.elapsedTime;
    const t = clock.elapsedTime - start.current;
    const m = mesh.current;
    particles.forEach((p, i) => {
      const life = Math.max(0, t - p.delay);
      // Konum: ilk hız + yerçekimi; ömrün sonunda küçülerek kaybolur
      tmp.position.set(p.v.x * life * 0.55, p.v.y * life * 0.55 - 2.4 * life * life, p.v.z * life * 0.4);
      tmp.rotation.set(p.spin.x * life, p.spin.y * life, Math.PI + p.spin.z * life * 0.3);
      const grow = Math.min(1, life / 0.18);
      const fade = 1 - Math.min(1, Math.max(0, (life - LIFE * 0.55) / (LIFE * 0.45)));
      tmp.scale.setScalar(p.size * grow * fade);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    if (t > LIFE + 0.2) {
      done.current = true;
      onDone?.();
    }
  });

  return (
    <instancedMesh ref={mesh} args={[geometry, null, COUNT]}>
      <meshStandardMaterial roughness={0.35} metalness={0.05} />
    </instancedMesh>
  );
}

export default function MatchHearts3D({ onDone }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ fov: 50, position: [0, 0, 9] }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <ambientLight intensity={1.4} />
      <directionalLight position={[2, 3, 6]} intensity={1.6} />
      <Burst onDone={onDone} />
    </Canvas>
  );
}
