import { describe, expect, it } from 'vitest';
import { createDemoScene, type SceneDocument } from '@climbed/contracts';
import { getWorldPose, quaternionFromWallAngles } from '@climbed/geometry';
import { copySelection, createSelectionCopy, InvalidSceneError } from '../src/index';

function fixture(): SceneDocument {
  const scene = createDemoScene();
  scene.walls = [{ ...scene.walls[0]!, width: 8, height: 4, position: [1, 0, -2], rotation: [0, 0, 0, 1],
    openings: [{ id: 'opening', x: 2, y: 2, width: .4, height: .4 }] }];
  scene.placements = [
    { id: 'volume', modelId: 'volume-box', modelVersion: 1, parentType: 'wall', parentId: 'wall-main', position: [-2, 1, 0], rotation: [0, 0, 0, 1] },
    { id: 'child', modelId: 'hold-crimp', modelVersion: 1, parentType: 'volume', parentId: 'volume', position: [0, 0, .25], rotation: [0, 0, 0, 1] },
    { id: 'hold', modelId: 'hold-dome', modelVersion: 1, parentType: 'wall', parentId: 'wall-main', position: [0, 2.5, 0], rotation: [0, 0, 0, 1] },
  ];
  scene.boulders = [{ id: 'route', name: 'Voie 1', grade: '6a', color: '#f07c54',
    placementIds: ['volume', 'child', 'hold'], startIds: ['child'], finishIds: ['hold'] }];
  return scene;
}

function ids(prefix = 'copy') {
  let index = 0;
  return () => `${prefix}-${++index}`;
}

describe('presse-papiers de conception', () => {
  it('copie un pan complet avec des identifiants nouveaux et les coordonnées locales des descendants', () => {
    const scene = fixture();
    const before = structuredClone(scene);
    const clipboard = copySelection(scene, 'wall-main');
    const snapshot = structuredClone(clipboard);
    const result = createSelectionCopy(scene, clipboard, ids());
    const wall = result.scene.walls.at(-1)!;
    expect(result.selectedId).toBe(wall.id);
    expect(wall.id).not.toBe('wall-main');
    expect(wall.openings[0]!.id).not.toBe('opening');
    expect(wall.openings[0]).toEqual({ ...scene.walls[0]!.openings[0]!, id: wall.openings[0]!.id });
    expect(wall.position).toEqual([9.3, 0, -2]);
    const copies = result.scene.placements.filter(p => result.addedPlacementIds.includes(p.id));
    expect(copies).toHaveLength(3);
    const volume = copies.find(p => p.modelId === 'volume-box')!;
    const child = copies.find(p => p.parentType === 'volume')!;
    expect(volume.parentId).toBe(wall.id);
    expect(child.parentId).toBe(volume.id);
    expect(volume.position).toEqual(scene.placements[0]!.position);
    expect(child.position).toEqual(scene.placements[1]!.position);
    expect(new Set([wall.id, wall.openings[0]!.id, ...result.addedPlacementIds]).size).toBe(5);
    expect(scene).toEqual(before);
    expect(clipboard).toEqual(snapshot);
    result.scene.walls[1]!.openings[0]!.width = .6;
    result.scene.models[0]!.dimensions[0] = .5;
    expect(scene).toEqual(before);
    expect(clipboard).toEqual(snapshot);
  });

  it('décale le pan selon son axe local après orientation, avec un écart constant entre copies', () => {
    const scene = fixture();
    const wall = scene.walls[0]!;
    wall.rotation = quaternionFromWallAngles(25, 40);
    const clipboard = copySelection(scene, wall.id);
    const result = createSelectionCopy(scene, clipboard, ids(), 2);
    const next = result.scene.walls[1]!;
    const yaw = 40 * Math.PI / 180;
    expect(next.position[0]).toBeCloseTo(1 + 16.6 * Math.cos(yaw));
    expect(next.position[1]).toBeCloseTo(0);
    expect(next.position[2]).toBeCloseTo(-2 - 16.6 * Math.sin(yaw));
    expect(next.rotation).toEqual(wall.rotation);
  });

  it('conserve les données copiées après modification ou suppression de l’original', () => {
    const scene = fixture();
    const clipboard = copySelection(scene, 'volume');
    scene.placements = scene.placements.filter(p => p.id === 'hold');
    scene.boulders[0]!.placementIds = ['hold'];
    scene.boulders[0]!.startIds = [];
    const result = createSelectionCopy(scene, clipboard, ids());
    const volume = result.scene.placements.find(p => p.id === result.selectedId)!;
    const child = result.scene.placements.find(p => p.parentId === volume.id)!;
    expect(volume.position).toEqual([-1.17, 1, 0]);
    expect(child.position).toEqual([0, 0, .25]);
    expect(result.addedPlacementIds).toHaveLength(2);
    expect(result.scene.boulders[0]!.startIds).toEqual([child.id]);
  });

  it('fige aussi les propriétés imbriquées du pan et les associations au moment de la copie', () => {
    const scene = fixture();
    const clipboard = copySelection(scene, 'wall-main');
    scene.walls[0]!.openings[0]!.width = .7;
    scene.walls[0]!.name = 'Pan renommé après copie';
    scene.boulders[0]!.startIds = [];
    const result = createSelectionCopy(scene, clipboard, ids());
    expect(result.scene.walls[1]!.openings[0]!.width).toBe(.4);
    expect(result.scene.walls[1]!.name).not.toContain('renommé');
    expect(result.scene.boulders[0]!.startIds).toEqual([result.addedPlacementIds[1]]);
  });

  it('une prise seule conserve son support et se décale sans déplacer ses voisines', () => {
    const scene = fixture();
    const result = createSelectionCopy(scene, copySelection(scene, 'hold'), ids(), 2);
    const copy = result.scene.placements.at(-1)!;
    expect(copy.parentId).toBe('wall-main');
    expect(copy.position).toEqual([.54, 2.5, 0]);
    expect(result.addedPlacementIds).toEqual([copy.id]);
    expect(getWorldPose(result.scene, copy.id).position).toEqual([1.54, 2.5, -2]);
  });

  it('une prise sur volume reste sur ce volume, puis refuse le collage si le support a été supprimé', () => {
    const scene = fixture();
    scene.placements[1]!.position = [-.05, 0, .25];
    const clipboard = copySelection(scene, 'child');
    const result = createSelectionCopy(scene, clipboard, ids());
    const copy = result.scene.placements.at(-1)!;
    expect(copy.parentType).toBe('volume');
    expect(copy.parentId).toBe('volume');
    expect(copy.position[0]).toBeCloseTo(.23);
    expect(copy.position.slice(1)).toEqual([0, .25]);
    scene.placements = scene.placements.filter(p => p.id === 'hold');
    scene.boulders = [];
    const before = structuredClone(scene);
    expect(() => createSelectionCopy(scene, clipboard, ids())).toThrow('Support introuvable');
    expect(scene).toEqual(before);
  });

  it('étend les mêmes voies existantes et conserve les associations multiples', () => {
    const scene = fixture();
    scene.boulders.push({ ...structuredClone(scene.boulders[0]!), id: 'route-2', name: 'Voie 2' });
    const result = createSelectionCopy(scene, copySelection(scene, 'volume'), ids());
    const childId = result.addedPlacementIds[1]!;
    expect(result.scene.boulders.map(b => b.id)).toEqual(['route', 'route-2']);
    for (const route of result.scene.boulders) {
      expect(route.placementIds).toEqual(['volume', 'child', 'hold', ...result.addedPlacementIds]);
      expect(route.startIds).toEqual(['child', childId]);
      expect(route.finishIds).toEqual(['hold']);
    }
  });

  it('ne recrée jamais une voie supprimée depuis la copie', () => {
    const scene = fixture();
    const clipboard = copySelection(scene, 'hold');
    scene.boulders = [];
    expect(createSelectionCopy(scene, clipboard, ids()).scene.boulders).toEqual([]);
  });

  it('rejette une définition de modèle supprimée ou changée sous le même identifiant', () => {
    const original = fixture();
    const clipboard = copySelection(original, 'hold');
    for (const change of ['delete', 'shape', 'dimension', 'color', 'fixing'] as const) {
      const scene = structuredClone(original);
      const model = scene.models.find(m => m.id === 'hold-dome')!;
      if (change === 'delete') scene.models = scene.models.filter(m => m.id !== model.id);
      if (change === 'shape') model.shape = 'jug';
      if (change === 'dimension') model.dimensions[0] += .1;
      if (change === 'color') model.color = '#000000';
      if (change === 'fixing') model.fixing = { method: 'screw' };
      const before = structuredClone(scene);
      expect(() => createSelectionCopy(scene, clipboard, ids())).toThrow('même définition');
      expect(scene).toEqual(before);
    }
  });

  it('accepte le même modèle malgré un ordre de clés JSON différent', () => {
    const scene = fixture();
    const clipboard = copySelection(scene, 'hold');
    scene.models = scene.models.map(model => Object.fromEntries(Object.entries(model).reverse()) as typeof model);
    expect(createSelectionCopy(scene, clipboard, ids()).addedPlacementIds).toHaveLength(1);
  });

  it('refuse atomiquement les collisions et les sorties de pan', () => {
    const scene = fixture();
    const clipboard = copySelection(scene, 'hold');
    scene.placements.push({ ...structuredClone(scene.placements[2]!), id: 'blocker', position: [.27, 2.5, 0] });
    const before = structuredClone(scene);
    expect(() => createSelectionCopy(scene, clipboard, ids())).toThrow('Collision');
    expect(scene).toEqual(before);
    const outside = fixture();
    expect(() => createSelectionCopy(outside, copySelection(outside, 'hold'), ids(), 20)).toThrow('hors du pan');
    expect(outside).toEqual(fixture());
  });

  it('refuse de dépasser les quatre départs ou arrivées sans tronquer les associations', () => {
    const scene = fixture();
    const route = scene.boulders[0]!;
    const base = scene.placements[2]!;
    for (let i = 0; i < 3; i++) {
      const hold = { ...structuredClone(base), id: `extra-${i}`, position: [i - 1, 3.3, 0] as [number, number, number] };
      scene.placements.push(hold);
      route.placementIds.push(hold.id);
      route.startIds.push(hold.id);
      route.finishIds.push(hold.id);
    }
    const before = structuredClone(scene);
    expect(() => createSelectionCopy(scene, copySelection(scene, 'volume'), ids())).toThrow('startIds');
    expect(() => createSelectionCopy(scene, copySelection(scene, 'hold'), ids())).toThrow('finishIds');
    expect(scene).toEqual(before);
  });

  it('refuse des identifiants déjà occupés, y compris une ouverture, ou réutilisés par le générateur', () => {
    const scene = fixture();
    const clipboard = copySelection(scene, 'wall-main');
    for (const value of ['wall-main', 'volume-box', 'volume', 'route', 'opening', '']) {
      expect(() => createSelectionCopy(scene, clipboard, () => value)).toThrow('identifiant nouveau');
    }
    expect(() => createSelectionCopy(scene, clipboard, () => 'same-new-id')).toThrow('identifiant nouveau');
    expect(scene).toEqual(fixture());
  });

  it('refuse les sélections inexistantes et les indices de collage invalides', () => {
    const scene = fixture();
    expect(() => copySelection(scene, 'missing')).toThrow(InvalidSceneError);
    const clipboard = copySelection(scene, 'hold');
    for (const index of [0, -1, 1.5, Number.NaN, Infinity]) {
      expect(() => createSelectionCopy(scene, clipboard, ids(), index)).toThrow('numéro de copie');
    }
  });
});
