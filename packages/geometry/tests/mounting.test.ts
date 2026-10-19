import { describe, expect, it } from 'vitest';
import { createDemoScene, demoModels, sceneSchema, type ModelDefinition, type Placement, type SceneDocument, type Vec3 } from '@climbed/contracts';
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { createModelGeometry, getMountingHoles, getSupportFixings, snapPlacementToFixing, validatePlacementMounting, validateSceneChange } from '../src/index';

function scene(): SceneDocument {
  const s = createDemoScene();
  s.walls = [{ ...s.walls[0]!, width: 4, height: 3, rotation: [0, 0, 0, 1], openings: [] }];
  s.placements = []; s.boulders = [];
  return s;
}
function hold(s: SceneDocument, position: Vec3 = [0, 1, 0]): Placement {
  return { id: 'new-hold', modelId: 'hold-crimp', modelVersion: 1, parentType: 'wall', parentId: s.walls[0]!.id, position, rotation: [0, 0, 0, 1] };
}
function ray(model: ModelDefinition, position: Vec3, direction: Vec3) {
  const geometry = createModelGeometry(model), material = new MeshBasicMaterial({ side: DoubleSide });
  const mesh = new Mesh(geometry, material); mesh.updateMatrixWorld();
  try { return new Raycaster(new Vector3(...position), new Vector3(...direction)).intersectObject(mesh); }
  finally { geometry.dispose(); material.dispose(); }
}
function signedVolume(model: ModelDefinition) {
  const geometry = createModelGeometry(model), attr = geometry.getAttribute('position');
  let volume = 0;
  for (let i = 0; i < attr.count; i += 3) {
    const a = new Vector3().fromBufferAttribute(attr, i), b = new Vector3().fromBufferAttribute(attr, i + 1), c = new Vector3().fromBufferAttribute(attr, i + 2);
    volume += a.dot(b.cross(c)) / 6;
  }
  geometry.dispose(); return volume;
}

describe('real model mounting tunnels', () => {
  it.each(demoModels)('$id has an open through-tunnel at each of its own fixing holes', model => {
    for (const hole of getMountingHoles(model)) {
      expect(ray(model, [hole.position[0], hole.position[1], 10], [0, 0, -1])).toHaveLength(0);
      expect(ray(model, [hole.position[0], hole.position[1], -1], [0, 0, 1])).toHaveLength(0);
    }
  });
  it('has an inward-facing cylindrical wall and still contains material beside the bore', () => {
    const model = demoModels[1]!, radius = getMountingHoles(model)[0]!.diameter / 2;
    const hit = ray(model, [0, 0, .01], [1, 0, 0])[0]!;
    expect(hit.point.x).toBeCloseTo(radius, 5);
    expect(hit.face!.normal.x).toBeLessThan(-.9);
    expect(ray(model, [radius * 2, 0, 1], [0, 0, -1]).length).toBeGreaterThan(0);
  });
  it('subtracts the actual polygonal cylinder volume, without closing either end', () => {
    const model: ModelDefinition = { ...demoModels[6]!, dimensions: [1, 1, .5],
      mounting: { method: 'bolt', holes: [{ id: 'main', position: [0, 0, 0], diameter: .02, role: 'primary' }] },
      supportFixings: { allowScrews: false, holes: [] } };
    const boreArea = 16 / 2 * .01 ** 2 * Math.sin(Math.PI * 2 / 16);
    expect(signedVolume(model)).toBeCloseTo(.5 - boreArea * .5, 7);
  });
  it('bores a real receiving insert perpendicular to a sloped pyramid face', () => {
    const model: ModelDefinition = { ...demoModels[4]!, dimensions: [1, 1, .5],
      supportFixings: { allowScrews: true, holes: [{ id: 'slope', position: [.25, 0, .25], normal: [Math.SQRT1_2, 0, Math.SQRT1_2], diameter: .012 }] } };
    expect(ray(model, [1.25, 0, 1.25], [-Math.SQRT1_2, 0, -Math.SQRT1_2])).toHaveLength(0);
    expect(ray(model, [1.25, .03, 1.25], [-Math.SQRT1_2, 0, -Math.SQRT1_2]).length).toBeGreaterThan(0);
  });
  it('never changes persisted legacy model JSON or parser defaults, including after cache use', () => {
    const original = JSON.stringify(demoModels);
    for (const model of demoModels) { getMountingHoles(model); getSupportFixings(model); createModelGeometry(model).dispose(); }
    expect(JSON.stringify(demoModels)).toBe(original);
    expect(sceneSchema.parse(scene()).models).toEqual(scene().models);
  });
});

describe('authoritative mounting rules and migration', () => {
  it('accepts a real insert alignment and rejects an arbitrary nearby point', () => {
    const s = scene();
    expect(validatePlacementMounting(s, hold(s))).toEqual([]);
    expect(validatePlacementMounting(s, hold(s, [.03, 1, 0])).join(' ')).toContain('non aligné');
    expect(getSupportFixings(s.walls[0]!).holes.some(h => h.position[0] === 0 && h.position[1] === 1)).toBe(true);
  });
  it('respects an explicitly bolted volume instead of inferring screws from its kind', () => {
    const s = scene(), model = s.models.find(m => m.id === 'volume-box')!;
    model.fixing = { method: 'bolt' };
    const p: Placement = { ...hold(s), modelId: model.id, position: [.03, 1, 0] };
    expect(getMountingHoles(model)).toHaveLength(1);
    expect(validatePlacementMounting(s, p).join(' ')).toContain('non aligné');
    expect(snapPlacementToFixing(s, p)!.position).toEqual([0, 1, 0]);
  });
  it('translates the actual offset/rotated model hole, rather than snapping its origin', () => {
    const s = scene(), model = s.models.find(m => m.id === 'hold-crimp')!;
    model.mounting = { method: 'bolt', holes: [{ id: 'offset', position: [.025, 0, 0], diameter: .006, role: 'primary' }] };
    const p = hold(s, [.01, .97, 0]); p.rotation = [0, 0, Math.SQRT1_2, Math.SQRT1_2];
    const snapped = snapPlacementToFixing(s, p)!;
    expect(snapped.position[0]).toBeCloseTo(0);
    expect(snapped.position[1]).toBeCloseTo(.975);
    expect(validatePlacementMounting(s, snapped)).toEqual([]);
    expect(snapPlacementToFixing(s, hold(s, [.12, 1.12, 0]), .02)).toBeUndefined();
  });
  it('checks insert normals and explicitly documented thread compatibility', () => {
    const s = scene(), model = s.models.find(m => m.id === 'hold-crimp')!;
    model.mounting = { method: 'bolt', threadDesignation: 'example-A', holes: getMountingHoles(model) };
    s.walls[0]!.supportFixings = { allowScrews: false, holes: [{ id: 'a', position: [0, 1, 0], normal: [0, 0, 1], threadDesignation: 'example-B' }] };
    expect(validatePlacementMounting(s, hold(s)).join(' ')).toContain('non aligné');
    s.walls[0]!.supportFixings!.holes[0]!.threadDesignation = 'example-A';
    expect(validatePlacementMounting(s, hold(s))).toEqual([]);
    s.walls[0]!.supportFixings!.holes[0]!.normal = [0, 1, 0];
    expect(validatePlacementMounting(s, hold(s)).join(' ')).toContain('non aligné');
  });
  it('allows screw volumes only on permitted surface, with every own screw supported', () => {
    const s = scene(), p = { ...hold(s), modelId: 'volume-pyramid', position: [.03, 1.02, 0] as Vec3 };
    expect(validatePlacementMounting(s, p)).toEqual([]);
    s.walls[0]!.supportFixings = { allowScrews: false, holes: [] };
    expect(validatePlacementMounting(s, p).join(' ')).toContain('n’autorise pas');
    s.walls[0]!.supportFixings.allowScrews = true;
    p.position[0] = 1.9;
    expect(validatePlacementMounting(s, p).join(' ')).toContain('hors de la surface');
  });
  it('supports a bolt on the example volume insert, without inventing inserts on every face', () => {
    const s = scene();
    s.placements = [{ ...hold(s), id: 'box', modelId: 'volume-box' }];
    const p: Placement = { ...hold(s), parentType: 'volume', parentId: 'box', position: [0, 0, .25] };
    expect(validatePlacementMounting(s, p)).toEqual([]);
    p.position[0] = .02;
    expect(validatePlacementMounting(s, p).join(' ')).toContain('non aligné');
  });
  it('rejects fictitious holes outside model material and receiving inserts floating off its surface', () => {
    const old = scene(), next = structuredClone(old), model = next.models.find(m => m.id === 'hold-crimp')!;
    model.mounting = { method: 'bolt', holes: [{ id: 'outside', position: [2, 0, 0], diameter: .01, role: 'primary' }] };
    expect(validateSceneChange(old, next).join(' ')).toContain('sort de la matière');
    delete model.mounting;
    model.supportFixings = { allowScrews: false, holes: [{ id: 'floating', position: [0, 0, 2], normal: [0, 0, 1] }] };
    expect(validateSceneChange(old, next).join(' ')).toContain('ne correspond pas à une face');
  });
  it('compares legacy placements by content when PostgreSQL JSONB reorders object keys', () => {
    const old = scene(); old.placements = [hold(old, [.03, 1, 0])];
    const reorder = (value: unknown): unknown => Array.isArray(value) ? value.map(reorder)
      : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reorder(item)])) : value;
    const next = reorder(old) as SceneDocument;
    expect(validateSceneChange(old, next)).toEqual([]);
  });
  it('keeps unchanged legacy anchors editable but refuses new or moved unaligned anchors', () => {
    const old = scene(); old.placements = [hold(old, [.03, 1, 0])];
    const next = structuredClone(old); next.name = 'Renamed';
    expect(validateSceneChange(old, next)).toEqual([]);
    next.walls[0]!.width = 4.9;
    expect(validateSceneChange(old, next)).toEqual([]);
    next.walls[0]!.position[0] = 4;
    expect(validateSceneChange(old, next)).toEqual([]);
    next.placements[0]!.position[0] = .04;
    expect(validateSceneChange(old, next).join(' ')).toContain('non aligné');
    const added = scene(); added.placements.push(hold(added, [.03, 1, 0]));
    expect(validateSceneChange(scene(), added).join(' ')).toContain('non aligné');
  });
});
