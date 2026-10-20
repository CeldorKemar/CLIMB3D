import { useEffect, useMemo } from "react";
import type { SceneDocument } from "@climbed/contracts";
import { getRoomLevels, getStairSteps } from "@climbed/geometry";
import { ExtrudeGeometry, Shape } from "three";

/** Finite structural floors follow the same XZ outlines as the room plan. */
export function RoomFloors({ scene, selectedLevelId, onSelectLevel }: { scene: SceneDocument; selectedLevelId?: string | null; onSelectLevel?: (id: string) => void }) {
  const floors = useMemo(
    () =>
      getRoomLevels(scene).map((level) => {
        const shape = new Shape();
        level.outline.forEach(([x, z], i) =>
          i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z),
        );
        shape.closePath();
        const geometry = new ExtrudeGeometry(shape, {
          depth: 0.08,
          bevelEnabled: false,
          steps: 1,
        });
        geometry.rotateX(-Math.PI / 2);
        return { level, geometry };
      }),
    [scene.levels, scene.walls],
  );
  useEffect(() => () => floors.forEach((f) => f.geometry.dispose()), [floors]);
  return (
    <group>
      {floors.map(({ level, geometry }, index) => (
        <mesh
          key={level.id}
          geometry={geometry}
          position={[0, level.elevation - 0.08, 0]}
          receiveShadow
          {...(!onSelectLevel ? { raycast: () => undefined } : {})}
          onClick={event => { if (onSelectLevel && event.delta <= 5) { event.stopPropagation(); onSelectLevel(level.id); } }}
        >
          <meshStandardMaterial
            color={index % 2 ? "#aab7ad" : "#a5aaa0"}
            roughness={1}
            emissive={selectedLevelId === level.id ? "#527954" : "#000000"}
            emissiveIntensity={.2}
          />
        </mesh>
      ))}
      {(scene.stairs ?? []).map((stair) => (
        <group key={stair.id}>
          {getStairSteps(scene, stair).map((step, i) => (
            <mesh
              key={i}
              position={step.position}
              rotation={[0, step.yaw, 0]}
              receiveShadow
              castShadow
              raycast={() => undefined}
            >
              <boxGeometry args={step.size} />
              <meshStandardMaterial color="#b4beb3" roughness={0.95} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
