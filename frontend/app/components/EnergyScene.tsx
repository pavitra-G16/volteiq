'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RotateCcw } from 'lucide-react';

type NodeKey = 'solar' | 'home' | 'grid';
const nodeCopy: Record<NodeKey, { title: string; description: string }> = {
  solar: { title: 'Solar input', description: 'A visual stand-in for possible on-site generation. VolteIQ does not currently connect to a live solar system.' },
  home: { title: 'Household use', description: 'Verified bill records provide consumption history. The 3D scene itself uses no household measurements.' },
  grid: { title: 'Grid connection', description: 'Bill and tariff assumptions can inform scenarios. Check the dashboard to see the inputs behind an estimate.' },
};

export default function EnergyScene({ variant = 'hero' }: { variant?: 'hero' | 'compact' }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selected, setSelected] = useState<NodeKey>('home');
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      window.requestAnimationFrame(() => setFallback(true));
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, variant === 'compact' ? 4.7 : 4.3, variant === 'compact' ? 12.4 : 11.5);
    camera.lookAt(0, variant === 'compact' ? 1.05 : 1.25, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene.add(new THREE.HemisphereLight(0x9cefe1, 0x102031, 2.15));
    const keyLight = new THREE.DirectionalLight(0xd1fff0, 3.2); keyLight.position.set(-4, 8, 6); keyLight.castShadow = true; keyLight.shadow.mapSize.set(1024, 1024); keyLight.shadow.camera.left = -6; keyLight.shadow.camera.right = 6; keyLight.shadow.camera.top = 7; keyLight.shadow.camera.bottom = -4; scene.add(keyLight);
    const cyanLight = new THREE.PointLight(0x24e7cb, 25, 11); cyanLight.position.set(3, 3, 2); scene.add(cyanLight);
    const violetLight = new THREE.PointLight(0x7763ff, 20, 12); violetLight.position.set(-4, 3, -2); scene.add(violetLight);
    const group = new THREE.Group(); scene.add(group);
    const interactive: THREE.Object3D[] = [];

    const material = (color: number, emissive = 0, roughness = 0.42) => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: emissive ? 0.65 : 0, roughness, metalness: 0.3 });
    const navy = material(0x193044, 0x071620);
    const glass = new THREE.MeshStandardMaterial({ color: 0x153d50, emissive: 0x0b7280, emissiveIntensity: 0.55, metalness: 0.62, roughness: 0.25 });
    const teal = material(0x51e0c8, 0x0ba995);
    const lime = material(0xc5ec65, 0x638317);
    const dark = material(0x0c1b28, 0x06101b);
    const foliage = new THREE.MeshStandardMaterial({ color: 0x2f8f70, emissive: 0x103f36, emissiveIntensity: 0.38, roughness: 0.8 });
    const grass = new THREE.MeshStandardMaterial({ color: 0x0b252c, emissive: 0x06161f, emissiveIntensity: 0.24, roughness: 0.95 });

    const addMesh = (geometry: THREE.BufferGeometry, mat: THREE.Material, position: [number, number, number], key?: NodeKey) => {
      const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true;
      if (key) { mesh.userData.energyNode = key; interactive.push(mesh); }
      group.add(mesh); return mesh;
    };
    // Floating architectural platform and a softly glowing guide ring.
    addMesh(new THREE.CylinderGeometry(4.5, 4.5, 0.12, 96), dark, [0, -0.12, 0]);
    addMesh(new THREE.CylinderGeometry(4.43, 4.43, 0.035, 96), grass, [0, -0.045, 0]);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.18, 0.012, 8, 120), new THREE.MeshBasicMaterial({ color: 0x2acdb7, transparent: true, opacity: 0.56 })); ring.rotation.x = Math.PI / 2; ring.position.y = -0.04; group.add(ring);
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2;
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 10), new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0xbfe86a : 0x40dbc6, transparent: true, opacity: 0.7 }));
      dot.position.set(Math.cos(a) * 4.17, -0.035, Math.sin(a) * 4.17); group.add(dot);
    }
    // Small landscaped trees and garden beds give the architectural model a sense of place.
    for (const [x, z, size] of [[-3.05, 0.75, 0.78], [-2.65, -1.15, 0.62], [2.45, -1.6, 0.66], [2.82, 1.35, 0.76]] as const) {
      const bed = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.62, size * 0.7, 0.07, 20), material(0x245d50, 0x0d2f2a)); bed.position.set(x, 0.01, z); group.add(bed);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * size, 0.105 * size, 0.76 * size, 8), material(0x765d49)); trunk.position.set(x, 0.36 * size, z); trunk.castShadow = true; group.add(trunk);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38 * size, 1), foliage); crown.position.set(x, 0.86 * size, z); crown.scale.y = 1.18; crown.castShadow = true; group.add(crown);
      const crownTop = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28 * size, 1), material(0x4eaf7e, 0x13523f)); crownTop.position.set(x + 0.1 * size, 1.12 * size, z + 0.04); crownTop.castShadow = true; group.add(crownTop);
    }

    // Home shell and gabled roof, built as actual mesh geometry.
    addMesh(new THREE.BoxGeometry(3.05, 1.86, 2.15), navy, [0, 1.02, 0], 'home');
    const roofShape = new THREE.Shape(); roofShape.moveTo(-1.73, 1.86); roofShape.lineTo(0, 3.02); roofShape.lineTo(1.73, 1.86); roofShape.closePath();
    const roofGeometry = new THREE.ExtrudeGeometry(roofShape, { depth: 2.3, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.035, bevelThickness: 0.04 });
    roofGeometry.translate(0, 0, -1.15);
    addMesh(roofGeometry, material(0x213b4e, 0x081a26), [0, 0, 0], 'home');
    // Glazed front windows and doorway.
    for (const x of [-0.93, 0.93]) {
      const pane = addMesh(new THREE.BoxGeometry(0.65, 0.67, 0.055), glass, [x, 1.11, 1.1], 'home'); pane.userData.energyNode = 'home';
      addMesh(new THREE.BoxGeometry(0.045, 0.7, 0.07), teal, [x, 1.11, 1.14]);
    }
    addMesh(new THREE.BoxGeometry(0.48, 0.95, 0.09), material(0x102532), [0, 0.54, 1.13], 'home');

    // A visibly distinct rooftop solar array.
    const panels = new THREE.Group(); panels.position.set(-0.05, 2.35, 1.2); panels.rotation.z = -0.34; panels.userData.energyNode = 'solar'; group.add(panels); interactive.push(panels);
    const panelMaterial = new THREE.MeshStandardMaterial({ color: 0x0c3547, emissive: 0x087488, emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.22 });
    const panelBase = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.65, 0.075), panelMaterial); panels.add(panelBase);
    const reflection = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.62, 0.015), new THREE.MeshBasicMaterial({ color: 0xcafff3, transparent: true, opacity: 0.6 })); reflection.position.set(-0.7, 0, 0.055); panels.add(reflection);
    for (let x = -0.51; x <= 0.51; x += 0.34) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.62, 0.012), new THREE.MeshBasicMaterial({ color: 0x69d9d3, transparent: true, opacity: 0.72 })); line.position.x = x; line.position.z = 0.045; panels.add(line);
    }
    for (const y of [-0.15, 0.15]) { const line = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.016, 0.012), new THREE.MeshBasicMaterial({ color: 0x69d9d3, transparent: true, opacity: 0.65 })); line.position.y = y; line.position.z = 0.047; panels.add(line); }

    // Appliance node inside the home: an explanatory visual element, not a measured device.
    const appliance = new THREE.Group(); appliance.position.set(1.05, 0.55, 0.67); appliance.userData.energyNode = 'home'; group.add(appliance); interactive.push(appliance);
    const applianceBody = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.83, 0.42), material(0x254457, 0x0a2832)); appliance.add(applianceBody);
    const applianceGlow = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.11, 0.025), lime); applianceGlow.position.set(0, 0.23, 0.22); appliance.add(applianceGlow);

    // Grid connection node.
    const grid = new THREE.Group(); grid.position.set(3.15, 0.06, 0.4); grid.userData.energyNode = 'grid'; group.add(grid); interactive.push(grid);
    const pylonMat = material(0x426275, 0x0b1c2b);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.08, 2.85, 8), pylonMat); mast.position.y = 1.28; grid.add(mast);
    for (const y of [1.5, 2.02, 2.53]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.045, 0.055), pylonMat); arm.position.y = y; grid.add(arm);
      for (const x of [-0.48, 0, 0.48]) { const insulator = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8), teal); insulator.position.set(x, y - 0.13, 0); grid.add(insulator); }
    }
    const gridHalo = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.018, 8, 48), new THREE.MeshBasicMaterial({ color: 0x50dbc4, transparent: true, opacity: 0.7 })); gridHalo.rotation.x = Math.PI / 2; gridHalo.position.y = 0.08; grid.add(gridHalo);

    // Tubular paths and moving light particles communicate flow without implying live readings.
    const paths: THREE.CatmullRomCurve3[] = [
      new THREE.CatmullRomCurve3([new THREE.Vector3(-0.38, 2.2, 1.28), new THREE.Vector3(-0.74, 1.8, 1.34), new THREE.Vector3(-0.35, 1.28, 1.34), new THREE.Vector3(0.42, 0.83, 1.2), new THREE.Vector3(0.86, 0.61, 0.94)]),
      new THREE.CatmullRomCurve3([new THREE.Vector3(0.45, 0.36, 1.17), new THREE.Vector3(1.32, 0.24, 1.12), new THREE.Vector3(2.15, 0.44, 0.92), new THREE.Vector3(3.12, 0.48, 0.4)]),
      new THREE.CatmullRomCurve3([new THREE.Vector3(0.14, 0.5, 1.25), new THREE.Vector3(0.52, 0.35, 1.28), new THREE.Vector3(0.82, 0.5, 1.12), new THREE.Vector3(1.05, 0.65, 0.86)]),
    ];
    paths.forEach((path, index) => {
      const color = index === 1 ? 0x9ce86b : index === 2 ? 0x55bfff : 0x39e8d2;
      group.add(new THREE.Mesh(new THREE.TubeGeometry(path, 48, 0.07, 8, false), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, depthWrite: false })));
      group.add(new THREE.Mesh(new THREE.TubeGeometry(path, 48, 0.018, 8, false), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })));
    });
    const particles = paths.flatMap((path, p) => Array.from({ length: 4 }, (_, i) => {
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(i === 0 ? 0.075 : 0.047, 12, 12), new THREE.MeshBasicMaterial({ color: p === 1 ? 0xc5ec65 : p === 2 ? 0x73bdff : 0x70f4dd })); group.add(sphere); return { sphere, path, phase: (i / 4 + p * 0.31) % 1 };
    }));
    const floatPositions = new Float32Array(32 * 3);
    for (let i = 0; i < 32; i++) { const angle = i * 2.399; const radius = 1.6 + (i % 5) * 0.48; floatPositions[i * 3] = Math.cos(angle) * radius; floatPositions[i * 3 + 1] = 0.4 + (i % 7) * 0.43; floatPositions[i * 3 + 2] = Math.sin(angle) * radius; }
    const floatGeometry = new THREE.BufferGeometry(); floatGeometry.setAttribute('position', new THREE.BufferAttribute(floatPositions, 3));
    const floatField = new THREE.Points(floatGeometry, new THREE.PointsMaterial({ color: 0x92f4d9, size: 0.035, transparent: true, opacity: 0.68, sizeAttenuation: true })); group.add(floatField);

    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
    let dragging = false; let lastX = 0; let startX = 0; let startY = 0; let targetY = -0.08; let targetX = 0.04; let frame = 0; let disposed = false;
    let hoveredObject: THREE.Object3D | null = null;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const resize = () => { const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return; renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix(); renderer.render(scene, camera); };
    const selectFromPointer = (event: PointerEvent, hover = false) => {
      const rect = canvas.getBoundingClientRect(); pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(interactive, true); let hitObject: THREE.Object3D | null = hits[0]?.object || null;
      while (hitObject && !hitObject.userData.energyNode) hitObject = hitObject.parent;
      const key = hitObject?.userData.energyNode as NodeKey | undefined;
      if (hitObject !== hoveredObject) { if (hoveredObject) hoveredObject.scale.setScalar(1); hoveredObject = hitObject; if (hoveredObject) hoveredObject.scale.setScalar(1.045); }
      canvas.style.cursor = key ? 'pointer' : dragging ? 'grabbing' : 'grab';
      if (key && !dragging) canvas.dispatchEvent(new CustomEvent('energy-node', { detail: key }));
      if (hover && key) canvas.dataset.hoverNode = key;
    };
    const onMove = (event: PointerEvent) => {
      if (dragging) { targetY += (event.clientX - lastX) * 0.006; targetX = THREE.MathUtils.clamp(targetX + (event.clientY - (canvas.dataset.lastY ? Number(canvas.dataset.lastY) : event.clientY)) * 0.003, -0.3, 0.22); }
      else if (!reducedMotion) { const rect = canvas.getBoundingClientRect(); targetY = -0.08 + ((event.clientX - rect.left) / rect.width - 0.5) * 0.12; targetX = 0.04 + ((event.clientY - rect.top) / rect.height - 0.5) * 0.045; }
      if (reducedMotion) { group.rotation.y = targetY; group.rotation.x = targetX; renderer.render(scene, camera); }
      lastX = event.clientX; canvas.dataset.lastY = String(event.clientY); selectFromPointer(event, true);
    };
    const onDown = (event: PointerEvent) => { dragging = true; lastX = event.clientX; startX = event.clientX; startY = event.clientY; canvas.dataset.lastY = String(event.clientY); canvas.setPointerCapture(event.pointerId); canvas.style.cursor = 'grabbing'; };
    const onUp = (event: PointerEvent) => { const wasClick = Math.abs(event.clientX - startX) < 5 && Math.abs(event.clientY - startY) < 5; dragging = false; if (wasClick) selectFromPointer(event); canvas.style.cursor = 'grab'; };
    const onLeave = () => { if (hoveredObject) hoveredObject.scale.setScalar(1); hoveredObject = null; if (!reducedMotion) { targetY = -0.08; targetX = 0.04; } };
    const onReset = () => { targetY = -0.08; targetX = 0.04; panels.position.y = 2.35; setSelected('home'); if (reducedMotion) { group.rotation.set(targetX, targetY, 0); renderer.render(scene, camera); } };
    const onNode = (event: Event) => setSelected((event as CustomEvent<NodeKey>).detail);
    canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp); canvas.addEventListener('pointerleave', onLeave); canvas.addEventListener('energy-reset', onReset); canvas.addEventListener('energy-node', onNode); window.addEventListener('resize', resize);
    resize(); window.requestAnimationFrame(() => setReady(true));
    const animate = () => {
      if (disposed) return;
      if (!reducedMotion) {
        frame = requestAnimationFrame(animate);
        group.rotation.y += (targetY - group.rotation.y) * 0.045; group.rotation.x += (targetX - group.rotation.x) * 0.045;
        const t = performance.now() * 0.00016;
        particles.forEach(({ sphere, path, phase }) => { const progress = (t + phase) % 1; sphere.position.copy(path.getPoint(progress)); sphere.scale.setScalar(0.76 + 0.24 * Math.sin(progress * Math.PI * 2) ** 2); });
        panels.position.y = 2.35 + Math.sin(performance.now() * 0.0007) * 0.035; ring.rotation.z += 0.00008;
        reflection.position.x = -0.7 + ((performance.now() * 0.00032) % 1.4);
        panelMaterial.emissiveIntensity = 0.72 + Math.sin(performance.now() * 0.001) * 0.16;
        floatField.rotation.y += 0.0003;
      }
      renderer.render(scene, camera);
    };
    animate();
    return () => {
      disposed = true; cancelAnimationFrame(frame); window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp); canvas.removeEventListener('pointerleave', onLeave); canvas.removeEventListener('energy-reset', onReset); canvas.removeEventListener('energy-node', onNode);
      scene.traverse(obj => { if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) { obj.geometry.dispose(); const mats = Array.isArray(obj.material) ? obj.material : [obj.material]; mats.forEach(mat => mat.dispose()); } }); renderer.dispose();
    };
  }, [variant]);

  return <div className="energy-scene-wrap" data-variant={variant}>
    <canvas ref={canvasRef} className="energy-scene-canvas" aria-label="Interactive 3D energy network. Drag to rotate or select a node." />
    {!ready && !fallback && <div className="scene-status">Preparing the energy model…</div>}
    {fallback && <div className="scene-fallback" role="status"><span className="fallback-house">⌂</span><strong>Explore the home energy loop</strong><p>This browser could not start WebGL. Use the dashboard for the real energy records and recommendations.</p></div>}
    {ready && <><div className="scene-info" aria-live="polite"><span>{selected === 'home' ? '01' : selected === 'solar' ? '02' : '03'} / ENERGY NODE</span><strong>{nodeCopy[selected].title}</strong><p>{nodeCopy[selected].description}</p></div><div className="scene-node-buttons" aria-label="Explore energy model nodes">{(['solar','home','grid'] as NodeKey[]).map(key=><button key={key} type="button" aria-pressed={selected===key} onClick={()=>setSelected(key)}>{nodeCopy[key].title}</button>)}<button type="button" className="scene-reset" onClick={()=>canvasRef.current?.dispatchEvent(new Event('energy-reset'))} aria-label="Reset 3D view"><RotateCcw size={12}/><span>Reset view</span></button></div></>}
  </div>;
}
