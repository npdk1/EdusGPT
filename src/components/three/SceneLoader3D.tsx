"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { THREECOLORS } from "@/lib/three-palette";

/**
 * The "next slide is being written" moment, made watchable.
 *
 * A small raw-three.js scene in the project's own palette: a tutor robot
 * wearing a graduation cap and holding a pointer stick, bobbing gently while
 * it waits for the model — wrapped in two orbit rings and a sparse particle
 * drift. Built from plain primitives (no model files, no new dependency), so
 * it mounts and unmounts once per slide without loading anything.
 *
 * Honest fallbacks: `prefers-reduced-motion` renders one still frame, and a
 * machine without WebGL gets a CSS pulse. The HTML label and progress bar
 * stay readable in all three cases.
 */
export function SceneLoader3D({
  label,
  progress,
  height = 220,
}: {
  /** e.g. "Writing scene 4…" — what the wait is for, in the screen's language. */
  label: string;
  /** 0..100, deck progress for the bar under the label. */
  progress: number;
  /** Canvas height in px; the classroom hero uses a taller stage. */
  height?: number;
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
    const stageH = Math.max(160, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, stageH, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = `${stageH}px`;
    renderer.domElement.style.display = "block";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, width / stageH, 0.1, 60);
    camera.position.set(0, 0.3, 6.4);
    const world = new THREE.Group();
    world.position.y = -0.4;
    scene.add(world);

    const disposables: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const solid = (color: number, opacity = 1) => {
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
      });
      materials.push(material);
      return material;
    };
    const box = (
      w: number,
      h: number,
      d: number,
      material: THREE.Material,
      x: number,
      y: number,
      z = 0,
    ) => {
      const geometry = new THREE.BoxGeometry(w, h, d);
      disposables.push(geometry);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      return mesh;
    };
    const ball = (
      radius: number,
      material: THREE.Material,
      x: number,
      y: number,
      z = 0,
    ) => {
      const geometry = new THREE.SphereGeometry(radius, 20, 14);
      disposables.push(geometry);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      return mesh;
    };
    const rod = (
      radius: number,
      length: number,
      material: THREE.Material,
      x: number,
      y: number,
      z = 0,
    ) => {
      const geometry = new THREE.CylinderGeometry(radius, radius, length, 12);
      disposables.push(geometry);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      return mesh;
    };

    // --- the tutor robot, chibi edition ------------------------------------
    // Big round head, tiny body, big eyes with highlights, blush cheeks and
    // a graduation cap — all in the site's own blues.
    const robot = new THREE.Group();
    world.add(robot);

    // Small body with a white belly panel and a gold button.
    robot.add(box(0.95, 0.75, 0.65, solid(THREECOLORS.blue400), 0, -0.25));
    robot.add(box(0.5, 0.42, 0.06, solid(THREECOLORS.mist100), 0, -0.25, 0.34));
    robot.add(ball(0.07, solid(THREECOLORS.gold400), 0, -0.12, 0.38));

    // Big round head.
    const head = new THREE.Group();
    head.position.set(0, 0.75, 0);
    robot.add(head);
    head.add(ball(0.8, solid(THREECOLORS.blue500), 0, 0, 0));

    // Round ears on the sides.
    head.add(ball(0.16, solid(THREECOLORS.blue400), -0.82, 0.05, 0));
    head.add(ball(0.16, solid(THREECOLORS.blue400), 0.82, 0.05, 0));

    // Big cute eyes: white + deep-blue pupil + sparkle highlight. Each eye
    // lives in a group so blinking scales the whole eye at once.
    const makeEye = (x: number) => {
      const group = new THREE.Group();
      group.position.set(x, 0.1, 0.62);
      group.add(ball(0.23, solid(THREECOLORS.mist100), 0, 0, 0));
      group.add(ball(0.11, solid(THREECOLORS.blue700), 0, -0.02, 0.15));
      group.add(ball(0.045, solid(THREECOLORS.mist100), 0.06, 0.07, 0.24));
      head.add(group);
      return group;
    };
    const eyeL = makeEye(-0.3);
    const eyeR = makeEye(0.3);

    // Blush cheeks: flattened pink spheres hugging the face.
    const cheekL = ball(0.11, solid(THREECOLORS.blush), -0.52, -0.15, 0.55);
    cheekL.scale.set(1, 0.6, 0.5);
    const cheekR = ball(0.11, solid(THREECOLORS.blush), 0.52, -0.15, 0.55);
    cheekR.scale.set(1, 0.6, 0.5);
    head.add(cheekL, cheekR);

    // Smile: the lower half of a torus ring.
    const smileGeometry = new THREE.TorusGeometry(0.16, 0.035, 8, 16, Math.PI);
    disposables.push(smileGeometry);
    const smile = new THREE.Mesh(smileGeometry, solid(THREECOLORS.ink800));
    smile.position.set(0, -0.28, 0.72);
    smile.rotation.z = Math.PI;
    head.add(smile);

    // Graduation cap: mortarboard, button and a tassel hanging aside.
    const cap = new THREE.Group();
    cap.position.set(0, 0.72, 0);
    cap.rotation.z = 0.1;
    head.add(cap);
    cap.add(box(1.15, 0.09, 1.15, solid(THREECOLORS.ink800), 0, 0, 0));
    cap.add(rod(0.06, 0.09, solid(THREECOLORS.gold400), 0, 0.08, 0));
    cap.add(rod(0.02, 0.45, solid(THREECOLORS.gold400), 0.5, -0.24, 0.25));
    cap.add(ball(0.045, solid(THREECOLORS.gold300), 0.5, -0.48, 0.25));

    // Short legs and feet.
    robot.add(box(0.28, 0.4, 0.36, solid(THREECOLORS.blue700), -0.24, -0.85));
    robot.add(box(0.28, 0.4, 0.36, solid(THREECOLORS.blue700), 0.24, -0.85));
    robot.add(box(0.4, 0.14, 0.55, solid(THREECOLORS.ink800), -0.24, -1.1));
    robot.add(box(0.4, 0.14, 0.55, solid(THREECOLORS.ink800), 0.24, -1.1));

    // Left arm hangs relaxed.
    const armLeft = rod(0.09, 0.6, solid(THREECOLORS.blue400), -0.6, -0.3);
    armLeft.rotation.z = 0.25;
    robot.add(armLeft);

    // Right arm raises the pointer stick, like pointing at a board.
    const armRight = new THREE.Group();
    armRight.position.set(0.55, -0.05, 0);
    robot.add(armRight);
    const upperArm = rod(0.09, 0.55, solid(THREECOLORS.blue400), 0, -0.15, 0);
    upperArm.rotation.z = -0.5;
    armRight.add(upperArm);
    const pointer = rod(0.028, 1.5, solid(THREECOLORS.blue700), 0.55, 0.55, 0);
    pointer.rotation.z = -0.9;
    armRight.add(pointer);
    const tipMaterial = solid(THREECOLORS.blue300);
    const tip = ball(0.07, tipMaterial, 1.18, 0.9, 0);
    armRight.add(tip);

    // --- orbit rings -------------------------------------------------------
    const rings: THREE.LineLoop[] = [];
    [THREECOLORS.brand300, THREECOLORS.gold300].forEach((color, index) => {
      const radius = 2.35 + index * 0.45;
      const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2, false, 0);
      const geometry = new THREE.BufferGeometry().setFromPoints(
        curve.getPoints(120).map((point) => new THREE.Vector3(point.x, point.y, 0)),
      );
      disposables.push(geometry);
      const material = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.35,
      });
      materials.push(material);
      const ring = new THREE.LineLoop(geometry, material);
      ring.rotation.set(0.5 + index * 0.7, index * 0.5, index * 0.4);
      rings.push(ring);
      world.add(ring);
    });

    // --- sparse particle drift ---------------------------------------------
    const palette = [THREECOLORS.brand300, THREECOLORS.brand400, THREECOLORS.gold400];
    const count = 200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const tint = new THREE.Color();
    for (let i = 0; i < count; i += 1) {
      const radius = 2.9 + Math.random() * 4.2;
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
    disposables.push(fieldGeometry);
    fieldGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    fieldGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const fieldMaterial = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    materials.push(fieldMaterial);
    const field = new THREE.Points(fieldGeometry, fieldMaterial);
    world.add(field);

    const clock = new THREE.Clock();
    let raf = 0;
    let visible = true;
    const tipBase = 1;
    const tick = () => {
      if (!visible) return;
      const delta = Math.min(clock.getDelta(), 0.05);
      const time = clock.elapsedTime;
      // Idle life: bobbing, a slight sway, and the head nodding along.
      robot.position.y = Math.sin(time * 2.1) * 0.09;
      robot.rotation.y = Math.sin(time * 0.55) * 0.16;
      head.rotation.z = Math.sin(time * 1.3) * 0.07;
      // Blink: both eyes shut briefly every few seconds.
      const blink = time % 3.4;
      const lid = blink > 3.2 ? 0.12 : 1;
      eyeL.scale.y += (lid - eyeL.scale.y) * 0.5;
      eyeR.scale.y = eyeL.scale.y;
      // The pointer waves at the imaginary board; its tip breathes.
      armRight.rotation.z = Math.sin(time * 1.6) * 0.09;
      tip.scale.setScalar(tipBase + Math.sin(time * 3.2) * 0.18);
      rings[0].rotation.z += delta * 0.6;
      rings[1].rotation.z -= delta * 0.45;
      field.rotation.y += delta * 0.03;
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
      disposables.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [height]);

  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  const stageStyle = { height: `${Math.max(160, height)}px` } as const;

  return (
    <div className="overflow-hidden rounded-xl border border-brand-700/50 bg-ink-950/70">
      <div ref={hostRef} className="relative" aria-hidden="true">
        {noWebGL ? (
          <div className="flex items-center justify-center" style={stageStyle}>
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
