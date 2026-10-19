import { describe, expect, it } from 'vitest';
import { createDemoScene, type SceneDocument } from '@climbed/contracts';
import { applyCommand, commitScene, createHistory, planRouteRemoval, redoHistory, removeRouteWithPlacements, removeSelection, undoHistory } from '../src/index';

function fixture(): SceneDocument {
  const scene = createDemoScene();
  scene.walls = [{ ...scene.walls[0]!, width: 8, height: 4, position: [0, 0, 0], rotation: [0, 0, 0, 1], openings: [] }];
  scene.placements = [
    { id: 'volume', modelId: 'volume-box', modelVersion: 1, parentType: 'wall', parentId: 'wall-main', position: [-2, 1, 0], rotation: [0, 0, 0, 1] },
    { id: 'child', modelId: 'hold-crimp', modelVersion: 1, parentType: 'volume', parentId: 'volume', position: [0, 0, .25], rotation: [0, 0, 0, 1] },
    { id: 'hold', modelId: 'hold-dome', modelVersion: 1, parentType: 'wall', parentId: 'wall-main', position: [0, 2.5, 0], rotation: [0, 0, 0, 1] },
    { id: 'other-hold', modelId: 'hold-dome', modelVersion: 1, parentType: 'wall', parentId: 'wall-main', position: [1, 2.5, 0], rotation: [0, 0, 0, 1] },
  ];
  scene.boulders = [
    { id: 'route', name: 'Voie 1', grade: '6a', color: '#f07c54', placementIds: ['volume', 'child', 'hold'], startIds: ['child'], finishIds: ['hold'] },
    { id: 'other', name: 'Voie 2', grade: '6b', color: '#aabbcc', placementIds: ['hold', 'other-hold'], startIds: ['hold'], finishIds: ['other-hold'] },
  ];
  return scene;
}

describe('suppression multiple atomique', () => {
  it('supprime plusieurs pièces en un historique et restaure leurs associations en un seul undo', () => {
    const scene = fixture();
    const before = structuredClone(scene);
    const next = removeSelection(scene, ['child', 'hold', 'hold']);
    expect(next.placements.map(item => item.id)).toEqual(['volume', 'other-hold']);
    expect(next.boulders[0]).toMatchObject({ placementIds: ['volume'], startIds: [], finishIds: [] });
    expect(next.boulders[1]).toMatchObject({ placementIds: ['other-hold'], startIds: [], finishIds: ['other-hold'] });
    const history = commitScene(createHistory(scene), next);
    expect(history.past).toHaveLength(1);
    expect(undoHistory(history).present).toEqual(before);
    expect(redoHistory(undoHistory(history)).present).toEqual(next);
    expect(scene).toEqual(before);
  });

  it('supprime les descendants d’un volume sans supprimer les autres pièces', () => {
    const scene = fixture();
    expect(removeSelection(scene, ['volume', 'child']).placements.map(item => item.id)).toEqual(['hold', 'other-hold']);
    expect(applyCommand(scene, { type: 'remove-selection', ids: ['volume', 'hold'] }).placements.map(item => item.id)).toEqual(['other-hold']);
  });

  it('rejette un identifiant inconnu ou le dernier pan sans suppression partielle', () => {
    const scene = fixture();
    const before = structuredClone(scene);
    expect(() => removeSelection(scene, ['hold', 'missing'])).toThrow('introuvable');
    expect(() => removeSelection(scene, ['hold', 'wall-main'])).toThrow('au moins un pan');
    expect(scene).toEqual(before);
  });
});

describe('suppression d’une voie avec ses pièces', () => {
  it('supprime les pièces exclusives mais conserve une prise partagée et ses associations à l’autre voie', () => {
    const scene = fixture();
    expect(planRouteRemoval(scene, 'route')).toEqual({ removedIds: ['volume', 'child'], sharedIds: ['hold'], supportIds: [] });
    const next = removeRouteWithPlacements(scene, 'route');
    expect(next.placements.map(item => item.id)).toEqual(['hold', 'other-hold']);
    expect(next.boulders).toEqual([scene.boulders[1]]);
    expect(scene.placements).toHaveLength(4);
  });

  it('conserve un volume exclusif qui supporte une prise partagée', () => {
    const scene = fixture();
    scene.boulders[1]!.placementIds.push('child');
    expect(planRouteRemoval(scene, 'route')).toEqual({ removedIds: [], sharedIds: ['child', 'hold'], supportIds: ['volume'] });
    const next = removeRouteWithPlacements(scene, 'route');
    expect(next.placements).toEqual(scene.placements);
    expect(next.boulders[0]!.id).toBe('other');
  });

  it('conserve le support d’une prise sans voie, même si le volume appartient à la voie supprimée', () => {
    const scene = fixture();
    scene.boulders[0]!.placementIds = ['volume', 'hold'];
    scene.boulders[0]!.startIds = [];
    expect(planRouteRemoval(scene, 'route')).toEqual({ removedIds: [], sharedIds: ['hold'], supportIds: ['volume'] });
    expect(removeRouteWithPlacements(scene, 'route').placements).toEqual(scene.placements);
  });

  it('retire une prise exclusive en conservant son volume partagé', () => {
    const scene = fixture();
    scene.boulders[1]!.placementIds.push('volume');
    expect(planRouteRemoval(scene, 'route')).toEqual({ removedIds: ['child'], sharedIds: ['volume', 'hold'], supportIds: [] });
    const next = applyCommand(scene, { type: 'remove-boulder-with-placements', id: 'route' });
    expect(next.placements.map(item => item.id)).toEqual(['volume', 'hold', 'other-hold']);
  });

  it('annule la suppression entière et refuse une voie inconnue sans modifier la source', () => {
    const scene = fixture();
    const next = removeRouteWithPlacements(scene, 'route');
    expect(undoHistory(commitScene(createHistory(scene), next)).present).toEqual(scene);
    expect(() => removeRouteWithPlacements(scene, 'missing')).toThrow('Voie introuvable');
  });
});
