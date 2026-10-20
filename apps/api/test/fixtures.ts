import { demoModels, type Placement, type SceneDocument } from '@climbed/contracts';
import { directScrewModels } from '../../../packages/geometry/tests/fixtures.ts';
import { seed } from '../src/seed.ts';
import type { Pool } from 'pg';

export const seedTestFixtures = (pool: Pool) => seed(pool, directScrewModels(demoModels));

// Deliberately independent of the presentation demo's placements, indices and route sizes.
// Catalog definitions match seeded physical variants; each test supplies its own topology.
export function testScene(): SceneDocument {
  return {
    schemaVersion: 1, name: 'Scène de test autonome', units: 'm', upAxis: 'Y', models: directScrewModels(demoModels),
    walls: [
      { id: 'wall-main', name: 'Pan A', width: 5, height: 4, thickness: 0.18, position: [0, 0, 0], rotation: [0, 0, 0, 1], color: '#dddddd', openings: [], fixingSpacing: 0.25 },
      { id: 'wall-side', name: 'Pan B', width: 3, height: 4, thickness: 0.18, position: [4, 0, 0], rotation: [0, 0, 0, 1], color: '#dddddd', openings: [], fixingSpacing: 0.25 },
    ],
    placements: [], boulders: [],
  };
}
export function wallPlacement(id: string, modelId: string, parentId = 'wall-main'): Placement {
  return { id, modelId, modelVersion: 1, parentType: 'wall', parentId, position: [0, 1, 0], rotation: [0, 0, 0, 1] };
}
export function boxScene(): SceneDocument {
  const scene = testScene();
  scene.placements = [wallPlacement('physical-target', 'volume-box')];
  return scene;
}
