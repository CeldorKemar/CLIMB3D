import { describe, expect, it } from 'vitest';
import { createDemoScene, demoModels, type ModelDefinition, type SceneDocument, type WallDefinition } from '@climbed/contracts';
import { DoubleSide, Mesh, MeshBasicMaterial, Quaternion, Raycaster, Vector3 } from 'three';
import {
  createModelGeometry, createWallGeometry, getWallAngles, getWorldPose,
  isPointOnModelSurface, isPointOnWall, quaternionFromWallAngles, validateScene,
} from '../src/index';

const wall = (): WallDefinition => ({
  id: 'wall', name: 'Pan', width: 4, height: 3, thickness: .2,
  position: [0, 0, 0], rotation: [0, 0, 0, 1], color: '#ffffff', fixingSpacing: .25,
  openings: [{ id: 'window', x: .3, y: 1.5, width: .8, height: 1 }],
});
const raycast = (geometry: ReturnType<typeof createModelGeometry>, x: number, y: number) => {
  const mesh = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }));
  mesh.updateMatrixWorld();
  return new Raycaster(new Vector3(x, y, 10), new Vector3(0, 0, -1)).intersectObject(mesh);
};
function signedVolume(geometry: ReturnType<typeof createModelGeometry>): number {
  const pos = geometry.getAttribute('position');
  const index = geometry.getIndex();
  let result = 0;
  for (let i = 0; i < (index?.count ?? pos.count); i += 3) {
    const a = new Vector3().fromBufferAttribute(pos, index ? index.getX(i) : i);
    const b = new Vector3().fromBufferAttribute(pos, index ? index.getX(i + 1) : i + 1);
    const c = new Vector3().fromBufferAttribute(pos, index ? index.getX(i + 2) : i + 2);
    result += a.dot(b.cross(c)) / 6;
  }
  return result;
}

describe('solid walls and actual openings', () => {
  it('ray passes through an opening while a neighbouring ray hits the front', () => {
    const pan = wall();
    const geometry = createWallGeometry(pan);
    expect(raycast(geometry, .3, 1.5)).toHaveLength(0);
    const hits = raycast(geometry, -1, 1.5);
    expect(hits[0]?.point.z).toBeCloseTo(0);
    expect(hits[0]?.face?.normal.z).toBeGreaterThan(.99);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.min.z).toBeCloseTo(-.2);
    expect(geometry.boundingBox!.max.y).toBeCloseTo(3);
    expect(signedVolume(geometry)).toBeCloseTo((4 * 3 - .8) * .2);
    expect(isPointOnWall(pan, [.3, 1.5, 0])).toBe(false);
    expect(isPointOnWall(pan, [-1, 1.5, 0])).toBe(true);
    expect(isPointOnWall(pan, [-1, 1.5, .2])).toBe(false);
  });

  it('rejects openings on edges, outside the wall, overlapping or touching', () => {
    for (const opening of [
      { id: 'bad', x: 0, y: .5, width: 1, height: 1 },
      { id: 'bad', x: 2, y: 1.5, width: 1, height: 1 },
      { id: 'bad', x: .5, y: 1.5, width: 1, height: 1 },
      { id: 'bad', x: 1.2, y: 1.5, width: 1, height: 1 },
    ]) {
      const pan = wall();
      pan.openings.push(opening);
      expect(() => createWallGeometry(pan)).toThrow();
      const scene = createDemoScene(); scene.walls = [pan]; scene.placements = []; scene.boulders = [];
      expect(validateScene(scene).length).toBeGreaterThan(0);
    }
  });
});

describe('parametric models', () => {
  it.each(demoModels)('$shape has requested dimensions and positive solid volume', (model) => {
    const geometry = createModelGeometry(model);
    geometry.computeBoundingBox();
    const size = geometry.boundingBox!.getSize(new Vector3());
    expect(size.x).toBeCloseTo(model.dimensions[0], 5);
    expect(size.y).toBeCloseTo(model.dimensions[1], 5);
    expect(size.z).toBeCloseTo(model.dimensions[2], 5);
    expect(geometry.boundingBox!.min.z).toBeCloseTo(0, 6);
    expect(geometry.boundingBox!.getCenter(new Vector3()).x).toBeCloseTo(0);
    expect(signedVolume(geometry)).toBeGreaterThan(0);
  });

  it('pyramid and triangular prism have their exact analytic volumes', () => {
    for (const [shape, fraction] of [['pyramid', 1 / 3], ['prism', 1 / 2]] as const) {
      const model = { ...demoModels[0]!, shape, dimensions: [2, 3, 1] } satisfies ModelDefinition;
      expect(signedVolume(createModelGeometry(model))).toBeCloseTo(6 * fraction);
    }
  });

  it('scoop is genuinely concave, has a solid floor and an inward-facing inner wall', () => {
    const model = demoModels.find(m => m.shape === 'scoop')!;
    const geometry = createModelGeometry(model);
    const centre = raycast(geometry, 0, 0)[0]!;
    const inner = raycast(geometry, model.dimensions[0] * .25, 0)[0]!;
    const rim = raycast(geometry, model.dimensions[0] * .47, 0)[0]!;
    expect(centre.point.z).toBeCloseTo(model.dimensions[2] * .16, 5);
    expect(inner.point.z).toBeGreaterThan(centre.point.z);
    expect(rim.point.z).toBeCloseTo(model.dimensions[2], 5);
    expect(inner.face!.normal.x).toBeLessThan(0);
    expect(inner.face!.normal.z).toBeGreaterThan(0);
    const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), inner.face!.normal);
    expect(isPointOnModelSurface(model, inner.point.toArray() as [number, number, number], rotation.toArray() as [number, number, number, number])).toBe(true);
    expect(isPointOnModelSurface(model, [0, 0, model.dimensions[2]], [0, 0, 0, 1])).toBe(false);
    expect(isPointOnModelSurface(model, [0, 0, 0], [0, 0, 0, 1])).toBe(false);
  });
});

function surfaceScene(): SceneDocument {
  const scene = createDemoScene();
  scene.walls = [{ ...wall(), openings: [], position: [2, 1, 3], rotation: quaternionFromWallAngles(30, 40) }];
  scene.placements = [
    { id: 'volume', modelId: 'volume-box', modelVersion: 1, parentType: 'wall', parentId: 'wall', position: [0, 1, 0], rotation: [0, 0, Math.SQRT1_2, Math.SQRT1_2] },
    { id: 'hold', modelId: 'hold-jug', modelVersion: 1, parentType: 'volume', parentId: 'volume', position: [.1, .1, .25], rotation: [0, 0, 0, 1] },
  ];
  scene.boulders = [];
  return scene;
}

describe('transforms and semantic validation', () => {
  it('angle round-trip and inclination tilt the wall top towards the front', () => {
    const rotation = quaternionFromWallAngles(35, -50);
    expect(getWallAngles(rotation).inclination).toBeCloseTo(35);
    expect(getWallAngles(rotation).yaw).toBeCloseTo(-50);
    const top = new Vector3(0, 3, 0).applyQuaternion(new Quaternion(...quaternionFromWallAngles(35)));
    expect(top.z).toBeGreaterThan(0);
    expect(getWallAngles(quaternionFromWallAngles(90, 65)).inclination).toBeCloseTo(90);
    expect(getWallAngles(quaternionFromWallAngles(90, 65)).yaw).toBeCloseTo(65);
  });

  it('composes wall, volume and hold rotations; parent edits move attached children', () => {
    const scene = surfaceScene();
    expect(validateScene(scene)).toEqual([]);
    const pose = getWorldPose(scene, 'hold');
    const expected = new Vector3(.1, .1, .25)
      .applyQuaternion(new Quaternion(...scene.placements[0]!.rotation))
      .add(new Vector3(0, 1, 0))
      .applyQuaternion(new Quaternion(...scene.walls[0]!.rotation))
      .add(new Vector3(2, 1, 3));
    pose.position.forEach((value, i) => expect(value).toBeCloseTo(expected.toArray()[i]!, 8));
    scene.walls[0]!.position[0] += 2;
    expect(getWorldPose(scene, 'hold').position[0]).toBeCloseTo(pose.position[0] + 2);
    scene.placements[0]!.position[1] += .5;
    expect(new Vector3(...getWorldPose(scene, 'hold').position).distanceTo(new Vector3(...pose.position))).toBeGreaterThan(1);
  });

  it('rejects detached anchors, missing references, duplicates, cycles and volume stacking', () => {
    const detached = surfaceScene(); detached.placements[1]!.position[2] = .5;
    expect(validateScene(detached).join(' ')).toContain('Ancrage');
    const duplicate = surfaceScene(); duplicate.placements.push(structuredClone(duplicate.placements[0]!));
    expect(validateScene(duplicate).join(' ')).toContain('dupliqué');
    const missing = surfaceScene(); missing.placements[1]!.parentId = 'absent';
    expect(validateScene(missing).join(' ')).toContain('introuvable');
    const cycle = surfaceScene(); cycle.placements[0]!.parentType = 'volume'; cycle.placements[0]!.parentId = 'hold';
    expect(validateScene(cycle).join(' ')).toContain('Cycle');
    expect(() => getWorldPose(cycle, 'hold')).toThrow('Cycle');
    const stacking = surfaceScene(); stacking.placements[1]!.modelId = 'volume-pyramid';
    expect(validateScene(stacking).join(' ')).toContain('interdite');
    const invalid = surfaceScene(); invalid.walls[0]!.width = -1;
    expect(validateScene(invalid).length).toBeGreaterThan(0);
    const nonfinite = surfaceScene(); nonfinite.placements[0]!.position[0] = Infinity;
    expect(validateScene(nonfinite).length).toBeGreaterThan(0);
  });
});
