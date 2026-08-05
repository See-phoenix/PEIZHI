"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Lightweight Three.js starfield — soft depth parallax, pauses when tab hidden.
 * Intentionally low particle count for 60fps on mid devices.
 */
export function StarfieldCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || prefersReducedMotion()) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.z = 6;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const COUNT = 720;
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const pink = new THREE.Color("#ff4d9a");
    const cyan = new THREE.Color("#4de8ff");
    const violet = new THREE.Color("#c4b5fd");

    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 18;
      positions[i3 + 1] = (Math.random() - 0.5) * 12;
      positions[i3 + 2] = (Math.random() - 0.5) * 10;
      const c = i % 3 === 0 ? pink : i % 3 === 1 ? cyan : violet;
      colors[i3] = c.r;
      colors[i3 + 1] = c.g;
      colors[i3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.035,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    // Soft neon torus — “立体感” focal object
    const torus = new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.55, 0.14, 100, 14),
      new THREE.MeshBasicMaterial({
        color: "#ff4d9a",
        wireframe: true,
        transparent: true,
        opacity: 0.22,
      })
    );
    torus.position.set(2.6, 0.8, -1.2);
    scene.add(torus);

    const torus2 = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.42, 0),
      new THREE.MeshBasicMaterial({
        color: "#4de8ff",
        wireframe: true,
        transparent: true,
        opacity: 0.2,
      })
    );
    torus2.position.set(-2.8, -0.6, -0.8);
    scene.add(torus2);

    let raf = 0;
    let running = true;
    const mouse = { x: 0, y: 0 };

    const onResize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };

    const onMove = (e: PointerEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    const onVis = () => {
      running = document.visibilityState === "visible";
      if (running) loop();
    };

    const loop = () => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      points.rotation.y += 0.00055;
      points.rotation.x += 0.00018;
      torus.rotation.x += 0.004;
      torus.rotation.y += 0.006;
      torus2.rotation.y -= 0.005;
      camera.position.x += (mouse.x * 0.35 - camera.position.x) * 0.04;
      camera.position.y += (mouse.y * 0.25 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };

    onResize();
    loop();
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
      geo.dispose();
      mat.dispose();
      torus.geometry.dispose();
      (torus.material as THREE.Material).dispose();
      torus2.geometry.dispose();
      (torus2.material as THREE.Material).dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    />
  );
}
