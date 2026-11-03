/**
 * Datanova Atlas — WebGL scene engine (Campaign 06, Tasks 09-14).
 *
 * A real three.js scene driven EXCLUSIVELY by the canonical VisGraph, the
 * deterministic layout, and layer results — the renderer never invents
 * architecture state. Modular: graph → scene rebuild, layer → material/state
 * updates, raycast → selection, OrbitControls → navigation, canvas-sprite
 * labels → readable names. Falls back honestly: if WebGL is unavailable the
 * mount reports it and React renders the accessible 2D mode.
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
    case "database": return new THREE.CylinderGeometry(1.6, 1.6, 2.4, 24);          // dimensional storage cylinder
    case "objectstore": return new THREE.BoxGeometry(2.6, 1.6, 2.0);                 // bulk storage block
    case "cache": return new THREE.CylinderGeometry(1.2, 1.2, 0.9, 12);              // flat disc
    case "queue": return new THREE.BoxGeometry(2.8, 1.2, 1.4);                        // segmented buffer
    case "gateway": return new THREE.ConeGeometry(1.5, 2.6, 4);                      // ingress structure
    case "worker": return new THREE.OctahedronGeometry(1.7);                        // processing unit
    case "external": return new THREE.TorusGeometry(1.4, 0.45, 10, 20);              // outside-boundary object
    case "client": return new THREE.SphereGeometry(1.15, 16, 12);                   // entry point
    case "analytics": return new THREE.IcosahedronGeometry(1.5);                    // analysis polyhedron
    case "broker": return new THREE.CylinderGeometry(0.9, 0.9, 2.8, 6);              // message spine
    case "service": return new THREE.BoxGeometry(2.3, 2.0, 2.3);                     // structured service block
  }
}

const TYPE_COLOR: Record<VisNode["type"], number> = {
  client: 0x38bdf8, gateway: 0x22d3ee, service: 0x6366f1, worker: 0xa78bfa,
  queue: 0xf59e0b, cache: 0x10b981, database: 0x0ea5e9, objectstore: 0x14b8a6,
  broker: 0xf472b6, analytics: 0xc084fc, external: 0xfb7185,
};

const EMPHASIS_TINT: Record<string, { emissive: number; opacity: number }> = {
  normal: { emissive: 0x000000, opacity: 1 },
  highlighted: { emissive: 0x1e293b, opacity: 1 },
  warning: { emissive: 0x78350f, opacity: 1 },
  critical: { emissive: 0x7f1d1d, opacity: 1 },
  dimmed: { emissive: 0x000000, opacity: 0.22 },
};

const EDGE_COLOR: Record<string, number> = {
  normal: 0x475569, highlighted: 0x38bdf8, warning: 0xf59e0b, critical: 0xf43f5e, dimmed: 0x1e293b,
};

/** Deterministic canvas-texture label sprite (name + optional badge). */
function labelSprite(text: string, badge?: string): THREE.Sprite {
  const canvas = window.document.createElement("canvas");
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(2, 6, 23, 0.78)";
    ctx.beginPath(); ctx.roundRect(2, 2, 252, 60, 10); ctx.fill();
    ctx.strokeStyle = "rgba(148, 163, 184, 0.5)"; ctx.stroke();
    ctx.font = "600 22px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text.length > 24 ? `${text.slice(0, 23)}…` : text, 128, badge ? 24 : 32);
    if (badge) {
      ctx.font = "700 17px ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(badge, 128, 46);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(6.4, 1.6, 1);
  return sprite;
}

export interface SceneCallbacks {
  onHover?: (id: string | null, kind: "node" | "edge" | null) => void;
  onSelect?: (id: string | null, kind: "node" | "edge" | null, additive: boolean) => void;
  onFocus?: (id: string) => void;
  onDiagnostics?: (d: { drawCalls: number; triangles: number; webgl: boolean }) => void;
  onDoubleSelect?: (id: string) => void;
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
  private nodeLabels = new Map<string, THREE.Sprite>();
  private edgeMeshes = new Map<string, THREE.Mesh>();
  private edgeFlows = new Map<string, { mesh: THREE.Mesh; dir: THREE.Vector3; length: number; strength: number }>();
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
  webglAvailable = false;
  lastFrameStats = { fps: 0, frameMs: 0 };

  constructor(container: HTMLElement, private callbacks: SceneCallbacks, reducedMotion = false) {
    this.container = container;
    this.reducedMotion = reducedMotion;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
      this.renderer.setClearColor(0x0b1120, 1);
      this.webglAvailable = true;
    } catch {
      this.webglAvailable = false;
      this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
      this.controls = null as unknown as OrbitControls;
      return;
    }
    this.renderer!.setSize(container.clientWidth || 800, container.clientHeight || 600);
    this.renderer!.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer!.domElement);
    this.renderer!.domElement.style.display = "block";
    this.renderer!.domElement.tabIndex = 0;
    this.renderer!.domElement.setAttribute("aria-label", "3D architecture canvas — use the object navigator or the 2D map for keyboard access");
    this.scene.fog = new THREE.Fog(0x0b1120, 120, 340);
    this.camera = new THREE.PerspectiveCamera(50, (container.clientWidth || 800) / (container.clientHeight || 600), 0.1, 1000);
    this.controls = new OrbitControls(this.camera, this.renderer!.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxDistance = 400;

    // lighting: calm studio setup — key, fill, rim
    this.scene.add(new THREE.AmbientLight(0x94a3b8, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.15); key.position.set(60, 90, 40); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x38bdf8, 0.35); rim.position.set(-50, 30, -60); this.scene.add(rim);

    // drafting grid: fine technical detail
    const grid = new THREE.GridHelper(400, 100, 0x1e293b, 0x111c34);
    grid.position.y = -6;
    this.scene.add(grid);

    this.attachPointerEvents();
    this.loop();
  }

  private attachPointerEvents(): void {
    const el = this.renderer!.domElement;
    el.addEventListener("pointermove", (e) => this.onPointerMove(e));
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

  private onPointerMove(e: PointerEvent): void {
    if (!this.webglAvailable) return;
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
    const hit = this.pick(e.clientX, e.clientY);
    this.callbacks.onSelect?.(hit?.id ?? null, hit?.kind ?? null, e.shiftKey);
  }

  private onDoubleClick(e: MouseEvent): void {
    if (!this.webglAvailable) return;
    const hit = this.pick(e.clientX, e.clientY);
    if (hit?.kind === "node") this.callbacks.onFocus?.(hit.id);
    else this.callbacks.onDoubleSelect?.(hit?.id ?? "");
  }

  /** Rebuild the scene from graph + layout (deterministic). */
  build(graph: VisGraph, layout: LayoutResult): void {
    if (!this.webglAvailable) { this.graph = graph; this.layout = layout; return; }
    this.graph = graph; this.layout = layout;
    // clear previous content
    for (const m of [...this.nodeMeshes.values(), ...this.edgeMeshes.values(), ...this.zoneMeshes.values(), ...this.nodeLabels.values()]) {
      this.scene.remove(m);
      (m as THREE.Mesh).geometry?.dispose();
    }
    for (const f of this.edgeFlows.values()) { this.scene.remove(f.mesh); f.mesh.geometry.dispose(); }
    this.nodeMeshes.clear(); this.edgeMeshes.clear(); this.zoneMeshes.clear(); this.nodeLabels.clear(); this.edgeFlows.clear();

    // zones: translucent labeled regions
    for (const [zoneId, b] of Object.entries(layout.zoneBounds)) {
      const w = Math.max(b.maxX - b.minX, 6);
      const d = Math.max(b.maxZ - b.minZ, 6);
      const zone = graph.zones.find((z) => z.id === zoneId);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, 0.5, d),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.07, depthWrite: false }),
      );
      mesh.position.set((b.minX + b.maxX) / 2, -2, (b.minZ + b.maxZ) / 2);
      mesh.userData = { id: zoneId, kind: "zone" };
      const label = labelSprite(`ZONE ${zone?.label ?? zoneId}`, `trust: ${zone?.trust ?? "?"}`);
      label.position.set((b.minX + b.maxX) / 2, -0.8, (b.minZ + b.maxZ) / 2);
      label.scale.multiplyScalar(1.2);
      this.scene.add(mesh); this.scene.add(label);
      this.zoneMeshes.set(zoneId, mesh);
    }

    // nodes
    for (const n of graph.nodes) {
      const p = layout.positions[n.id];
      if (!p) continue;
      const mesh = new THREE.Mesh(
        componentGeometry(n.type),
        new THREE.MeshStandardMaterial({ color: TYPE_COLOR[n.type], roughness: 0.45, metalness: 0.2 }),
      );
      mesh.position.set(p.x, p.y + 1.5, p.z);
      mesh.userData = { id: n.id, kind: "node" };
      mesh.castShadow = false;
      this.scene.add(mesh);
      this.nodeMeshes.set(n.id, mesh);
      const label = labelSprite(n.label);
      label.position.set(p.x, p.y + 4.6, p.z);
      this.scene.add(label);
      this.nodeLabels.set(n.id, label);
    }

    // edges: cylinders with direction cones
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
        new THREE.CylinderGeometry(e.kind === "event" ? 0.09 : 0.14, e.kind === "event" ? 0.09 : 0.14, Math.max(length - 3.4, 0.5), 8),
        new THREE.MeshStandardMaterial({ color: EDGE_COLOR.normal, roughness: 0.6 }),
      );
      mesh.position.copy(mid);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      mesh.userData = { id: e.id, kind: "edge" };
      this.scene.add(mesh);
      this.edgeMeshes.set(e.id, mesh);
      // direction cone
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.42, 1.2, 10),
        new THREE.MeshStandardMaterial({ color: EDGE_COLOR.normal }),
      );
      const before = end.clone().sub(dir.clone().normalize().multiplyScalar(3.2));
      cone.position.copy(before.setY(1.5 + length * 0.12));
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      cone.userData = { id: e.id, kind: "edge" };
      this.scene.add(cone);
      this.edgeMeshes.set(`${e.id}:cone`, cone);
    }
    this.fitToView();
    this.applyEmphasis();
  }

  /** Apply layer emphasis + selection/hover states (materials + badges). */
  applyLayer(layer: LayerResult, selected: Set<string>): void {
    this.layer = layer;
    this.selected = new Set(selected);
    this.applyEmphasis();
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
      const selected = this.selected.has(n.id);
      const hovered = this.hovered === n.id;
      mat.emissive.setHex(selected ? 0x0e7490 : hovered ? 0x334155 : tint.emissive);
      mat.emissiveIntensity = selected ? 0.9 : hovered ? 0.6 : 1;
      mat.opacity = tint.opacity;
      mat.transparent = tint.opacity < 1;
      if (selected) mat.emissive.setHex(0x0891b2);
      // badge updates require a label rebuild only when the badge changed
      const wanted = st.badge;
      const current = mesh.userData.badge as string | undefined;
      if (wanted !== current && label) {
        this.scene.remove(label);
        const fresh = labelSprite(n.label, wanted);
        const p = this.layout!.positions[n.id];
        fresh.position.set(p.x, p.y + 4.6, p.z);
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
      mat.emissive.setHex(st.emphasis === "critical" ? 0x7f1d1d : 0x000000);
    }
  }

  /** Traffic flow pulses: one small sphere per flowing edge, driven by layer data. */
  private rebuildFlows(): void {
    if (!this.webglAvailable || !this.layer || !this.graph || !this.layout) return;
    for (const f of this.edgeFlows.values()) { this.scene.remove(f.mesh); f.mesh.geometry.dispose(); }
    this.edgeFlows.clear();
    if (this.reducedMotion) return;
    for (const e of this.graph.edges) {
      const st = this.layer.edges[e.id];
      const flow = st?.flow ?? 0;
      if (flow <= 0) continue;
      const a = this.layout.positions[e.from];
      const b = this.layout.positions[e.to];
      if (!a || !b) continue;
      const start = new THREE.Vector3(a.x, 1.5, a.z);
      const end = new THREE.Vector3(b.x, 1.5, b.z);
      const dir = end.clone().sub(start);
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x67e8f9 }),
      );
      mesh.position.copy(start);
      this.scene.add(mesh);
      this.edgeFlows.set(e.id, { mesh, dir, length: dir.length(), strength: flow });
    }
  }

  private loop = (): void => {
    this.raf = window.requestAnimationFrame(this.loop);
    if (!this.webglAvailable || !this.renderer) return;
    const t0 = performance.now();
    this.controls.update();
    if (this.layer && this.frameCount % 10 === 0) this.rebuildFlows();
    this.flowTime = (this.flowTime + 0.016) % 1;
    for (const f of this.edgeFlows.values()) {
      const k = (this.flowTime * f.strength) % 1;
      f.mesh.position.copy(f.dir.clone().multiplyScalar(k).add(f.dir.clone().multiplyScalar(-f.length / 2)).add(f.mesh.position.clone().set(0, 0, 0)));
    }
    this.renderer.render(this.scene, this.camera);
    const dt = performance.now() - t0;
    this.frameCount += 1;
    if (this.frameCount % 30 === 0) {
      this.lastFrameStats = { fps: Math.round(1000 / Math.max(this.lastFrameMs, 1)), frameMs: Math.round(this.lastFrameMs) };
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
    this.camera.position.set(cx + span * 0.3, span * 0.62, cz + span * 0.95);
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
      case "iso": this.camera.position.set(cx + span * 0.55, span * 0.7, cz + span * 0.9); break;
      case "top": this.camera.position.set(cx, span * 1.35, cz + 0.01); break;
      case "side": this.camera.position.set(cx + span * 1.4, span * 0.25, cz); break;
      case "front": this.camera.position.set(cx, span * 0.25, cz + span * 1.4); break;
    }
    this.controls.update();
  }

  focusNode(id: string): void {
    if (!this.webglAvailable || !this.layout) return;
    const p = this.layout.positions[id];
    if (!p) return;
    this.controls.target.set(p.x, 1.5, p.z);
    this.camera.position.set(p.x + 26, 20, p.z + 30);
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
