import type { SceneDocument, ModelDefinition } from '@climbed/contracts';
import { getMountingHoles } from '../src/mounting';

/** Explicit direct-screw profiles for tests about stock, hierarchy and collisions.
 * Tests about predrilled fixings use separate strict profiles, never this fixture.
 */
export function directScrewModels(models: ModelDefinition[]): ModelDefinition[] {
  return models.map(model => model.kind === 'volume' ? { ...structuredClone(model),
    mounting: { method: 'screw', screwPlacement: 'direct', holes: getMountingHoles(model) },
  } : structuredClone(model));
}
export function directScrewScene(scene: SceneDocument): SceneDocument {
  return { ...scene, models: directScrewModels(scene.models) };
}
