import { describe, expect, it } from 'vitest';
import { createDemoScene } from '@climbed/contracts';
import { applyCommand, commitScene, createHistory, undoHistory, redoHistory } from '../src/index';

describe('commandes de conception réversibles', () => {
  it('retrouve les versions complètes et invalide la branche redo après une nouvelle édition', () => {
    const initial = createDemoScene();
    const first = applyCommand(initial, { type: 'patch-wall', id: 'wall-main', patch: { width: 6 } });
    const history = commitScene(createHistory(initial), first);
    const back = undoHistory(history);
    expect(back.present).toEqual(initial);
    expect(redoHistory(back).present).toEqual(first);
    const replacement = applyCommand(back.present, { type: 'patch-wall', id: 'wall-main', patch: { width: 7 } });
    expect(commitScene(back, replacement).future).toHaveLength(0);
    expect(initial.walls[0]?.width).toBe(5);
  });

  it('supprime les enfants et associations de parcours sans toucher la scène source', () => {
    const scene = createDemoScene();
    const next = applyCommand(scene, { type: 'remove-wall', id: 'wall-main' });
    expect(next.walls).toHaveLength(scene.walls.length - 1);
    expect(next.placements.some(p => p.parentId === 'wall-main' || p.parentId === 'placement-volume')).toBe(false);
    const remainingIds = new Set(next.placements.map(p => p.id));
    expect(next.boulders[0]?.placementIds.every(id => remainingIds.has(id))).toBe(true);
    expect(scene.placements.length).toBeGreaterThan(0);
  });

  it('rejette une modification invalide sans perdre le dernier état', () => {
    const scene = createDemoScene();
    expect(() => applyCommand(scene, { type: 'patch-wall', id: 'wall-main', patch: { width: 0 } })).toThrow();
    expect(scene.walls[0]?.width).toBe(5);
    let singleWall = scene;
    for (const wall of scene.walls.slice(1)) singleWall = applyCommand(singleWall, { type: 'remove-wall', id: wall.id });
    expect(() => applyCommand(singleWall, { type: 'remove-wall', id: 'wall-main' })).toThrow('au moins un pan');
  });

  it('une entrée d’historique conserve les définitions et n’exécute aucun stock', () => {
    const scene = createDemoScene();
    const state = createHistory(scene);
    scene.name = 'Mutation extérieure';
    expect(state.present.name).toBe('Atelier de bloc');
    expect(Object.keys(state)).toEqual(['past', 'present', 'future']);
  });
});
