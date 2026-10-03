"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { THREECOLORS } from "@/lib/three-palette";
import type { Simulation3DConfig } from "@/lib/lesson/types";
import { fill, useCopy } from "@/i18n/provider";

const COPY = {
  en: {
    simLabel: "Interactive 3D model (drag to rotate, use the slider)",
    simSpeed: "Speed: {value}×",
  },
  vi: {
    simLabel: "Mô hình 3D tương tác (Cầm xoay/điều chỉnh)",
    simSpeed: "Tốc độ: {value}x",
  },
};

interface InteractiveSimulationProps {
  config?: Simulation3DConfig;
  className?: string;
}

export function InteractiveSimulation({ config, className }: InteractiveSimulationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [param, setParam] = useState(config?.parameters?.speed ?? 1.5);
  const t = useCopy(COPY);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 300;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1.5, 4.5);
    camera.lookAt(0, 0, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);

    const type = config?.type ?? "physics-pendulum";

    // Objects depending on simulation type
    if (type === "physics-pendulum") {
      // Base stand
      const baseGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.08, 32);
      const baseMat = new THREE.MeshBasicMaterial({ color: THREECOLORS.ink700, wireframe: true });
      group.add(new THREE.Mesh(baseGeo, baseMat));

      // Rod
      const rodGeo = new THREE.CylinderGeometry(0.03, 0.03, 2, 16);
      const rodMat = new THREE.MeshBasicMaterial({ color: THREECOLORS.mist100 });
      const rod = new THREE.Mesh(rodGeo, rodMat);
      rod.position.y = 1;
      group.add(rod);

      // Pendulum pivot + arm
      const pivot = new THREE.Group();
      pivot.position.set(0, 1.9, 0);
      group.add(pivot);

      const armGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.6, 16);
      const armMat = new THREE.MeshBasicMaterial({ color: THREECOLORS.brand300 });
      const arm = new THREE.Mesh(armGeo, armMat);
      arm.position.y = -0.8;
      pivot.add(arm);

      // Bob (Mass)
      const bobGeo = new THREE.SphereGeometry(0.22, 32, 32);
      const bobMat = new THREE.MeshBasicMaterial({ color: THREECOLORS.gold400, wireframe: false });
      const bob = new THREE.Mesh(bobGeo, bobMat);
      bob.position.y = -1.6;
      pivot.add(bob);

      let angle = 0;
      let animId: number;
      const animate = () => {
        angle += 0.03 * param;
        pivot.rotation.z = Math.sin(angle) * 0.8;
        group.rotation.y += 0.005;
        renderer.render(scene, camera);
        animId = requestAnimationFrame(animate);
      };
      animate();

      return () => {
        cancelAnimationFrame(animId);
        renderer.dispose();
      };
    } else {
      // Default: Neural Network nodes or Atoms
      const nodeGeo = new THREE.SphereGeometry(0.12, 16, 16);
      const nodeMat = new THREE.MeshBasicMaterial({ color: THREECOLORS.brand400 });
      const nodes: THREE.Mesh[] = [];

      for (let i = 0; i < 8; i++) {
        const mesh = new THREE.Mesh(nodeGeo, nodeMat);
        mesh.position.set(
          (Math.random() - 0.5) * 2.5,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2
        );
        group.add(mesh);
        nodes.push(mesh);
      }

      // Connecting lines
      const lineMat = new THREE.LineBasicMaterial({ color: THREECOLORS.brand700, transparent: true, opacity: 0.6 });
      const lineGeo = new THREE.BufferGeometry();
      const points: THREE.Vector3[] = [];
      for (let i = 0; i < nodes.length - 1; i++) {
        points.push(nodes[i].position, nodes[i + 1].position);
      }
      lineGeo.setFromPoints(points);
      group.add(new THREE.LineSegments(lineGeo, lineMat));

      let animId: number;
      const animate = () => {
        group.rotation.y += 0.01 * param;
        group.rotation.x += 0.005 * param;
        renderer.render(scene, camera);
        animId = requestAnimationFrame(animate);
      };
      animate();

      return () => {
        cancelAnimationFrame(animId);
        renderer.dispose();
      };
    }
  }, [config, param]);

  return (
    <div className={`relative flex flex-col items-center justify-center rounded-2xl border border-ink-700/80 bg-ink-950/80 p-4 ${className ?? ""}`}>
      <div className="absolute top-3 left-4 z-10 flex items-center gap-2 text-xs font-semibold text-brand-300">
        <span className="inline-block h-2 w-2 rounded-full bg-brand-400 animate-pulse" />
        {t.simLabel}
      </div>

      <div ref={containerRef} className="h-56 w-full cursor-grab active:cursor-grabbing" />

      <div className="mt-2 flex w-full max-w-xs items-center gap-3 text-xs text-mist-300">
        <span>{fill(t.simSpeed, { value: param.toFixed(1) })}</span>
        <input
          type="range"
          min={0.2}
          max={3}
          step={0.1}
          value={param}
          onChange={(e) => setParam(parseFloat(e.target.value))}
          className="w-full accent-brand-400"
        />
      </div>
    </div>
  );
}
