import type { SceneDocument, WallDefinition } from "@climbed/contracts";
import { Quaternion, Vector3 } from "three";

export type RoomLevel = NonNullable<SceneDocument["levels"]>[number];
export type RoomStair = NonNullable<SceneDocument["stairs"]>[number];
export type PlanPoint = [number, number];

/** Orthographic footprint of the physical panel, including thickness, tilt and yaw. */
export function projectWallFootprint(wall: WallDefinition): PlanPoint[] {
  const q = new Quaternion(...wall.rotation);
  const points: PlanPoint[] = [];
  for (const x of [-wall.width / 2, wall.width / 2])
    for (const y of [0, wall.height])
      for (const z of [0, -wall.thickness]) {
        const p = new Vector3(x, y, z).applyQuaternion(q).add(new Vector3(...wall.position));
        points.push([p.x, p.z]);
      }
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const half = (ordered: PlanPoint[]) => {
    const result: PlanPoint[] = [];
    for (const point of ordered) {
      while (result.length > 1 && cross(result[result.length - 2]!, result[result.length - 1]!, point) <= 1e-10) result.pop();
      result.push(point);
    }
    return result.slice(0, -1);
  };
  return [...half(points), ...half([...points].reverse())];
}

/** Legacy scenes acquire a finite floor without altering any existing world position. */
export function getRoomLevels(scene: SceneDocument): RoomLevel[] {
  if (scene.levels?.length) return scene.levels;
  const points = scene.walls.flatMap(projectWallFootprint);
  const xs = points.map((p) => p[0]),
    zs = points.map((p) => p[1]);
  const minX = Math.min(-4, ...xs) - 1,
    maxX = Math.max(4, ...xs) + 1;
  const minZ = Math.min(-4, ...zs) - 1,
    maxZ = Math.max(4, ...zs) + 1;
  return [
    {
      id: "level-0",
      name: "Niveau 0",
      elevation: 0,
      outline: [
        [minX, minZ],
        [maxX, minZ],
        [maxX, maxZ],
        [minX, maxZ],
      ],
    },
  ];
}

export function getWallLevelId(
  scene: SceneDocument,
  wall: WallDefinition,
): string {
  return wall.levelId ?? getRoomLevels(scene)[0]!.id;
}

export function materializeRoomLevels(scene: SceneDocument): SceneDocument {
  const levels = getRoomLevels(scene);
  return {
    ...scene,
    levels,
    stairs: scene.stairs ?? [],
    walls: scene.walls.map((w) => ({
      ...w,
      levelId: w.levelId ?? levels[0]!.id,
    })),
  };
}

/** Translate the panels, preserving each panel's height above its associated floor. */
export function changeLevelElevation(
  scene: SceneDocument,
  levelId: string,
  elevation: number,
): SceneDocument {
  const current = materializeRoomLevels(scene),
    level = current.levels!.find((l) => l.id === levelId);
  if (!level || !Number.isFinite(elevation)) return scene;
  const delta = elevation - level.elevation;
  return {
    ...current,
    levels: current.levels!.map((l) =>
      l.id === levelId ? { ...l, elevation } : l,
    ),
    walls: current.walls.map((w) =>
      w.levelId === levelId
        ? {
            ...w,
            position: [w.position[0], w.position[1] + delta, w.position[2]],
          }
        : w,
    ),
  };
}

export function assignWallLevel(
  scene: SceneDocument,
  wallId: string,
  levelId: string,
): SceneDocument {
  const current = materializeRoomLevels(scene),
    target = current.levels!.find((l) => l.id === levelId);
  if (!target) return scene;
  return {
    ...current,
    walls: current.walls.map((w) => {
      if (w.id !== wallId) return w;
      const old = current.levels!.find((l) => l.id === w.levelId)!;
      return {
        ...w,
        levelId,
        position: [
          w.position[0],
          w.position[1] + target.elevation - old.elevation,
          w.position[2],
        ],
      };
    }),
  };
}

export interface StairStep {
  position: [number, number, number];
  size: [number, number, number];
  yaw: number;
}
/** A conceptual straight stair. Dimensions are user data, not construction certification. */
export function getStairSteps(
  scene: SceneDocument,
  stair: RoomStair,
): StairStep[] {
  const levels = getRoomLevels(scene),
    from = levels.find((l) => l.id === stair.fromLevelId),
    to = levels.find((l) => l.id === stair.toLevelId);
  if (!from || !to || from.elevation === to.elevation) return [];
  const ascending = from.elevation < to.elevation;
  const start = ascending ? stair.start : stair.end,
    end = ascending ? stair.end : stair.start;
  const low = Math.min(from.elevation, to.elevation),
    high = Math.max(from.elevation, to.elevation);
  const dx = end[0] - start[0],
    dz = end[1] - start[1],
    run = Math.hypot(dx, dz);
  if (run < 0.01) return [];
  const count = stair.steps ?? 12,
    depth = run / count,
    yaw = Math.atan2(dx, dz);
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 0.5) / count,
      height = ((high - low) * (i + 1)) / count;
    return {
      position: [start[0] + dx * t, low + height / 2, start[1] + dz * t],
      size: [stair.width, height, depth],
      yaw,
    };
  });
}

function cross(a: PlanPoint, b: PlanPoint, c: PlanPoint) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}
function intersects(a: PlanPoint, b: PlanPoint, c: PlanPoint, d: PlanPoint) {
  const values = [
    cross(a, b, c),
    cross(a, b, d),
    cross(c, d, a),
    cross(c, d, b),
  ];
  if (values[0]! * values[1]! < 0 && values[2]! * values[3]! < 0) return true;
  const on = (p: PlanPoint, q: PlanPoint, r: PlanPoint) =>
    Math.abs(cross(p, q, r)) < 1e-9 &&
    r[0] >= Math.min(p[0], q[0]) &&
    r[0] <= Math.max(p[0], q[0]) &&
    r[1] >= Math.min(p[1], q[1]) &&
    r[1] <= Math.max(p[1], q[1]);
  return on(a, b, c) || on(a, b, d) || on(c, d, a) || on(c, d, b);
}

export function validateRoomLayout(scene: SceneDocument): string[] {
  const errors: string[] = [],
    levels = getRoomLevels(scene),
    ids = new Set<string>();
  for (const level of levels) {
    if (ids.has(level.id)) errors.push(`Niveau dupliqué : ${level.name}`);
    ids.add(level.id);
    const p = level.outline;
    const area =
      Math.abs(
        p.reduce((sum, a, i) => {
          const b = p[(i + 1) % p.length]!;
          return sum + a[0] * b[1] - b[0] * a[1];
        }, 0),
      ) / 2;
    if (area < 0.01)
      errors.push(
        `Le sol de « ${level.name} » doit avoir une surface supérieure à 0,01 m².`,
      );
    for (let i = 0; i < p.length; i++)
      for (let j = i + 1; j < p.length; j++) {
        if (j === i + 1 || (i === 0 && j === p.length - 1)) continue;
        if (
          intersects(
            p[i]!,
            p[(i + 1) % p.length]!,
            p[j]!,
            p[(j + 1) % p.length]!,
          )
        )
          errors.push(`Le contour du sol « ${level.name} » se croise.`);
      }
  }
  for (const wall of scene.walls)
    if (wall.levelId && !ids.has(wall.levelId))
      errors.push(`Le niveau du pan « ${wall.name} » n’existe pas.`);
  const stairIds = new Set<string>();
  for (const stair of scene.stairs ?? []) {
    if (stairIds.has(stair.id))
      errors.push(`Escalier dupliqué : ${stair.name}`);
    stairIds.add(stair.id);
    const from = levels.find((l) => l.id === stair.fromLevelId),
      to = levels.find((l) => l.id === stair.toLevelId);
    if (!from || !to)
      errors.push(
        `Les niveaux de l’escalier « ${stair.name} » doivent exister.`,
      );
    else if (
      from.id === to.id ||
      Math.abs(from.elevation - to.elevation) < 0.01
    )
      errors.push(
        `L’escalier « ${stair.name} » doit relier deux niveaux de hauteurs différentes.`,
      );
    if (
      Math.hypot(stair.end[0] - stair.start[0], stair.end[1] - stair.start[1]) <
      0.1
    )
      errors.push(
        `L’escalier « ${stair.name} » doit avoir une longueur au sol d’au moins 0,10 m.`,
      );
  }
  return [...new Set(errors)];
}
