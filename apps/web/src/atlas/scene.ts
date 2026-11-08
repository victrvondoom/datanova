/**
 * Datanova Atlas — High-Performance WebGL Scene Engine (Campaign 06 & 08).
 *
 * Professional 3D spatial architecture studio driven by the canonical VisGraph,
 * deterministic layout, and real-time analytical layer results.
 * Features:
 * - Dynamic PBR materials with subtle physical metalness and roughness
 * - Realistic organic node floating & breathing animations
 * - Live continuous traffic packet pulses traversing connection splines
 * - High-DPI retina label sprites with modern glassmorphism styling
 * - 3-Point studio lighting with atmospheric exponential fog
 * - Architectural hairline ground grid with origin telemetry beacon
 */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { VisGraph, VisNode } from "./graph";
import type { LayerResult } from "./layers";
import type { LayoutResult } from "./layout";
import { layoutBounds } from "./layout";

/** Type-specific semantic geometry (Task 10): shape carries meaning, not color alone. */
export function componentGeometry(type: VisNode["type"]): THREE.BufferGeometry {
  switch (type) {
    case "database": return new THREE.CylinderGeometry(1.6, 1.6, 2.4, 32);          // dimensional storage cylinder
    case "objectstore": return new THREE.BoxGeometry(2.6, 1.6, 2.0);                 // bulk storage block
    case "cache": return new THREE.CylinderGeometry(1.3, 1.3, 0.9, 24);              // flat disc
    case "queue": return new THREE.BoxGeometry(2.8, 1.2, 1.4);                        // segmented buffer
    case "gateway": return new THREE.ConeGeometry(1.6, 2.8, 5);                      // ingress structure
    case "worker": return new THREE.OctahedronGeometry(1.8);                        // processing unit
    case "external": return new THREE.TorusGeometry(1.4, 0.45, 12, 24);              // outside-boundary object
    case "client": return new THREE.SphereGeometry(1.2, 24, 18);                    // entry point
    case "analytics": return new THREE.IcosahedronGeometry(1.6);                    // analysis polyhedron
    case "broker": return new THREE.CylinderGeometry(0.9, 0.9, 2.8, 8);              // message spine
    case "service": return new THREE.BoxGeometry(2.3, 2.1, 2.3);                     // structured service block
  }
}

const TYPE_COLOR: Record<VisNode["type"], number> = {
  client: 0x38bdf8,
  gateway: 0x06b6d4,
  service: 0x6366f1,
  worker: 0x8b5cf6,
  queue: 0xf59e0b,
  cache: 0x10b981,
  database: 0x2563eb,
  objectstore: 0x0d9488,
  broker: 0xec4899,
  analytics: 0xa855f7,
  external: 0xf43f5e,
};

const EMPHASIS_TINT: Record<string, { emissive: number; opacity: number }> = {
  normal: { emissive: 0x000000, opacity: 1 },
  highlighted: { emissive: 0x1e293b, opacity: 1 },
  warning: { emissive: 0x78350f, opacity: 1 },
  critical: { emissive: 0x7f1d1d, opacity: 1 },
  dimmed: { emissive: 0x000000, opacity: 0.2 },
};

const EDGE_COLOR: Record<string, number> = {
  normal: 0x52525b,
  highlighted: 0x38bdf8,
  warning: 0xf59e0b,
  critical: 0xf43f5e,
  dimmed: 0x27272a,
};

/** Deterministic high-DPI canvas-texture label sprite (name + optional badge). */
function labelSprite(text: string, badge?: string): THREE.Sprite {
  const canvas = window.document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // Glassmorphic pill container
    ctx.fillStyle = "rgba(18, 18, 20, 0.88)";
    ctx.beginPath();
    ctx.roundRect(8, 8, 496, 112, 24);
    ctx.fill();

    // Subtle hairline border
    ctx.lineWidth = 3;
    ctx.strokeStyle = badge ? "rgba(245, 158, 11, 0.6)" : "rgba(82, 82, 91, 0.5)";
    ctx.stroke();

    // Primary component label
    ctx.font = "bold 34px -apple-system, BlinkMacSystemFont, 'Geist', 'Segoe UI', Inter, sans-serif";
    ctx.fillStyle = "#f4f4f5";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const labelText = text.length > 22 ? `${text.slice(0, 21)}…` : text;
    ctx.fillText(labelText, 256, badge ? 48 : 64);

    // Dynamic badge pill
    if (badge) {
      ctx.font = "bold 26px 'Geist Mono', ui-monospace, monospace";
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(badge, 256, 92);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  sprite.scale.set(7.2, 1.8, 1);
  return sprite;
}

export interface SceneCallbacks {
  onHover?: (id: string | null, kind: "node" | "edge" | null) => void;
  onSelect?: (id: string | null, kind: "node" | "edge" | null, additive: boolean) => void;
  onFocus?: (id: string) => void;
  onDiagnostics?: (d: { drawCalls: number; triangles: number; webgl: boolean }) => void;
  onDoubleSelect?: (id: string) => void;
  onNodeDrag?: (id: string, x: number, z: number) => void;
  onNodeDragEnd?: (id: string, x: number, z: number) => void;
}

interface EdgeFlowItem {
  mesh: THREE.Mesh;
  start: THREE.Vector3;
  end: THREE.Vector3;
  dir: THREE.Vector3;
  length: number;
  strength: number;
  offset: number;
}

export class AtlasScene {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private container: HTMLElement;
  private nodeMeshes = new Map<string, THREE.Mesh>();
  private nodeBaseY = new Map<string, number>();
  private nodeLabels = new Map<string, THREE.Sprite>();
  private edgeMeshes = new Map<string, THREE.Mesh>();
  private edgeFlows = new Map<string, EdgeFlowItem>();
  private zoneMeshes = new Map<string, THREE.Mesh>();
  private graph: VisGraph | null = null;
  private layout: LayoutResult | null = null;
  private layer: LayerResult | null = null;
  private selected = new Set<string>();
  private hovered: string | null = null;
  private flowTime = 0;
  private raf = 0;
  private lastFrameMs = 0;
  private frameCount = 0;
  private reducedMotion = false;
  private dragNodeId: string | null = null;
  private isDragging = false;
  private dragMoved = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.5);
  private planePoint = new THREE.Vector3();
  webglAvailable = false;
  lastFrameStats = { fps: 0, frameMs: 0 };

  constructor(container: HTMLElement, private callbacks: SceneCallbacks, reducedMotion = false) {
    this.container = container;
    this.reducedMotion = reducedMotion;
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
      // Executive Deep Obsidian Background
      this.renderer.setClearColor(0x09090b, 1);
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
      this.webglAvailable = true;
    } catch {
      this.webglAvailable = false;
      this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
      this.controls = null as unknown as OrbitControls;
      return;
    }

    this.renderer.setSize(container.clientWidth || 800, container.clientHeight || 600);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "3D architecture canvas — interactive spatial intelligence environment"
    );

    // Atmospheric exponential depth fog
    this.scene.fog = new THREE.FogExp2(0x09090b, 0.0035);

    this.camera = new THREE.PerspectiveCamera(
      48,
      (container.clientWidth || 800) / (container.clientHeight || 600),
      0.1,
      1000
    );

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxDistance = 450;
    this.controls.minDistance = 8;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.05;

    // 3-Point Studio Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xfef3c7, 0.65);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
    keyLight.position.set(65, 110, 45);
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xf59e0b, 0.55);
    rimLight.position.set(-55, 35, -65);
    this.scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0x6366f1, 0.35);
    fillLight.position.set(0, -25, 0);
    this.scene.add(fillLight);

    // Architectural Ground Grid
    const mainGrid = new THREE.GridHelper(320, 64, 0x3f3f46, 0x18181b);
    mainGrid.position.y = -0.1;
    this.scene.add(mainGrid);

    // Origin Beacon Ring
    const ringGeo = new THREE.RingGeometry(3.5, 3.8, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0;
    this.scene.add(ring);

    this.attachPointerEvents();
    this.loop();
  }

  private attachPointerEvents(): void {
    const el = this.renderer!.domElement;
    el.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    el.addEventListener("pointermove", (e) => this.onPointerMove(e));
    el.addEventListener("pointerup", (e) => this.onPointerUp(e));
    el.addEventListener("click", (e) => this.onClick(e));
    el.addEventListener("dblclick", (e) => this.onDoubleClick(e));
  }

  private pick(clientX: number, clientY: number): { id: string; kind: "node" | "edge" } | null {
    const rect = this.renderer!.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const nodeHits = this.raycaster.intersectObjects([...this.nodeMeshes.values()], false);
    if (nodeHits.length > 0) {
      const id = nodeHits[0].object.userData.id as string;
      return { id, kind: "node" };
    }
    const edgeHits = this.raycaster.intersectObjects([...this.edgeMeshes.values()], false);
    if (edgeHits.length > 0) {
      return { id: edgeHits[0].object.userData.id as string, kind: "edge" };
    }
    return null;
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.webglAvailable || e.button !== 0) return;
    const hit = this.pick(e.clientX, e.clientY);
    if (hit?.kind === "node") {
      this.dragNodeId = hit.id;
      this.isDragging = false;
      this.dragMoved = false;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
    }
  }

  private onPointerUp(_e: PointerEvent): void {
    if (!this.webglAvailable) return;
    if (this.dragNodeId) {
      if (this.isDragging && this.layout) {
        const pos = this.layout.positions[this.dragNodeId];
        if (pos) {
          this.callbacks.onNodeDragEnd?.(this.dragNodeId, pos.x, pos.z);
        }
      }
      this.controls.enabled = true;
      this.isDragging = false;
      this.dragNodeId = null;
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.webglAvailable) return;
    if (this.dragNodeId) {
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      if (!this.isDragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
        this.isDragging = true;
        this.dragMoved = true;
        this.controls.enabled = false;
      }
      if (this.isDragging) {
        const rect = this.renderer!.domElement.getBoundingClientRect();
        this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.pointer, this.camera);
        if (this.raycaster.ray.intersectPlane(this.groundPlane, this.planePoint)) {
          const x = Math.round(this.planePoint.x * 10) / 10;
          const z = Math.round(this.planePoint.z * 10) / 10;
          this.repositionNodeMesh(this.dragNodeId, x, z);
          this.callbacks.onNodeDrag?.(this.dragNodeId, x, z);
        }
        return;
      }
    }
    const hit = this.pick(e.clientX, e.clientY);
    const id = hit?.id ?? null;
    if (id !== this.hovered) {
      this.hovered = id;
      this.callbacks.onHover?.(id, hit?.kind ?? null);
      this.renderer!.domElement.style.cursor = hit ? "pointer" : "grab";
      this.applyEmphasis();
    }
  }

  private onClick(e: MouseEvent): void {
    if (!this.webglAvailable) return;
    if (this.dragMoved) {
      this.dragMoved = false;
      return;
    }
    const hit = this.pick(e.clientX, e.clientY);
    this.callbacks.onSelect?.(hit?.id ?? null, hit?.kind ?? null, e.shiftKey);
  }

  private onDoubleClick(e: MouseEvent): void {
    if (!this.webglAvailable) return;
    const hit = this.pick(e.clientX, e.clientY);
    if (hit?.kind === "node") this.callbacks.onFocus?.(hit.id);
    else this.callbacks.onDoubleSelect?.(hit?.id ?? "");
  }

  repositionNodeMesh(nodeId: string, x: number, z: number): void {
    if (!this.layout || !this.graph) return;
    this.layout.positions[nodeId] = { x, y: 0, z };
    this.nodeBaseY.set(nodeId, 1.5);
    const mesh = this.nodeMeshes.get(nodeId);
    if (mesh) mesh.position.set(x, 1.5, z);
    const label = this.nodeLabels.get(nodeId);
    if (label) label.position.set(x, 4.8, z);
    this.updateConnectedEdges(nodeId);
  }

  private updateConnectedEdges(nodeId: string): void {
    if (!this.graph || !this.layout) return;
    for (const e of this.graph.edges) {
      if (e.from !== nodeId && e.to !== nodeId) continue;
      const a = this.layout.positions[e.from];
      const b = this.layout.positions[e.to];
      if (!a || !b) continue;
      const start = new THREE.Vector3(a.x, 1.5, a.z);
      const end = new THREE.Vector3(b.x, 1.5, b.z);
      const dir = end.clone().sub(start);
      const length = dir.length();
      const mid = start.clone().add(end).multiplyScalar(0.5).setY(1.5 + length * 0.12);

      const mesh = this.edgeMeshes.get(e.id);
      if (mesh) {
        mesh.position.copy(mid);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        mesh.scale.set(1, Math.max(length - 3.4, 0.5), 1);
      }
      const cone = this.edgeMeshes.get(`${e.id}:cone`);
      if (cone) {
        const before = end.clone().sub(dir.clone().normalize().multiplyScalar(3.2));
        cone.position.copy(before.setY(1.5 + length * 0.12));
        cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      }

      // Update flow item endpoints
      const flow = this.edgeFlows.get(e.id);
      if (flow) {
        flow.start.copy(start);
        flow.end.copy(end);
        flow.dir.copy(dir);
        flow.length = length;
      }
    }
  }

  /** Rebuild the scene from graph + layout (deterministic). */
  build(graph: VisGraph, layout: LayoutResult): void {
    if (!this.webglAvailable) {
      this.graph = graph;
      this.layout = layout;
      return;
    }
    this.graph = graph;
    this.layout = layout;

    // Clear previous elements
    for (const m of [
      ...this.nodeMeshes.values(),
      ...this.edgeMeshes.values(),
      ...this.zoneMeshes.values(),
      ...this.nodeLabels.values(),
    ]) {
      this.scene.remove(m);
      (m as THREE.Mesh).geometry?.dispose();
    }
    for (const f of this.edgeFlows.values()) {
      this.scene.remove(f.mesh);
      f.mesh.geometry.dispose();
    }

    this.nodeMeshes.clear();
    this.nodeBaseY.clear();
    this.edgeMeshes.clear();
    this.zoneMeshes.clear();
    this.nodeLabels.clear();
    this.edgeFlows.clear();

    // Architectural Trust Zones
    for (const [zoneId, b] of Object.entries(layout.zoneBounds)) {
      const w = Math.max(b.maxX - b.minX, 8);
      const d = Math.max(b.maxZ - b.minZ, 8);
      const zone = graph.zones.find((z) => z.id === zoneId);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.4, d),
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.08,
          roughness: 0.7,
          metalness: 0.1,
          depthWrite: false,
        })
      );
      mesh.position.set((b.minX + b.maxX) / 2, -1.2, (b.minZ + b.maxZ) / 2);
      mesh.userData = { id: zoneId, kind: "zone" };
      const label = labelSprite(`ZONE ${zone?.label ?? zoneId}`, `trust: ${zone?.trust ?? "?"}`);
      label.position.set((b.minX + b.maxX) / 2, 0.2, (b.minZ + b.maxZ) / 2);
      label.scale.multiplyScalar(1.2);
      this.scene.add(mesh);
      this.scene.add(label);
      this.zoneMeshes.set(zoneId, mesh);
    }

    // Nodes with PBR Materials & Elevation
    for (const n of graph.nodes) {
      const p = layout.positions[n.id];
      if (!p) continue;
      const mesh = new THREE.Mesh(
        componentGeometry(n.type),
        new THREE.MeshStandardMaterial({
          color: TYPE_COLOR[n.type],
          roughness: 0.28,
          metalness: 0.38,
        })
      );
      mesh.position.set(p.x, p.y + 1.5, p.z);
      mesh.userData = { id: n.id, kind: "node" };
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.nodeMeshes.set(n.id, mesh);
      this.nodeBaseY.set(n.id, p.y + 1.5);

      const label = labelSprite(n.label);
      label.position.set(p.x, p.y + 4.8, p.z);
      this.scene.add(label);
      this.nodeLabels.set(n.id, label);
    }

    // Edges with Directional Cones & Metallic Finish
    for (const e of graph.edges) {
      const a = layout.positions[e.from];
      const b = layout.positions[e.to];
      if (!a || !b) continue;
      const start = new THREE.Vector3(a.x, 1.5, a.z);
      const end = new THREE.Vector3(b.x, 1.5, b.z);
      const dir = end.clone().sub(start);
      const length = dir.length();
      const mid = start.clone().add(end).multiplyScalar(0.5).setY(1.5 + length * 0.12);

      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(
          e.kind === "event" ? 0.12 : 0.18,
          e.kind === "event" ? 0.12 : 0.18,
          1,
          12
        ),
        new THREE.MeshStandardMaterial({
          color: EDGE_COLOR.normal,
          roughness: 0.45,
          metalness: 0.35,
        })
      );
      mesh.position.copy(mid);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      mesh.scale.set(1, Math.max(length - 3.4, 0.5), 1);
      mesh.userData = { id: e.id, kind: "edge" };
      this.scene.add(mesh);
      this.edgeMeshes.set(e.id, mesh);

      // Direction indicator cone
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.48, 1.3, 12),
        new THREE.MeshStandardMaterial({
          color: EDGE_COLOR.normal,
          roughness: 0.4,
          metalness: 0.3,
        })
      );
      const before = end.clone().sub(dir.clone().normalize().multiplyScalar(3.2));
      cone.position.copy(before.setY(1.5 + length * 0.12));
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      cone.userData = { id: e.id, kind: "edge" };
      this.scene.add(cone);
      this.edgeMeshes.set(`${e.id}:cone`, cone);
    }

    this.rebuildFlows();
    this.fitToView();
    this.applyEmphasis();
  }

  /** Apply layer emphasis + selection/hover states (materials + badges). */
  applyLayer(layer: LayerResult, selected: Set<string>): void {
    this.layer = layer;
    this.selected = new Set(selected);
    this.applyEmphasis();
    this.rebuildFlows();
  }

  private applyEmphasis(): void {
    if (!this.webglAvailable || !this.layer || !this.graph) return;
    const L = this.layer;

    for (const n of this.graph.nodes) {
      const mesh = this.nodeMeshes.get(n.id);
      const label = this.nodeLabels.get(n.id);
      if (!mesh) continue;

      const st = L.nodes[n.id] ?? { emphasis: "normal" as const };
      const tint = EMPHASIS_TINT[st.emphasis] ?? EMPHASIS_TINT.normal;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const isSelected = this.selected.has(n.id);
      const isHovered = this.hovered === n.id;

      mat.emissive.setHex(isSelected ? 0x0284c7 : isHovered ? 0x475569 : tint.emissive);
      mat.emissiveIntensity = isSelected ? 0.95 : isHovered ? 0.6 : 1;
      mat.opacity = tint.opacity;
      mat.transparent = tint.opacity < 1;

      // Badge updates
      const wanted = st.badge;
      const current = mesh.userData.badge as string | undefined;
      if (wanted !== current && label) {
        this.scene.remove(label);
        const fresh = labelSprite(n.label, wanted);
        const p = this.layout!.positions[n.id];
        fresh.position.set(p.x, p.y + 4.8, p.z);
        this.scene.add(fresh);
        this.nodeLabels.set(n.id, fresh);
        mesh.userData.badge = wanted;
      }
    }

    for (const e of this.graph.edges) {
      const mesh = this.edgeMeshes.get(e.id);
      if (!mesh) continue;
      const st = L.edges[e.id] ?? { emphasis: "normal" as const };
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.setHex(EDGE_COLOR[this.selected.has(e.id) ? "highlighted" : st.emphasis] ?? EDGE_COLOR.normal);
      mat.opacity = st.emphasis === "dimmed" ? 0.25 : 1;
      mat.transparent = st.emphasis === "dimmed";
      mat.emissive.setHex(st.emphasis === "critical" ? 0x991b1b : 0x000000);
    }
  }

  /** Traffic flow pulses: glowing spheres moving along connection vectors. */
  private rebuildFlows(): void {
    if (!this.webglAvailable || !this.graph || !this.layout) return;

    for (const f of this.edgeFlows.values()) {
      this.scene.remove(f.mesh);
      f.mesh.geometry.dispose();
    }
    this.edgeFlows.clear();
    if (this.reducedMotion) return;

    let index = 0;
    for (const e of this.graph.edges) {
      const a = this.layout.positions[e.from];
      const b = this.layout.positions[e.to];
      if (!a || !b) continue;

      const st = this.layer?.edges[e.id];
      // Default to continuous baseline traffic (0.8) so the 3D scene is always dynamic
      const flowStrength = st?.flow && st.flow > 0 ? st.flow : 0.85;

      const start = new THREE.Vector3(a.x, 1.5, a.z);
      const end = new THREE.Vector3(b.x, 1.5, b.z);
      const dir = end.clone().sub(start);
      const length = dir.length();

      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 12, 10),
        new THREE.MeshStandardMaterial({
          color: 0xfef08a,
          emissive: 0xf59e0b,
          emissiveIntensity: 1.2,
          roughness: 0.2,
          metalness: 0.1,
        })
      );

      particle.position.copy(start);
      this.scene.add(particle);

      this.edgeFlows.set(e.id, {
        mesh: particle,
        start,
        end,
        dir,
        length,
        strength: flowStrength,
        offset: (index * 0.17) % 1,
      });
      index++;
    }
  }

  private loop = (): void => {
    this.raf = window.requestAnimationFrame(this.loop);
    if (!this.webglAvailable || !this.renderer) return;

    const t0 = performance.now();
    const time = t0 * 0.001;

    this.controls.update();

    // 1. Dynamic Organic Node Breathing & Floating
    if (!this.reducedMotion && this.graph && !this.isDragging) {
      let idx = 0;
      for (const [id, mesh] of this.nodeMeshes.entries()) {
        const baseY = this.nodeBaseY.get(id) ?? 1.5;
        // Subtle, elegant vertical oscillation
        const floatY = Math.sin(time * 1.6 + idx * 0.65) * 0.16;
        mesh.position.y = baseY + floatY;

        const label = this.nodeLabels.get(id);
        if (label) {
          label.position.y = mesh.position.y + 3.3;
        }
        idx++;
      }
    }

    // 2. Real-time Edge Traffic Packet Pulses
    if (!this.reducedMotion) {
      this.flowTime = (this.flowTime + 0.008) % 1;
      for (const f of this.edgeFlows.values()) {
        const progress = (this.flowTime * f.strength + f.offset) % 1;
        const pos = f.start.clone().lerp(f.end, progress);
        // Subtle vertical arc along the connection
        pos.y += Math.sin(progress * Math.PI) * (f.length * 0.075);
        f.mesh.position.copy(pos);
        // Pulse size
        const scale = 0.85 + Math.sin(progress * Math.PI) * 0.35;
        f.mesh.scale.set(scale, scale, scale);
      }
    }

    this.renderer.render(this.scene, this.camera);
    const dt = performance.now() - t0;
    this.frameCount += 1;

    if (this.frameCount % 30 === 0) {
      this.lastFrameStats = {
        fps: Math.round(1000 / Math.max(this.lastFrameMs, 1)),
        frameMs: Math.round(this.lastFrameMs),
      };
      this.callbacks.onDiagnostics?.({
        drawCalls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
        webgl: true,
      });
    }
    this.lastFrameMs = Math.max(dt, (this.lastFrameMs * 7 + dt) / 8);
  };

  fitToView(): void {
    if (!this.webglAvailable || !this.layout) return;
    const b = layoutBounds(this.layout);
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ, 30);
    this.camera.position.set(cx + span * 0.35, span * 0.68, cz + span * 1.05);
    this.controls.target.set(cx, 0, cz);
    this.controls.update();
  }

  preset(kind: "iso" | "top" | "side" | "front"): void {
    if (!this.webglAvailable || !this.layout) return;
    const b = layoutBounds(this.layout);
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ, 30);
    this.controls.target.set(cx, 0, cz);
    switch (kind) {
      case "iso":
        this.camera.position.set(cx + span * 0.6, span * 0.72, cz + span * 0.95);
        break;
      case "top":
        this.camera.position.set(cx, span * 1.4, cz + 0.01);
        break;
      case "side":
        this.camera.position.set(cx + span * 1.45, span * 0.28, cz);
        break;
      case "front":
        this.camera.position.set(cx, span * 0.28, cz + span * 1.45);
        break;
    }
    this.controls.update();
  }

  focusNode(id: string): void {
    if (!this.webglAvailable || !this.layout) return;
    const p = this.layout.positions[id];
    if (!p) return;
    this.controls.target.set(p.x, 1.5, p.z);
    this.camera.position.set(p.x + 24, 18, p.z + 28);
    this.controls.update();
  }

  resize(): void {
    if (!this.webglAvailable || !this.renderer) return;
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 600;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    window.cancelAnimationFrame(this.raf);
    this.controls?.dispose();
    this.renderer?.dispose();
    if (this.renderer?.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
