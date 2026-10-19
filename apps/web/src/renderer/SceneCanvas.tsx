import { visiblePlacementIds } from "../domain/visibility";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
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
} from "@climbed/geometry";
export interface SurfacePoint {
  parentType: "wall" | "volume";
  parentId: string;
  position: Vec3;
  rotation: Quat;
}
export type ViewMode = "perspective" | "front" | "top";
interface Props {
  scene: SceneDocument;
  selected: string | null;
  activeModel: ModelDefinition | undefined;
  grid: boolean;
  view: { mode: ViewMode; seq: number };
  onSelect: (id: string | null) => void;
  onPlace: (point: SurfacePoint) => void;
  hiddenRouteIds: string[];
}
function Fixings({ wall }: { wall: WallDefinition }) {
  const geometry = useMemo(() => {
    const coords: number[] = [];
    for (
      let x = -wall.width / 2 + wall.fixingSpacing / 2;
      x < wall.width / 2;
      x += wall.fixingSpacing
    )
      for (
        let y = wall.fixingSpacing / 2;
        y < wall.height;
        y += wall.fixingSpacing
      )
        if (isPointOnWall(wall, [x, y, 0])) coords.push(x, y, 0.003);
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(coords, 3));
    return g;
  }, [wall]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <points geometry={geometry} raycast={() => undefined}>
      <pointsMaterial color="#665e51" size={0.014} sizeAttenuation />
    </points>
  );
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
    const centre = bounds.getCenter(new Vector3());
    const span = bounds.getSize(new Vector3());
    const aspect = size.width / Math.max(size.height, 1);
    const distance =
      (Math.max(span.x / aspect, span.y, span.z, 3) /
        (2 * Math.tan((21 * Math.PI) / 180))) *
      1.35;
    const target = view.mode === "front" ? new Vector3(1, 2, 0) : centre;
    if (view.mode === "front") camera.position.set(1, 2, 12);
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
  const geometries = useMemo(
    () => new Map(scene.models.map((m) => [m.id, createModelGeometry(m)])),
    [scene.models],
  );
  const wallGeometries = useMemo(
    () => new Map(scene.walls.map((w) => [w.id, createWallGeometry(w)])),
    [scene.walls],
  );
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
  useEffect(() => setHover(null), [activeModel?.id]);
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
      const p = pointOnSurface(e, type, id);
      if (p) onPlace(p);
    } else if (!activeModel) onSelect(id);
  }
  function moved(
    e: ThreeEvent<PointerEvent>,
    type: "wall" | "volume",
    id: string,
  ) {
    e.stopPropagation();
    if (activeModel) setHover(pointOnSurface(e, type, id));
  }
  function ghost(type: "wall" | "volume", id: string) {
    if (!activeModel || hover?.parentType !== type || hover.parentId !== id)
      return null;
    const geometry = geometries.get(activeModel.id);
    return (
      <mesh
        geometry={geometry}
        position={hover.position}
        quaternion={hover.rotation}
        raycast={() => undefined}
      >
        <meshStandardMaterial
          color="#bbd984"
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </mesh>
    );
  }
  function placementMesh(p: Placement) {
    if (!visibleIds.has(p.id)) return null;
    const model = scene.models.find((m) => m.id === p.modelId);
    if (!model) return null;
    const geometry = geometries.get(model.id);
    if (!geometry) return null;
    return (
      <group key={p.id} position={p.position} quaternion={p.rotation}>
        <SurfaceMesh
          geometry={geometry}
          color={model.color}
          selected={selected === p.id}
          onClick={(e) => clicked(e, model.kind, p.id)}
          onMove={
            model.kind === "volume"
              ? (e) => moved(e, "volume", p.id)
              : undefined
          }
          onOut={() => setHover(null)}
        />
        {model.kind === "volume" && (
          <>
            {scene.placements
              .filter(
                (child) =>
                  child.parentType === "volume" && child.parentId === p.id,
              )
              .map(placementMesh)}
            {ghost("volume", p.id)}
          </>
        )}
        {selected === p.id && (
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
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [9, 6, 12], fov: 42, near: 0.05, far: 100 }}
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
                onOut={() => setHover(null)}
              />
              {grid && <Fixings wall={wall} />}{" "}
              {scene.placements
                .filter(
                  (p) => p.parentType === "wall" && p.parentId === wall.id,
                )
                .map(placementMesh)}
              {ghost("wall", wall.id)}
            </group>
          ))}
        </group>
        <mesh position={[1, -0.14, 1.8]} receiveShadow>
          <boxGeometry args={[12, 0.25, 6]} />
          <meshStandardMaterial color="#a5aaa0" roughness={1} />
        </mesh>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.24, 0]}
          receiveShadow
        >
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color="#e5e6df" roughness={1} />
        </mesh>
        {grid && (
          <gridHelper
            args={[12, 24, "#98a297", "#c0c5bb"]}
            position={[1, 0.02, 2]}
          />
        )}
        <OrbitControls
          makeDefault
          target={[1, 2, 0]}
          minDistance={2}
          maxDistance={30}
          maxPolarAngle={Math.PI / 2 - 0.01}
          enableDamping
          dampingFactor={0.08}
        />
        <Camera view={props.view} scene={scene} />
      </Canvas>
    </div>
  );
}
