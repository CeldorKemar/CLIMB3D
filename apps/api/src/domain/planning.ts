import type { ModelDefinition, Placement, SceneDocument } from '@climbed/contracts';

// Pure domain rules: no SQL, HTTP, Nest, sessions or filesystem dependency.
export class InvalidPlan extends Error {}
export class PlanningConflict extends Error {}
export interface OccupiedPiece { id: string; placement_id: string; state: string; model_fingerprint: string; wall_id: string }
export interface AvailablePiece { model_id: string; model_fingerprint: string }

export function placementWall(scene: SceneDocument, placementId: string): string {
  const seen = new Set<string>();
  let placement = scene.placements.find(p => p.id === placementId);
  while (placement) {
    if (seen.has(placement.id)) throw new InvalidPlan('Cycle dans les supports.');
    seen.add(placement.id);
    if (placement.parentType === 'wall') return placement.parentId;
    const parentId = placement.parentId;
    placement = scene.placements.find(p => p.id === parentId);
  }
  throw new InvalidPlan('Support de placement introuvable.');
}

export function wallScope(scene: SceneDocument, occupied: readonly OccupiedPiece[], requested: readonly string[] | null): string[] {
  const known = new Set([...scene.walls.map(w => w.id), ...occupied.map(o => o.wall_id)]);
  const result = requested ? [...new Set(requested)].sort() : [...known].sort();
  if (!result.length || result.some(id => !known.has(id))) throw new InvalidPlan('Périmètre de pans invalide.');
  return result;
}

export function computeDelta<O extends OccupiedPiece, A extends AvailablePiece>(
  scene: SceneDocument, allOccupied: readonly O[], allAvailable: readonly A[], wallIds: readonly string[],
  fingerprintModel: (model: ModelDefinition) => string,
): { retained: O[]; removed: O[]; add: Array<{ item: A; placement: Placement }> } {
  const occupied = allOccupied.filter(o => wallIds.includes(o.wall_id));
  const target = scene.placements.filter(p => wallIds.includes(placementWall(scene, p.id)));
  const available = [...allAvailable];
  const retained: O[] = [], add: Array<{ item: A; placement: Placement }> = [];
  for (const placement of target) {
    if (allOccupied.some(o => o.placement_id === placement.id && !wallIds.includes(o.wall_id))) throw new PlanningConflict('Un déplacement entre pans doit inclure le pan de départ et le pan cible.');
    const model = scene.models.find(m => m.id === placement.modelId);
    if (!model) throw new InvalidPlan('Modèle de placement introuvable.');
    const hash = fingerprintModel(model);
    const existing = occupied.find(o => o.placement_id === placement.id && o.state === 'installed' && o.model_fingerprint === hash);
    if (existing) retained.push(existing);
    else {
      const index = available.findIndex(item => item.model_id === placement.modelId && item.model_fingerprint === hash);
      if (index < 0) throw new PlanningConflict(`Stock compatible insuffisant pour « ${model.name} ». Aucun matériel réservé.`);
      add.push({ item: available.splice(index, 1)[0]!, placement });
    }
  }
  return { retained, add, removed: occupied.filter(o => !retained.some(r => r.id === o.id)) };
}
