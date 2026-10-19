import type { SceneDocument } from '@climbed/contracts';
import { InvalidPlan, placementWall, PlanningConflict } from './planning.ts';

function closure(scene: SceneDocument, ids: readonly string[]): Set<string> {
  const result = new Set<string>();
  const visit = (id: string, path: Set<string>) => {
    if (path.has(id)) throw new InvalidPlan('Cycle dans les supports sauvegardés.');
    if (result.has(id)) return;
    const placement = scene.placements.find(p => p.id === id);
    if (!placement) throw new InvalidPlan(`Placement sauvegardé absent : ${id}.`);
    result.add(id);
    if (placement.parentType === 'volume') visit(placement.parentId, new Set([...path, id]));
  };
  for (const id of ids) visit(id, new Set());
  return result;
}

/** Restore only one route; preserve every foreign route and all of its support ancestors. */
export function mergeBoulderSnapshot(current: SceneDocument, saved: SceneDocument, boulderId: string, same: (a: unknown, b: unknown) => boolean): SceneDocument {
  const source = saved.boulders.find(b => b.id === boulderId);
  if (!source) throw new InvalidPlan('Voie absente de la sauvegarde.');
  const old = current.boulders.find(b => b.id === boulderId);
  const oldOwn = old ? closure(current, old.placementIds) : new Set<string>();
  const desired = closure(saved, source.placementIds);
  const foreignRoots = current.boulders.filter(b => b.id !== boulderId).flatMap(b => b.placementIds);
  const outside = current.placements.filter(p => !oldOwn.has(p.id)).map(p => p.id);
  const protectedIds = closure(current, [...foreignRoots, ...outside]);
  const candidate = structuredClone(current);

  for (const id of desired) {
    const placement = saved.placements.find(p => p.id === id)!;
    const existing = current.placements.find(p => p.id === id);
    if (existing && protectedIds.has(id) && !same(existing, placement)) throw new PlanningConflict('Une prise ou un volume partagé a changé : restauration refusée pour préserver les autres voies.');
    const model = saved.models.find(m => m.id === placement.modelId);
    if (!model) throw new InvalidPlan('Modèle absent de la sauvegarde.');
    const currentModel = candidate.models.find(m => m.id === model.id);
    if (currentModel && !same(currentModel, model)) throw new PlanningConflict('Un modèle sauvegardé possède une définition différente sous le même identifiant.');
    if (!currentModel) candidate.models.push(structuredClone(model));

    const wallId = placementWall(saved, id);
    const wall = saved.walls.find(w => w.id === wallId);
    if (!wall) throw new InvalidPlan('Pan absent de la sauvegarde.');
    const existingWall = candidate.walls.find(w => w.id === wallId);
    if (existingWall && !same(existingWall, wall)) {
      const usedOutside = current.placements.some(p => protectedIds.has(p.id) && placementWall(current, p.id) === wallId);
      if (usedOutside) throw new PlanningConflict('Un pan utilisé par une autre voie a changé : restauration refusée.');
      candidate.walls = candidate.walls.map(w => w.id === wallId ? structuredClone(wall) : w);
    } else if (!existingWall) candidate.walls.push(structuredClone(wall));
  }

  candidate.placements = candidate.placements.filter(p => !oldOwn.has(p.id) || protectedIds.has(p.id) || desired.has(p.id));
  for (const id of desired) {
    const placement = structuredClone(saved.placements.find(p => p.id === id)!);
    const index = candidate.placements.findIndex(p => p.id === id);
    if (index < 0) candidate.placements.push(placement); else candidate.placements[index] = placement;
  }
  const index = candidate.boulders.findIndex(b => b.id === boulderId);
  if (index < 0) candidate.boulders.push(structuredClone(source)); else candidate.boulders[index] = structuredClone(source);
  return candidate;
}
