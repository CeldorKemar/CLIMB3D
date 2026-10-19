import { describe, expect, it } from "vitest";
import {
  createDemoScene,
  type SceneDocument,
  type WallDefinition,
} from "@climbed/contracts";
import { quaternionFromWallAngles } from "../src/index";
import {
  assignWallLevel,
  changeLevelElevation,
  getRoomLevels,
  getStairSteps,
  getWallLevelId,
  materializeRoomLevels,
  projectWallFootprint,
  validateRoomLayout,
} from "../src/layout";

function baseScene(): SceneDocument {
  const scene = createDemoScene();
  return { ...scene, placements: [], boulders: [] };
}
function panel(
  id: string,
  width: number,
  x: number,
  z: number,
  yaw = 0,
): WallDefinition {
  return {
    ...baseScene().walls[0]!,
    id,
    name: id,
    width,
    height: 2.5,
    position: [x, 0, z],
    rotation: quaternionFromWallAngles(0, yaw),
    openings: [],
  };
}

describe("room plan coordinates and level persistence", () => {
  it("projects five vertical pans into a U without flattening their distinct world positions", () => {
    const walls = [
      panel("left-a", 2, 0, 1, 90),
      panel("left-b", 2, 0, 3, 90),
      panel("back", 4, 2, 4),
      panel("right-a", 2, 4, 3, 90),
      panel("right-b", 2, 4, 1, 90),
    ];
    const t = walls[0]!.thickness;
    const expected = [
      [[-t, 0], [0, 0], [0, 2], [-t, 2]],
      [[-t, 2], [0, 2], [0, 4], [-t, 4]],
      [[0, 4 - t], [4, 4 - t], [4, 4], [0, 4]],
      [[4 - t, 2], [4, 2], [4, 4], [4 - t, 4]],
      [[4 - t, 0], [4, 0], [4, 2], [4 - t, 2]],
    ];
    walls.forEach((wall, i) => {
      const projected = projectWallFootprint(wall);
      expect(projected).toHaveLength(4);
      for (const [x, z] of expected[i]!) {
        expect(projected.some(p => Math.abs(p[0] - x!) < 1e-8 && Math.abs(p[1] - z!) < 1e-8)).toBe(true);
      }
    });
  });

  it("projects both roof depth and wall yaw with the same true-to-scale coordinates", () => {
    const wall = {
      ...panel("roof", 4, 10, -5, 90),
      height: 3,
      position: [10, 7, -5] as [number, number, number],
      rotation: quaternionFromWallAngles(90, 90),
    };
    const projected = projectWallFootprint(wall);
    const expected = [
      [10, -3],
      [10, -7],
      [13, -7],
      [13, -3],
    ];
    expect(projected).toHaveLength(4);
    for (const [x, z] of expected) {
      expect(projected.some(p => Math.abs(p[0] - x!) < 1e-8 && Math.abs(p[1] - z!) < 1e-8)).toBe(true);
    }
  });

  it("provides a finite legacy floor and materializes it without moving any existing wall", () => {
    const scene = baseScene(),
      levels = getRoomLevels(scene),
      materialized = materializeRoomLevels(scene);
    expect(levels).toHaveLength(1);
    expect(levels[0]!.elevation).toBe(0);
    expect(levels[0]!.outline).toHaveLength(4);
    expect(materialized.walls.map((w) => w.position)).toEqual(
      scene.walls.map((w) => w.position),
    );
    expect(materialized.walls.every((w) => w.levelId === levels[0]!.id)).toBe(
      true,
    );
    expect(scene.levels).toBeUndefined();
  });

  it("moves only the associated panels when changing floor altitude and leaves child local anchors intact", () => {
    const scene = materializeRoomLevels(createDemoScene());
    scene.levels!.push({
      ...scene.levels![0]!,
      id: "up",
      name: "Étage",
      elevation: 3,
    });
    scene.walls[1]!.levelId = "up";
    const before = structuredClone(scene),
      changed = changeLevelElevation(scene, "up", 5);
    expect(changed.walls[0]!.position).toEqual(before.walls[0]!.position);
    expect(changed.walls[1]!.position[1]).toBe(
      before.walls[1]!.position[1] + 2,
    );
    expect(changed.placements).toEqual(before.placements);
    expect(scene).toEqual(before);
  });

  it("assigns a panel to another level while preserving its height above the floor", () => {
    const scene = materializeRoomLevels(baseScene());
    scene.levels!.push({
      ...scene.levels![0]!,
      id: "up",
      name: "Niveau 1",
      elevation: 3.2,
    });
    const moved = assignWallLevel(scene, scene.walls[0]!.id, "up");
    expect(moved.walls[0]!.position[1]).toBeCloseTo(
      scene.walls[0]!.position[1] + 3.2,
    );
    expect(getWallLevelId(moved, moved.walls[0]!)).toBe("up");
    expect(assignWallLevel(scene, scene.walls[0]!.id, "missing")).toBe(scene);
  });

  it("derives stair geometry from both floor elevations, including stairs declared downward", () => {
    const scene = materializeRoomLevels(baseScene());
    scene.levels!.push({
      ...scene.levels![0]!,
      id: "up",
      name: "Étage",
      elevation: 3,
    });
    const stair = {
      id: "stairs",
      name: "Escalier",
      fromLevelId: "up",
      toLevelId: scene.levels![0]!.id,
      start: [0, 4] as [number, number],
      end: [0, 0] as [number, number],
      width: 1.2,
      steps: 6,
    };
    const steps = getStairSteps(scene, stair);
    expect(steps).toHaveLength(6);
    expect(steps[0]!.size).toEqual([1.2, 0.5, 4 / 6]);
    expect(steps[0]!.position[1] + steps[0]!.size[1] / 2).toBeCloseTo(0.5);
    expect(steps[5]!.position[1] + steps[5]!.size[1] / 2).toBeCloseTo(3);
    expect(steps[0]!.position[2]).toBeLessThan(steps[5]!.position[2]);
    expect(steps[0]!.yaw).toBe(0);
  });

  it("reports dangling level references and impossible stair connections separately", () => {
    const scene = materializeRoomLevels(baseScene());
    scene.walls[0]!.levelId = "unknown";
    scene.stairs = [
      {
        id: "s",
        name: "Trop court",
        fromLevelId: scene.levels![0]!.id,
        toLevelId: scene.levels![0]!.id,
        start: [0, 0],
        end: [0, 0],
        width: 1,
      },
    ];
    const errors = validateRoomLayout(scene);
    expect(
      errors.some((e) => e.includes("pan") && e.includes("n’existe pas")),
    ).toBe(true);
    expect(errors.some((e) => e.includes("hauteurs différentes"))).toBe(true);
    expect(errors.some((e) => e.includes("0,10 m"))).toBe(true);
  });

  it("rejects crossed, degenerate and duplicate floor outlines", () => {
    const scene = materializeRoomLevels(baseScene());
    scene.levels![0]!.outline = [
      [0, 0],
      [3, 3],
      [3, 0],
      [0, 3],
    ];
    scene.levels!.push({
      ...scene.levels![0]!,
      outline: [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
    });
    const errors = validateRoomLayout(scene);
    expect(errors.some((e) => e.includes("se croise"))).toBe(true);
    expect(errors.some((e) => e.includes("surface"))).toBe(true);
    expect(errors.some((e) => e.includes("dupliqué"))).toBe(true);
  });
});
