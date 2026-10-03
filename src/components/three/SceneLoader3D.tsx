"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { THREECOLORS } from "@/lib/three-palette";

/**
 * The "next slide is being written" moment, made watchable.
 *
 * A small raw-three.js scene in the project's own palette: a breathing
 * wireframe icosahedron (the slide being formed) wrapped in two orbit rings
 * and a sparse particle drift. Deliberately lighter than the hero
 * `KnowledgeCore` — one geometry, no GSAP, a rAF loop that sleeps offscreen —
 * because this mounts and unmounts once per slide of every generated deck.
 *
 * Honest fallbacks: `prefers-reduced-motion` renders one still frame, and a
 * machine without WebGL gets a CSS pulse. The HTML label and progress bar
 * stay readable in all three cases.
 */
export function SceneLoader3D({
  label,
  progress,
}: {
  /** e.g. "Đang viết cảnh 4…" — what the wait is for. */
  label: string;
  /** 0..100, deck progress for the bar under the label. */
  progress: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [noWebGL, setNoWebGL] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: (window.devicePixelRatio || 1) < 2,
        alpha: true,
        powerPreference: "low-power",
      });
    } catch {
      setNoWebGL(true);
      return;
    }

    const width = Math.max(host.clientWidth, 280);
    const height = 220;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = `${height}px`;
    renderer.domElement.style.display = "block";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 60);
    camera.position.set(0, 0, 6.2);
    const world = new THREE.Group();
    scene.add(world);

    // The forming slide: a wireframe shell that breathes.
    const coreGeometry = new THREE.IcosahedronGeometry(1.35, 1);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: THREECOLORS.brand400,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    world.add(core);

    const seedGeometry = new THREE.IcosahedronGeometry(0.55, 0);
    const seedMaterial = new THREE.MeshBasicMaterial({
      color: THREECOLORS.gold400,
      transparent: true,
      opacity: 0.9,
    });
    const seed = new THREE.Mesh(seedGeometry, seedMaterial);
    world.add(seed);

    // Two orbit rings, counter-rotating.
    const rings: THREE.LineLoop[] = [];
    [THREECOLORS.brand300, THREECOLORS.gold300].forEach((color, index) => {
      const radius = 2.1 + index * 0.45;
      const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2, false, 0);
      const geometry = new THREE.BufferGeometry().setFromPoints(
        curve.getPoints(120).map((point) => new THREE.Vector3(point.x, point.y, 0)),
      );
      const ring = new THREE.LineLoop(
        geometry,
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.4 }),
      );
      ring.rotation.set(0.5 + index * 0.7, index * 0.5, index * 0.4);
      rings.push(ring);
      world.add(ring);
    });

    // Sparse drift: 220 points, teal-dominant with a warm minority.
    const palette = [THREECOLORS.brand300, THREECOLORS.brand400, THREECOLORS.gold400];
    const count = 220;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const tint = new THREE.Color();
    for (let i = 0; i < count; i += 1) {
      const radius = 2.8 + Math.random() * 4.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi) * 0.7;
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta) - 1;
      tint.setHex(palette[Math.floor(Math.random() * palette.length)]);
      colors[i * 3] = tint.r;
      colors[i * 3 + 1] = tint.g;
      colors[i * 3 + 2] = tint.b;
    }
    const fieldGeometry = new THREE.BufferGeometry();
    fieldGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    fieldGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const field = new THREE.Points(
      fieldGeometry,
      new THREE.PointsMaterial({
        size: 0.05,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    world.add(field);

    const clock = new THREE.Clock();
    let raf = 0;
    let visible = true;
    const tick = () => {
      if (!visible) return;
      const delta = Math.min(clock.getDelta(), 0.05);
      const time = clock.elapsedTime;
      // Breathe: the shell swells while the slide is being written.
      const breath = 1 + Math.sin(time * 1.6) * 0.07;
      core.scale.setScalar(breath);
      core.rotation.y += delta * 0.5;
      core.rotation.x += delta * 0.18;
      seed.rotation.y -= delta * 0.8;
      seed.rotation.x += delta * 0.3;
      rings[0].rotation.z += delta * 0.6;
      rings[1].rotation.z -= delta * 0.45;
      field.rotation.y += delta * 0.03;
      world.rotation.y = Math.sin(time * 0.24) * 0.18;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const observer = new IntersectionObserver(
      (entries) => {
        const seen = entries.some((entry) => entry.isIntersecting);
        if (seen === visible) return;
        visible = seen;
        if (seen) {
          clock.getDelta();
          raf = requestAnimationFrame(tick);
        } else {
          cancelAnimationFrame(raf);
        }
      },
      { threshold: 0.02 },
    );
    observer.observe(host);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
      coreGeometry.dispose();
      coreMaterial.dispose();
      seedGeometry.dispose();
      seedMaterial.dispose();
      rings.forEach((ring) => {
        ring.geometry.dispose();
        (ring.material as THREE.Material).dispose();
      });
      fieldGeometry.dispose();
      (field.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, []);

  const clamped = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div className="overflow-hidden rounded-xl border border-brand-700/50 bg-ink-950/70">
      <div ref={hostRef} className="relative" aria-hidden="true">
        {noWebGL ? (
          <div className="flex h-[220px] items-center justify-center">
            <span className="h-16 w-16 animate-ping rounded-full border-2 border-brand-400/60" />
          </div>
        ) : null}
      </div>
      <div className="space-y-1.5 px-4 pb-4">
        <p className="flex items-center gap-2 text-sm font-medium text-mist-100">
          <span className="h-2 w-2 animate-pulse rounded-full bg-gold-400" />
          {label}
        </p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-400 to-gold-400 transition-[width] duration-500"
            style={{ width: `${Math.max(2, clamped)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
