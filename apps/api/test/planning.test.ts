import { describe, expect, it } from 'vitest';
import { computeDelta, InvalidPlan, placementWall, PlanningConflict, wallScope } from '../src/domain/planning.ts';
import { testScene, wallPlacement } from './fixtures.ts';

function pyramidScene() {
  const scene = testScene();
  scene.placements = [wallPlacement('placement-volume', 'volume-pyramid')];
  return scene;
}

describe('Règles métier pures de planification', () => {
  it('retrouve le pan racine des prises sur un volume', () => {
    const scene = pyramidScene();
    scene.placements.push({ ...wallPlacement('child', 'hold-jug'), parentType: 'volume', parentId: 'placement-volume' });
    expect(placementWall(scene, 'child')).toBe('wall-main');
  });
  it('rejette les cycles et les supports absents', () => {
    const scene = pyramidScene();
    scene.placements[0]!.parentType = 'volume'; scene.placements[0]!.parentId = 'placement-volume';
    expect(() => placementWall(scene, 'placement-volume')).toThrow(InvalidPlan);
    expect(() => placementWall(scene, 'missing')).toThrow(InvalidPlan);
  });
  it('inclut les anciens pans supprimés pour un retour global explicite', () => {
    const scene = testScene();
    expect(wallScope(scene, [{ id: 'o', placement_id: 'old', model_fingerprint: 'x', wall_id: 'removed-wall', state: 'installed' }], null)).toContain('removed-wall');
    expect(() => wallScope(scene, [], ['unknown'])).toThrow(InvalidPlan);
  });
  it('conserve une pièce sans demander du stock ni modifier les entrées', () => {
    const scene = pyramidScene();
    const occupied = [{ id: 'o', placement_id: 'placement-volume', model_fingerprint: 'geometry', wall_id: 'wall-main', state: 'installed' }];
    const delta = computeDelta(scene, occupied, [], ['wall-main'], () => 'geometry');
    expect(delta.retained).toEqual(occupied); expect(delta.add).toHaveLength(0); expect(delta.removed).toHaveLength(0);
    expect(occupied[0]!.state).toBe('installed');
  });
  it('exige les deux pans lors du déplacement d’une pièce installée', () => {
    const scene = pyramidScene(); scene.placements[0]!.parentId = 'wall-side';
    const occupied = [{ id: 'o', placement_id: 'placement-volume', model_fingerprint: 'geometry', wall_id: 'wall-main', state: 'installed' }];
    expect(() => computeDelta(scene, occupied, [], ['wall-side'], () => 'geometry')).toThrow(PlanningConflict);
    expect(computeDelta(scene, occupied, [], ['wall-main', 'wall-side'], () => 'geometry').retained).toHaveLength(1);
  });
  it('ne consomme pas les pièces hors périmètre et n’altère pas le stock en cas d’échec', () => {
    const scene = pyramidScene(); scene.placements.push(wallPlacement('second', 'volume-pyramid'));
    const available = [{ model_id: 'volume-pyramid', model_fingerprint: 'geometry' }];
    expect(() => computeDelta(scene, [], available, ['wall-main'], () => 'geometry')).toThrow(PlanningConflict);
    expect(available).toHaveLength(1);
    expect(computeDelta(scene, [], available, ['wall-side'], () => 'geometry').add).toHaveLength(0);
  });
});
