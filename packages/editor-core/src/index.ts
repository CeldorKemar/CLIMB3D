import { sceneSchema, type SceneDocument, type WallDefinition, type Placement, type BoulderDefinition, type ModelDefinition } from '@climbed/contracts';
import { validateScene } from '@climbed/geometry';

export interface EditorHistory {
  past: SceneDocument[];
  present: SceneDocument;
  future: SceneDocument[];
}

export type EditorCommand =
  | { type: 'add-wall'; wall: WallDefinition }
  | { type: 'patch-wall'; id: string; patch: Partial<Omit<WallDefinition, 'id'>> }
  | { type: 'remove-wall'; id: string }
  | { type: 'add-placement'; placement: Placement }
  | { type: 'patch-placement'; id: string; patch: Partial<Omit<Placement, 'id'>> }
  | { type: 'remove-placement'; id: string }
  | { type: 'add-model'; model: ModelDefinition }
  | { type: 'add-boulder'; boulder: BoulderDefinition }
  | { type: 'patch-boulder'; id: string; patch: Partial<Omit<BoulderDefinition, 'id'>> }
  | { type: 'remove-boulder'; id: string };

export class InvalidSceneError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(problems.join(' · '));
    this.name = 'InvalidSceneError';
    this.problems = problems;
  }
}

export function assertValidScene(scene: SceneDocument): void {
  const parsed = sceneSchema.safeParse(scene);
  if (!parsed.success) throw new InvalidSceneError(parsed.error.issues.map(issue => `${issue.path.join('.')} : ${issue.message}`));
  const problems = validateScene(parsed.data);
  if (problems.length) throw new InvalidSceneError(problems);
}

/** Local editing only. These functions never execute reservations or rewrite installed state. */
export function createHistory(scene: SceneDocument): EditorHistory {
  assertValidScene(scene);
  return { past: [], present: structuredClone(scene), future: [] };
}

export function commitScene(history: EditorHistory, next: SceneDocument): EditorHistory {
  assertValidScene(next);
  if (JSON.stringify(history.present) === JSON.stringify(next)) return history;
  return { past: [...history.past.slice(-79), history.present], present: structuredClone(next), future: [] };
}

export function undoHistory(history: EditorHistory): EditorHistory {
  const last = history.past.at(-1);
  if (!last) return history;
  return { past: history.past.slice(0, -1), present: last, future: [history.present, ...history.future] };
}

export function redoHistory(history: EditorHistory): EditorHistory {
  const first = history.future[0];
  if (!first) return history;
  return { past: [...history.past, history.present], present: first, future: history.future.slice(1) };
}

export function applyCommand(source: SceneDocument, command: EditorCommand): SceneDocument {
  const scene = structuredClone(source);
  const required = <T extends { id: string }>(list: T[], id: string): T => {
    const item = list.find(entry => entry.id === id);
    if (!item) throw new InvalidSceneError([`Objet introuvable : ${id}`]);
    return item;
  };
  const removePlacements = (firstIds: string[]): void => {
    const ids = new Set(firstIds);
    let changed = true;
    while (changed) {
      changed = false;
      for (const placement of scene.placements) {
        if (placement.parentType === 'volume' && ids.has(placement.parentId) && !ids.has(placement.id)) {
          ids.add(placement.id); changed = true;
        }
      }
    }
    scene.placements = scene.placements.filter(item => !ids.has(item.id));
    scene.boulders = scene.boulders.map(boulder => ({
      ...boulder,
      placementIds: boulder.placementIds.filter(id => !ids.has(id)),
      startIds: boulder.startIds.filter(id => !ids.has(id)),
      finishIds: boulder.finishIds.filter(id => !ids.has(id)),
    }));
  };

  switch (command.type) {
    case 'add-wall': scene.walls.push(command.wall); break;
    case 'patch-wall': Object.assign(required(scene.walls, command.id), command.patch); break;
    case 'remove-wall': {
      required(scene.walls, command.id);
      if (scene.walls.length <= 1) throw new InvalidSceneError(['Le projet doit conserver au moins un pan.']);
      removePlacements(scene.placements.filter(p => p.parentType === 'wall' && p.parentId === command.id).map(p => p.id));
      scene.walls = scene.walls.filter(w => w.id !== command.id);
      break;
    }
    case 'add-placement': scene.placements.push(command.placement); break;
    case 'patch-placement': Object.assign(required(scene.placements, command.id), command.patch); break;
    case 'remove-placement': required(scene.placements, command.id); removePlacements([command.id]); break;
    case 'add-model': scene.models.push(command.model); break;
    case 'add-boulder': scene.boulders.push(command.boulder); break;
    case 'patch-boulder': Object.assign(required(scene.boulders, command.id), command.patch); break;
    case 'remove-boulder': required(scene.boulders, command.id); scene.boulders = scene.boulders.filter(b => b.id !== command.id); break;
  }
  assertValidScene(scene);
  return scene;
}
