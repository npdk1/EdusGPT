"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { ensureGsap, prefersReducedMotion, ScrollTrigger } from "@/lib/gsap";
import { PARTICLE_COLORS, THREECOLORS } from "@/lib/three-palette";

interface KnowledgeCoreProps {
  className?: string;
  /** 1 = desktop, 0.55 = phones. Scales particle count only. */
  density?: number;
  interactive?: boolean;
}

/**
 * The hero's WebGL layer: a wireframe "knowledge core" with orbital rings and
 * a drifting particle field, driven by GSAP (intro timeline, pointer parallax,
 * scroll-linked camera). Kept to raw three.js — no react-three-fiber — so the
 * bundle stays small and the render loop stays under our own control.
 */
export function KnowledgeCore({
  className,
  density = 1,
  interactive = true,
}: KnowledgeCoreProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const gsap = ensureGsap();
    const reduced = prefersReducedMotion();
    const width = Math.max(host.clientWidth, 320);
    const height = Math.max(host.clientHeight, 320);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: (window.devicePixelRatio || 1) < 2,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      return; // no WebGL — the CSS gradient backdrop carries the hero
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 120);
    camera.position.set(0, 0, 6.4);

    const world = new THREE.Group();
    scene.add(world);

    // --- knowledge core: two nested icosahedra -----------------------------
    const coreGeometry = new THREE.IcosahedronGeometry(1.55, 1);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: THREECOLORS.brand400,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    world.add(core);

    const innerGeometry = new THREE.IcosahedronGeometry(1.02, 0);
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: THREECOLORS.ink800,
      transparent: true,
      opacity: 0.92,
    });
    world.add(new THREE.Mesh(innerGeometry, innerMaterial));

    // glowing vertices = "concepts"
    const nodeGeometry = new THREE.BufferGeometry();
    nodeGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        Array.from(coreGeometry.getAttribute("position").array),
        3,
      ),
    );
    const nodeMaterial = new THREE.PointsMaterial({
      color: THREECOLORS.gold400,
      size: 0.06,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    world.add(new THREE.Points(nodeGeometry, nodeMaterial));

    // --- orbital rings -----------------------------------------------------
    const orbitColors = [THREECOLORS.brand300, THREECOLORS.gold300, THREECOLORS.brand700];
    const orbits: THREE.LineLoop[] = [];
    const orbitMaterials: THREE.LineBasicMaterial[] = [];
    orbitColors.forEach((color, index) => {
      const radius = 2.15 + index * 0.42;
      const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2, false, 0);
      const geometry = new THREE.BufferGeometry().setFromPoints(
        curve.getPoints(140).map((point) => new THREE.Vector3(point.x, point.y, 0)),
      );
      const material = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.34 - index * 0.05,
      });
      const ring = new THREE.LineLoop(geometry, material);
      ring.rotation.set(index * 0.85 + 0.35, index * 0.6, index * 0.25);
      orbits.push(ring);
      orbitMaterials.push(material);
      world.add(ring);
    });

    // --- drifting particle field ------------------------------------------
    const particleCount = Math.round(1700 * density);
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const tint = new THREE.Color();
    for (let index = 0; index < particleCount; index += 1) {
      const radius = 3.1 + Math.pow(Math.random(), 0.7) * 7.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[index * 3 + 1] = radius * Math.cos(phi) * 0.72;
      positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
      tint.setHex(
        PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      );
      colors[index * 3] = tint.r;
      colors[index * 3 + 1] = tint.g;
      colors[index * 3 + 2] = tint.b;
    }
    const fieldGeometry = new THREE.BufferGeometry();
    fieldGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    fieldGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const fieldMaterial = new THREE.PointsMaterial({
      size: 0.038,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const field = new THREE.Points(fieldGeometry, fieldMaterial);
    world.add(field);

    // --- GSAP drives the 3D rig -------------------------------------------
    const rig = { zoom: reduced ? 6.4 : 10.8 };
    let scrollProgress = 0;
    let scrollVelocity = 0;
    const pointer = { x: 0, y: 0 };
    const idleSpin = reduced ? 0 : 1;

    const ctx = gsap.context(() => {
      const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
      intro
        .to(rig, { zoom: 6.4, duration: 1.7 }, 0)
        .fromTo(
          world.scale,
          { x: 0.6, y: 0.6, z: 0.6 },
          { x: 1, y: 1, z: 1, duration: 1.5 },
          0,
        )
        .fromTo(coreMaterial, { opacity: 0 }, { opacity: 0.5, duration: 1.1 }, 0.25)
        .fromTo(nodeMaterial, { opacity: 0 }, { opacity: 0.9, duration: 1 }, 0.5)
        .fromTo(fieldMaterial, { opacity: 0 }, { opacity: 0.72, duration: 1.7 }, 0.35)
        .fromTo(
          orbitMaterials,
          { opacity: 0 },
          {
            opacity: (index: number) => 0.34 - index * 0.05,
            duration: 1.2,
            stagger: 0.12,
          },
          0.55,
        );

      if (reduced) {
        intro.progress(1);
        return;
      }

      gsap.to(core.rotation, { y: Math.PI * 2, duration: 52, repeat: -1, ease: "none" });
      gsap.to(innerMaterial, {
        opacity: 0.62,
        duration: 4.4,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
      orbits.forEach((ring, index) => {
        gsap.to(ring.rotation, {
          z: ring.rotation.z + (index % 2 === 0 ? Math.PI * 2 : -Math.PI * 2),
          duration: 30 + index * 11,
          repeat: -1,
          ease: "none",
        });
      });

      ScrollTrigger.create({
        trigger: host,
        start: "top bottom",
        end: "bottom top",
        onUpdate: (self) => {
          scrollProgress = self.progress;
          scrollVelocity = self.getVelocity();
        },
      });
    }, host);

    // --- render loop -------------------------------------------------------
    const clock = new THREE.Clock();
    let running = false;

    const tick = () => {
      const delta = Math.min(clock.getDelta(), 0.05);

      if (idleSpin) {
        world.rotation.y += delta * 0.055;
        field.rotation.y += delta * 0.012;
        const boost = Math.min(Math.abs(scrollVelocity) / 24000, 0.55);
        field.rotation.y += Math.sign(scrollVelocity || 1) * boost * delta * 3.2;
        scrollVelocity *= 0.9;
      }

      const targetZ = rig.zoom + scrollProgress * 3.1;
      camera.position.z += (targetZ - camera.position.z) * 0.08;
      const camX = pointer.x * 0.52;
      const camY = -pointer.y * 0.36;
      camera.position.x += (camX - camera.position.x) * 0.06;
      camera.position.y += (camY - camera.position.y) * 0.06;
      camera.lookAt(0, 0, 0);

      world.rotation.x +=
        (-0.26 + scrollProgress * 0.55 + pointer.y * 0.2 - world.rotation.x) * 0.05;

      renderer.render(scene, camera);
    };

    const setRunning = (next: boolean) => {
      if (next === running) return;
      running = next;
      if (next) {
        clock.getDelta();
        renderer.setAnimationLoop(tick);
      } else {
        renderer.setAnimationLoop(null);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      const nextWidth = Math.max(host.clientWidth, 1);
      const nextHeight = Math.max(host.clientHeight, 1);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight, false);
      if (!running) renderer.render(scene, camera);
    });
    resizeObserver.observe(host);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        setRunning(visible && document.visibilityState === "visible");
      },
      { threshold: 0.02 },
    );
    intersectionObserver.observe(host);

    const onVisibilityChange = () => {
      setRunning(document.visibilityState === "visible" && host.clientWidth > 0);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const onPointerMove = (event: PointerEvent) => {
      if (reduced) return;
      const rect = host.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
      pointer.y = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1;
    };
    const onPointerLeave = () => {
      pointer.x = 0;
      pointer.y = 0;
    };
    if (interactive && !reduced) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerout", onPointerLeave, { passive: true });
    }

    renderer.render(scene, camera);
    setRunning(true);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerout", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      setRunning(false);
      ctx.revert();
      coreGeometry.dispose();
      coreMaterial.dispose();
      innerGeometry.dispose();
      innerMaterial.dispose();
      nodeGeometry.dispose();
      nodeMaterial.dispose();
      fieldGeometry.dispose();
      fieldMaterial.dispose();
      orbits.forEach((ring) => {
        ring.geometry.dispose();
        (ring.material as THREE.Material).dispose();
      });
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, [density, interactive]);

  return <div ref={hostRef} className={className} aria-hidden="true" />;
}
