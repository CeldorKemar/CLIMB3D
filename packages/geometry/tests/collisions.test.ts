import { describe, expect, it } from 'vitest';
import { createDemoScene, type ModelDefinition, type Placement, type SceneDocument } from '@climbed/contracts';
import { Matrix4, Vector3 } from 'three';
import { detectSolidContacts } from '../src/collisions';
import {
  createModelGeometry, createWallChain, findSceneCollisions, isMountingFootprintOnWall,
  quaternionFromWallAngles, validateScene, validateSceneChange, wallProjectedDimensions,
} from '../src/index';

const model: ModelDefinition = {
  id: 'box', name: 'Test box', kind: 'volume', version: 1, shape: 'box',
  dimensions: [1, 1, .5], color: '#ffffff', source: { type: 'parametric', generatorVersion: 1 },
};
function scene(): SceneDocument {
  const result = createDemoScene();
  result.walls = [{ ...result.walls[0]!, id: 'wall', width: 8, height: 6, position: [0, 0, 0], rotation: [0, 0, 0, 1], openings: [] }];
  result.models = [structuredClone(model), { ...structuredClone(model), id: 'hold', kind: 'hold', dimensions: [.2, .2, .1] }];
  result.placements = []; result.boulders = [];
  return result;
}
const placement = (id: string, x: number, y = 2): Placement => ({
  id, modelId: 'box', modelVersion: 1, parentType: 'wall', parentId: 'wall',
  position: [x, y, 0], rotation: [0, 0, 0, 1],
});

describe('solid contacts', () => {
  it('rejects overlap, exact contact and numerical near-contact, but accepts a real gap', () => {
    for (const gap of [-.2, 0, .00005, .0002]) {
      const s = scene(); s.placements = [placement('a', 0), placement('b', 1 + gap)];
      expect(findSceneCollisions(s).length, `gap ${gap}`).toBe(gap < .0001 ? 1 : 0);
    }
  });

  it('detects complete containment without intersecting surfaces', () => {
    const outer = createModelGeometry(model);
    const inner = createModelGeometry({ ...model, dimensions: [.1, .1, .1] });
    expect(detectSolidContacts([
      { id: 'outer', geometry: outer, matrix: new Matrix4(), exemptIds: new Set() },
      { id: 'inner', geometry: inner, matrix: new Matrix4().makeTranslation(0, 0, .2), exemptIds: new Set() },
    ])).toHaveLength(1);
  });

  it('does not treat the empty cavity or overlapping AABBs as solid material', () => {
    const bowl = createModelGeometry({ ...model, shape: 'scoop', dimensions: [2, 2, 1] });
    const insideCavity = createModelGeometry({ ...model, dimensions: [.1, .1, .1] });
    expect(detectSolidContacts([
      { id: 'bowl', geometry: bowl, matrix: new Matrix4(), exemptIds: new Set() },
      { id: 'in-air', geometry: insideCavity, matrix: new Matrix4().makeTranslation(0, 0, .6), exemptIds: new Set() },
    ])).toEqual([]);
    const sphereA = createModelGeometry({ ...model, shape: 'dome', dimensions: [1, 1, .5] });
    expect(detectSolidContacts([
      { id: 'a', geometry: sphereA, matrix: new Matrix4(), exemptIds: new Set() },
      { id: 'b', geometry: sphereA, matrix: new Matrix4().makeTranslation(.8, .8, 0), exemptIds: new Set() },
    ])).toEqual([]);
  });

  it('checks pieces mounted on different walls in world coordinates', () => {
    const s = scene(); s.walls.push({ ...s.walls[0]!, id: 'other', position: [.8, 0, 0] });
    s.placements = [placement('a', 0), { ...placement('b', 0), parentId: 'other' }];
    expect(findSceneCollisions(s)).toContainEqual({ firstId: 'a', secondId: 'b' });
  });

  it('exempts intended support contact but detects a non-supporting wall', () => {
    const s = scene();
    s.placements = [placement('volume', 0), { ...placement('child', 0), modelId: 'hold', parentType: 'volume', parentId: 'volume', position: [0, 0, .5] }];
    expect(validateScene(s)).toEqual([]);
    s.walls.push({ ...s.walls[0]!, id: 'obstacle', position: [0, 0, .4] });
    expect(findSceneCollisions(s)).toContainEqual({ firstId: 'obstacle', secondId: 'volume' });
  });

  it('preserves legacy collisions unchanged, permits repair, and rejects new or moved collisions', () => {
    const previous = scene(); previous.placements = [placement('a', 0), placement('b', .8)];
    expect(validateScene(previous).join(' ')).toContain('Collision');
    expect(validateScene(previous, { collisions: false })).toEqual([]);
    const renamed = structuredClone(previous); renamed.name = 'Rename without mutation';
    expect(validateSceneChange(previous, renamed)).toEqual([]);
    const repaired = structuredClone(previous); repaired.placements[1]!.position[0] = 2;
    expect(validateSceneChange(previous, repaired)).toEqual([]);
    const moved = structuredClone(previous); moved.placements[1]!.position[0] = .9;
    expect(validateSceneChange(previous, moved).join(' ')).toContain('Collision');
    const added = structuredClone(repaired); added.placements.push(placement('c', 2.1));
    expect(validateSceneChange(repaired, added).join(' ')).toContain('Collision');
  });
});

describe('mounting footprint and composed pans', () => {
  it('checks the mounting footprint even when the anchor remains inside the pan', () => {
    const s = scene(), wall = s.walls[0]!;
    expect(isMountingFootprintOnWall(wall, model, placement('a', 3.8))).toBe(false);
    wall.openings = [{ id: 'opening', x: .35, y: 2, width: .2, height: .2 }];
    expect(isMountingFootprintOnWall(wall, model, placement('a', 0))).toBe(false);
    // A circular base does not occupy the corner of its bounding rectangle.
    const dome = { ...model, shape: 'dome' as const };
    wall.openings = [{ id: 'opening', x: .46, y: 2.46, width: .05, height: .05 }];
    expect(isMountingFootprintOnWall(wall, dome, placement('a', 0))).toBe(true);
  });

  it('connects a 1m/0°, 1m/30°, 1m/0° chain without gaps', () => {
    const walls = createWallChain({
      origin: [2, 0, 1], width: 3, thickness: .18, yaw: 0, color: '#ffffff', fixingSpacing: .25,
      segments: [{ length: 1, inclination: 0 }, { length: 1, inclination: 30 }, { length: 1, inclination: 0 }],
    });
    expect(walls[1]!.position).toEqual([2, 1, 1]);
    expect(walls[2]!.position[1]).toBeCloseTo(1 + Math.cos(Math.PI / 6));
    expect(walls[2]!.position[2]).toBeCloseTo(1.5);
    const roof = { ...walls[0]!, height: 1, rotation: quaternionFromWallAngles(90) };
    expect(wallProjectedDimensions(roof).horizontalDepth).toBeCloseTo(1);
    expect(wallProjectedDimensions(roof).verticalHeight).toBeCloseTo(0);
    const relative = createWallChain({
      origin: [0, 0, 0], width: 3, thickness: .18, color: '#ffffff', fixingSpacing: .25, angleMode: 'relative',
      segments: [{ length: 1, inclination: 0 }, { length: 1, inclination: 30 }, { length: 1, inclination: 0 }],
    });
    expect(relative[2]!.rotation).toEqual(relative[1]!.rotation);
  });

  it('accepts a shared volume in several blocks while start and finish remain holds', () => {
    const s = scene(); s.placements = [placement('volume', 0)];
    const boulder = { id: 'boulder-a', name: 'A', grade: '', color: '#ffffff', placementIds: ['volume'], startIds: [], finishIds: [] };
    s.boulders = [boulder, { ...boulder, id: 'boulder-b' }];
    expect(validateScene(s)).toEqual([]);
    s.boulders[0]!.startIds.push('volume');
    expect(validateScene(s).join(' ')).toContain('doit être une prise');
  });
});
