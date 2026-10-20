import { visiblePlacementIds } from "../domain/visibility";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { RoomFloors } from "./RoomFloors";
import {
  Box3,
  BufferGeometry,
  Float32BufferAttribute,
  Quaternion,
  Vector3,
} from "three";
import type {
  ModelDefinition,
  Placement,
  Quat,
  SceneDocument,
  Vec3,
  WallDefinition,
} from "@climbed/contracts";
import {
  createModelGeometry,
  createWallGeometry,
  isPointOnWall,
  getSupportFixings,
  getMountingMethod,
  snapPlacementToFixing,
  validatePlacementMounting,
  validateSceneChange,
  getPlacementModel,
  prepareSupportForPlacement,
  snapPlacementAnchorToFixing,
} from "@climbed/geometry";
export interface SurfacePoint {
  parentType: "wall" | "volume";
  parentId: string;
  position: Vec3;
  rotation: Quat;
  preparePilotDiameter?: number;
}
export type ViewMode = "perspective" | "front" | "top";
export interface PlacementPreviewStatus {
  valid: boolean;
  reasons: string[];
}
interface Props {
  scene: SceneDocument;
  selected: string | null;
  selectedIds?: string[];
  selectedLevelId?: string | null;
  onSelectLevel?: (id: string) => void;
  activeModel: ModelDefinition | undefined;
  grid: boolean;
  view: { mode: ViewMode; seq: number; wallId?: string };
  onSelect: (id: string | null, additive?: boolean) => void;
  onPlace: (point: SurfacePoint) => void;
  hiddenRouteIds: string[];
  remainingStock?: ReadonlyMap<string, number>;
  onPreviewStatus?: (status: PlacementPreviewStatus | null) => void;
  prepareSupport?: boolean;
  pilotDiameter?: number;
}
function Fixings({ support }: { support: WallDefinition | ModelDefinition }) {
  const geometry = useMemo(() => {
    const coords: number[] = [], colors: number[] = [];
    for (const hole of getSupportFixings(support).holes) {
      const p = new Vector3(...hole.position).addScaledVector(
        new Vector3(...hole.normal),
        0.001,
      );
      coords.push(p.x, p.y, p.z);
      colors.push(...(hole.kind === 'pilot' ? [.9, .35, .04] : [.22, .2, .16]));
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(coords, 3));
    g.setAttribute("color", new Float32BufferAttribute(colors, 3));
    return g;
  }, [support]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <points geometry={geometry} raycast={() => undefined}>
      <pointsMaterial vertexColors size={0.014} sizeAttenuation />
    </points>
  );
}
/** A picking proxy inside an open bore preserves its support identity without filling it visually. */
function InsertTargets({ model, parentId, onClick, onMove, onOut }: {
  model: ModelDefinition;
  parentId: string;
  onClick: (event: ThreeEvent<MouseEvent>, point: SurfacePoint) => void;
  onMove: (point: SurfacePoint) => void;
  onOut: () => void;
}) {
  const holes = useMemo(() => getSupportFixings(model).holes, [model]);
  return holes.map(hole => {
    const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(...hole.normal));
    const point: SurfacePoint = { parentType: "volume", parentId, position: hole.position, rotation: rotation.toArray() as Quat };
    return <mesh key={hole.id} position={hole.position} quaternion={rotation}
      onClick={event => onClick(event, point)}
      onPointerMove={event => { event.stopPropagation(); onMove(point); }}
      onPointerOut={onOut}>
      <circleGeometry args={[Math.max((hole.diameter ?? .012) / 2, .008), 16]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
    </mesh>;
  });
}
function Camera({ view, scene }: Pick<Props, "view" | "scene">) {
  const { camera, controls, invalidate, size } = useThree();
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  useEffect(() => {
    const bounds = new Box3();
    for (const wall of sceneRef.current.walls) {
      const q = new Quaternion(...wall.rotation);
      for (const x of [-wall.width / 2, wall.width / 2])
        for (const y of [0, wall.height]) {
          bounds.expandByPoint(
            new Vector3(x, y, 0)
              .applyQuaternion(q)
              .add(new Vector3(...wall.position)),
          );
        }
    }
    const focusWall = sceneRef.current.walls.find((w) => w.id === view.wallId);
    const centre = bounds.getCenter(new Vector3());
    const span = bounds.getSize(new Vector3());
    const aspect = size.width / Math.max(size.height, 1);
    const distance =
      (Math.max(span.x / aspect, span.y, span.z, 3) /
        (2 * Math.tan((21 * Math.PI) / 180))) *
      1.35;
    let target = view.mode === "front" ? new Vector3(1, 2, 0) : centre;
    camera.up.set(0, 1, 0);
    if (focusWall) {
      const q = new Quaternion(...focusWall.rotation);
      target = new Vector3(0, focusWall.height / 2, 0)
        .applyQuaternion(q)
        .add(new Vector3(...focusWall.position));
      const focusDistance =
        (Math.max(focusWall.width / aspect, focusWall.height, 1) /
          (2 * Math.tan((21 * Math.PI) / 180))) *
        1.3;
      camera.position
        .copy(target)
        .add(
          new Vector3(0, 0, 1).applyQuaternion(q).multiplyScalar(focusDistance),
        );
      camera.up.copy(new Vector3(0, 1, 0).applyQuaternion(q));
    } else if (view.mode === "front") camera.position.set(1, 2, 12);
    else if (view.mode === "top") {
      camera.position.set(
        centre.x,
        Math.max(centre.y + distance, 8),
        centre.z + 0.001,
      );
    } else
      camera.position
        .copy(centre)
        .add(new Vector3(0.55, 0.32, 1).normalize().multiplyScalar(distance));
    const orbit = controls as unknown as
      | { target: Vector3; update: () => void }
      | undefined;
    orbit?.target.copy(target);
    camera.lookAt(target);
    orbit?.update();
    invalidate();
  }, [view, camera, controls, invalidate, size.width, size.height]);
  return null;
}
function SurfaceMesh({
  geometry,
  color,
  selected,
  onClick,
  onMove,
  onOut,
  faded = false,
}: {
  geometry: BufferGeometry;
  color: string;
  selected: boolean;
  faded?: boolean;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  onMove?: (e: ThreeEvent<PointerEvent>) => void;
  onOut?: () => void;
}) {
  return (
    <mesh
      geometry={geometry}
      castShadow
      receiveShadow
      onClick={onClick}
      onPointerMove={onMove}
      onPointerOut={onOut}
    >
      <meshStandardMaterial
        color={color}
        roughness={0.86}
        metalness={0}
        emissive={selected ? "#b4d67b" : "#000000"}
        emissiveIntensity={selected ? 0.24 : 0}
        transparent={faded}
        opacity={faded ? 0.22 : 1}
      />
    </mesh>
  );
}
export function SceneCanvas(props: Props) {
  const {
    scene,
    selected,
    activeModel,
    grid,
    onSelect,
    onPlace,
    hiddenRouteIds,
  } = props;
  const [hover, setHover] = useState<SurfacePoint | null>(null);
  const previewId = useRef(`preview-${crypto.randomUUID()}`);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingHover = useRef<SurfacePoint | null>(null);
  const lastHoverUpdate = useRef(0);
  const previewCallback = useRef(props.onPreviewStatus);
  previewCallback.current = props.onPreviewStatus;
  const selectedIds = props.selectedIds ?? (selected ? [selected] : []);
  const geometries = useMemo(
    () => new Map(scene.models.map((m) => [m.id, createModelGeometry(m)])),
    [scene.models],
  );
  const wallGeometries = useMemo(
    () => new Map(scene.walls.map((w) => [w.id, createWallGeometry(w)])),
    [scene.walls],
  );
  const preparedGeometries = useMemo(() => new Map(scene.placements.filter(p=>p.preparedPilotHoles?.length).map(p=>
    [p.id, createModelGeometry(getPlacementModel(scene,p)!)])), [scene.models, scene.placements]);
  useEffect(()=>()=>preparedGeometries.forEach(g=>g.dispose()), [preparedGeometries]);
  useEffect(
    () => () => {
      geometries.forEach((g) => g.dispose());
    },
    [geometries],
  );
  useEffect(
    () => () => {
      wallGeometries.forEach((g) => g.dispose());
    },
    [wallGeometries],
  );
  function clearHover() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    pendingHover.current = null;
    setHover(null);
  }
  useEffect(() => {
    clearHover();
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, [activeModel?.id]);
  function evaluate(point: SurfacePoint) {
    if (!activeModel) return null;
    const raw: Placement = {
      id: previewId.current,
      modelId: activeModel.id,
      modelVersion: activeModel.version,
      parentType: point.parentType, parentId: point.parentId, position: point.position, rotation: point.rotation,
    };
    const snapped = props.prepareSupport ? snapPlacementAnchorToFixing(scene, raw) : snapPlacementToFixing(scene, raw);
    const candidate = snapped ?? raw;
    let prepared = scene, addedHoleCount = 0;
    const reasons: string[] = [];
    if (props.prepareSupport) {
      try { const result=prepareSupportForPlacement(scene,candidate,{pilotDiameter:props.pilotDiameter}); prepared=result.scene; addedHoleCount=result.addedHoleCount; }
      catch(error) { reasons.push((error as Error).message); }
    }
    reasons.push(...validatePlacementMounting(prepared, candidate));
    if (
      props.remainingStock &&
      (props.remainingStock.get(activeModel.id) ?? 0) <= 0
    )
      reasons.push("Aucune pièce disponible en stock.");
    const proposed = { ...prepared, placements: [...prepared.placements, candidate] };
    reasons.push(...validateSceneChange(scene, proposed));
    return {candidate, valid:reasons.length===0, reasons, addedHoleCount};
  }
  const preview = useMemo(() => {
    if (!activeModel || !hover) return null;
    const evaluation = evaluate(hover)!;
    const {candidate, reasons} = evaluation;
    const labels = new Map([
      [candidate.id, activeModel.name],
      ...scene.walls.map((w) => [w.id, w.name] as const),
      ...scene.placements.map(
        (p) =>
          [
            p.id,
            scene.models.find((m) => m.id === p.modelId)?.name ?? p.id,
          ] as const,
      ),
    ]);
    const readable = reasons.map((reason) => {
      for (const [id, name] of labels)
        reason = reason.replaceAll(id, `« ${name} »`);
      return reason;
    });
    return {
      ...evaluation,
      reasons: [...new Set(readable)],
    };
  }, [scene, activeModel, hover, props.remainingStock, props.prepareSupport, props.pilotDiameter]);
  useEffect(() => {
    previewCallback.current?.(
      preview ? { valid: preview.valid, reasons: preview.reasons } : null,
    );
  }, [preview]);
  const visibleIds = useMemo(
    () => visiblePlacementIds(scene, hiddenRouteIds),
    [scene, hiddenRouteIds],
  );
  function pointOnSurface(
    e: ThreeEvent<MouseEvent | PointerEvent>,
    type: "wall" | "volume",
    id: string,
  ): SurfacePoint | null {
    if (
      !activeModel ||
      (activeModel.kind === "volume" && type !== "wall") ||
      !e.face
    )
      return null;
    if (type === "wall" && e.face.normal.z < 0.9) return null;
    if (type === "volume" && e.face.normal.z < -0.01) return null;
    const p = e.object.worldToLocal(e.point.clone());
    if (
      type === "wall" &&
      !isPointOnWall(scene.walls.find((w) => w.id === id)!, [p.x, p.y, 0])
    )
      return null;
    const normal = e.face.normal.clone().normalize();
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), normal);
    return {
      parentType: type,
      parentId: id,
      position: p.toArray() as Vec3,
      rotation: q.toArray() as Quat,
    };
  }
  function clicked(
    e: ThreeEvent<MouseEvent>,
    type: "wall" | "volume" | "hold",
    id: string,
  ) {
    e.stopPropagation();
    if (e.delta > 5) return;
    if (activeModel && type !== "hold") {
      const point = pointOnSurface(e, type, id);
      if (point) placePoint(point);
    } else if (!activeModel) onSelect(id, e.ctrlKey || e.metaKey);
  }
  function placePoint(point: SurfacePoint) {
      const evaluation=evaluate(point);
      if (!evaluation) return;
      const {candidate, valid}=evaluation;
      setHover(point);
      if (valid)
        onPlace({
          parentType: candidate.parentType,
          parentId: candidate.parentId,
          position: candidate.position,
          rotation: candidate.rotation,
          ...(props.prepareSupport && evaluation.addedHoleCount ? {preparePilotDiameter:props.pilotDiameter} : {}),
        });
  }
  function moved(
    e: ThreeEvent<PointerEvent>,
    type: "wall" | "volume",
    id: string,
  ) {
    e.stopPropagation();
    if (activeModel) {
      queueHover(pointOnSurface(e, type, id));
    }
  }
  function queueHover(point: SurfacePoint | null) {
      pendingHover.current = point;
      if (hoverTimer.current) return;
      const commit = () => {
        hoverTimer.current = null;
        lastHoverUpdate.current = performance.now();
        setHover(pendingHover.current);
      };
      const delay = Math.max(
        0,
        80 - (performance.now() - lastHoverUpdate.current),
      );
      if (delay === 0) commit();
      else hoverTimer.current = setTimeout(commit, delay);
  }
  function ghost(type: "wall" | "volume", id: string) {
    if (
      !activeModel ||
      !preview ||
      preview.candidate.parentType !== type ||
      preview.candidate.parentId !== id
    )
      return null;
    const geometry = geometries.get(activeModel.id);
    return (
      <mesh
        geometry={geometry}
        position={preview.candidate.position}
        quaternion={preview.candidate.rotation}
        raycast={() => undefined}
      >
        <meshStandardMaterial
          color={preview.valid ? "#70ff4a" : "#ff3c36"}
          emissive={preview.valid ? "#4dff22" : "#ff211e"}
          emissiveIntensity={0.6}
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>
    );
  }
  function placementMesh(p: Placement) {
    if (!visibleIds.has(p.id)) return null;
    const model = getPlacementModel(scene,p);
    if (!model) return null;
    const geometry = preparedGeometries.get(p.id) ?? geometries.get(model.id);
    if (!geometry) return null;
    return (
      <group key={p.id} position={p.position} quaternion={p.rotation}>
        <SurfaceMesh
          geometry={geometry}
          color={model.color}
          selected={selectedIds.includes(p.id)}
          onClick={(e) => clicked(e, model.kind, p.id)}
          onMove={
            model.kind === "volume"
              ? (e) => moved(e, "volume", p.id)
              : undefined
          }
          onOut={clearHover}
        />
        {model.kind === "volume" && (
          <>
            {grid && <Fixings support={model} />}
            {activeModel?.kind === "hold" &&
              <InsertTargets model={model} parentId={p.id} onOut={clearHover}
                onMove={queueHover} onClick={(event, point) => {
                  event.stopPropagation();
                  if (event.delta <= 5) placePoint(point);
                }} />}
            {scene.placements
              .filter(
                (child) =>
                  child.parentType === "volume" && child.parentId === p.id,
              )
              .map(placementMesh)}
            {ghost("volume", p.id)}
          </>
        )}
        {selectedIds.includes(p.id) && (
          <mesh position={[0, 0, -0.003]} raycast={() => undefined}>
            <ringGeometry
              args={[
                Math.max(model.dimensions[0], model.dimensions[1]) * 0.56,
                Math.max(model.dimensions[0], model.dimensions[1]) * 0.56 +
                  0.018,
                48,
              ]}
            />
            <meshBasicMaterial
              color="#dcf2b1"
              depthTest={false}
              transparent
              opacity={0.85}
            />
          </mesh>
        )}
      </group>
    );
  }
  return (
    <div
      className={`scene-canvas ${activeModel ? "placing" : ""}`}
      data-testid="editor-canvas"
    >
      {preview && (
        <output
          data-testid="placement-preview-status"
          data-valid={String(preview.valid)}
          data-parent-id={preview.candidate.parentId}
          data-position={JSON.stringify(preview.candidate.position)}
          aria-live="polite"
          style={{
            position: "absolute",
            zIndex: 2,
            left: 12,
            bottom: 12,
            maxWidth: "65%",
            padding: "6px 10px",
            borderRadius: 8,
            background: preview.valid ? "#e8ffdf" : "#ffe5e2",
            color: preview.valid ? "#255b16" : "#85231b",
            pointerEvents: "none",
            fontSize: 12,
          }}
        >
          {preview.valid
            ? preview.addedHoleCount ? `Placement possible — ${preview.addedHoleCount} trous pilotes à préparer sur le support` : "Placement possible — fixations alignées"
            : preview.reasons.join(" · ")}
        </output>
      )}
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [9, 6, 12], fov: 42, near: 0.05, far: 1000 }}
        onPointerMissed={() => {
          if (!activeModel) onSelect(null);
        }}
        gl={{ antialias: true, preserveDrawingBuffer: false }}
      >
        <color attach="background" args={["#ebece7"]} />
        <fog attach="fog" args={["#ebece7", 22, 50]} />
        <ambientLight intensity={0.7} />
        <hemisphereLight args={["#ffffff", "#b6bbb2", 0.7]} />
        <directionalLight
          castShadow
          position={[3, 10, 8]}
          intensity={2.2}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
          shadow-normalBias={0.03}
        />
        <group>
          {scene.walls.map((wall) => (
            <group
              key={wall.id}
              position={wall.position}
              quaternion={wall.rotation}
            >
              <SurfaceMesh
                geometry={wallGeometries.get(wall.id)!}
                color={wall.color}
                selected={selected === wall.id}
                onClick={(e) => clicked(e, "wall", wall.id)}
                onMove={(e) => moved(e, "wall", wall.id)}
                onOut={clearHover}
              />
              {grid && <Fixings support={wall} />}{" "}
              {scene.placements
                .filter(
                  (p) => p.parentType === "wall" && p.parentId === wall.id,
                )
                .map(placementMesh)}
              {ghost("wall", wall.id)}
            </group>
          ))}
        </group>
        <RoomFloors scene={scene} selectedLevelId={props.selectedLevelId} onSelectLevel={!activeModel ? props.onSelectLevel : undefined} />
        {grid && (
          <gridHelper
            args={[12, 24, "#98a297", "#c0c5bb"]}
            position={[1, 0.02, 2]}
          />
        )}
        <OrbitControls
          makeDefault
          target={[1, 2, 0]}
          minDistance={0.3}
          maxDistance={300}
          maxPolarAngle={Math.PI - 0.01}
          enableDamping
          dampingFactor={0.08}
        />
        <Camera view={props.view} scene={scene} />
      </Canvas>
    </div>
  );
}
