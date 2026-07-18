'use client';

// Landing hero background: three particle streams (three chains) flow into a
// rotating wireframe core (the vault). three.js, dynamically imported so it
// never blocks app pages. Respects prefers-reduced-motion.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const ACCENT = new THREE.Color('#34d399');
const DIM = new THREE.Color('#0e7a5f');
const STREAM_COUNT = 3;
const PARTICLES_PER_STREAM = 420;
const CORE_RADIUS = 1.1;

export default function Hero3D() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0b0b0f, 0.055);

    const camera = new THREE.PerspectiveCamera(
      55,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100,
    );
    camera.position.set(0, 0.6, 9);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // The vault core: nested wireframe icosahedra, slowly counter-rotating.
    const coreOuter = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(CORE_RADIUS, 1)),
      new THREE.LineBasicMaterial({
        color: ACCENT,
        transparent: true,
        opacity: 0.5,
      }),
    );
    const coreInner = new THREE.LineSegments(
      new THREE.WireframeGeometry(
        new THREE.IcosahedronGeometry(CORE_RADIUS * 0.55, 0),
      ),
      new THREE.LineBasicMaterial({
        color: ACCENT,
        transparent: true,
        opacity: 0.85,
      }),
    );
    scene.add(coreOuter, coreInner);

    const glow = new THREE.PointLight(ACCENT.getHex(), 4, 12);
    scene.add(glow);
    scene.add(new THREE.AmbientLight(0x223327, 1.2));

    // Particle streams: each particle has a progress t along a curved path
    // from a spawn arc (its "chain") to the core, where it respawns.
    type Stream = {
      points: THREE.Points;
      progress: Float32Array;
      speed: Float32Array;
      origin: THREE.Vector3;
      swirl: number;
    };
    const streams: Stream[] = [];
    const origins = [
      new THREE.Vector3(-7.5, 2.6, -2),
      new THREE.Vector3(7.5, 1.6, -3),
      new THREE.Vector3(0, -4.6, -4),
    ];

    for (let s = 0; s < STREAM_COUNT; s++) {
      const positions = new Float32Array(PARTICLES_PER_STREAM * 3);
      const colors = new Float32Array(PARTICLES_PER_STREAM * 3);
      const progress = new Float32Array(PARTICLES_PER_STREAM);
      const speed = new Float32Array(PARTICLES_PER_STREAM);

      for (let i = 0; i < PARTICLES_PER_STREAM; i++) {
        progress[i] = Math.random();
        speed[i] = 0.0016 + Math.random() * 0.0028;
        const mixed = DIM.clone().lerp(ACCENT, Math.random());
        colors[i * 3] = mixed.r;
        colors[i * 3 + 1] = mixed.g;
        colors[i * 3 + 2] = mixed.b;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 0.055,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const points = new THREE.Points(geometry, material);
      scene.add(points);
      streams.push({
        points,
        progress,
        speed,
        origin: origins[s],
        swirl: (s % 2 === 0 ? 1 : -1) * (0.9 + s * 0.35),
      });
    }

    const scratch = new THREE.Vector3();
    const updateStreams = () => {
      for (const stream of streams) {
        const pos = stream.points.geometry.attributes.position
          .array as Float32Array;
        for (let i = 0; i < PARTICLES_PER_STREAM; i++) {
          let t = stream.progress[i] + stream.speed[i] * (reduceMotion ? 0 : 1);
          if (t >= 1) t = 0;
          stream.progress[i] = t;

          // Curved path: lerp origin→core with a swirl around the axis and a
          // slight per-particle spread so the stream has body.
          const spread = ((i % 60) / 60 - 0.5) * 1.6;
          scratch.copy(stream.origin).multiplyScalar(1 - t);
          const angle = t * Math.PI * 2 * 0.35 * stream.swirl + i * 0.13;
          const radius = (1 - t) * 0.9;
          scratch.x += Math.cos(angle) * radius + spread * (1 - t) * 0.4;
          scratch.y += Math.sin(angle) * radius * 0.6;
          scratch.z += Math.sin(angle * 0.7) * radius * 0.5;
          // Ease into the core surface rather than the exact center
          const coreT = Math.min(1, t * 1.06);
          scratch.multiplyScalar(1 - coreT * 0.12);

          pos[i * 3] = scratch.x;
          pos[i * 3 + 1] = scratch.y;
          pos[i * 3 + 2] = scratch.z;
        }
        stream.points.geometry.attributes.position.needsUpdate = true;
      }
    };

    // Mouse parallax
    const target = { x: 0, y: 0 };
    const onPointerMove = (e: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      target.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      target.y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    window.addEventListener('pointermove', onPointerMove);

    // ResizeObserver (not window resize): the mount's size can change after
    // first paint (CSS loading, breakpoint shifts) without a window resize.
    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(mount);

    let frame = 0;
    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      frame++;

      if (!reduceMotion) {
        coreOuter.rotation.y += 0.0022;
        coreOuter.rotation.x += 0.0009;
        coreInner.rotation.y -= 0.0035;
        coreInner.rotation.z += 0.0014;
        const pulse = 1 + Math.sin(frame * 0.02) * 0.04;
        coreInner.scale.setScalar(pulse);
        glow.intensity = 3.4 + Math.sin(frame * 0.02) * 1.2;
      }

      updateStreams();

      camera.position.x += (target.x * 0.8 - camera.position.x) * 0.03;
      camera.position.y += (0.6 - target.y * 0.5 - camera.position.y) * 0.03;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointerMove);
      resizeObserver.disconnect();
      streams.forEach((s) => {
        s.points.geometry.dispose();
        (s.points.material as THREE.Material).dispose();
      });
      coreOuter.geometry.dispose();
      (coreOuter.material as THREE.Material).dispose();
      coreInner.geometry.dispose();
      (coreInner.material as THREE.Material).dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-70"
    />
  );
}
