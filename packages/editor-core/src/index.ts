import { modelSchema, sceneSchema, type SceneDocument, type WallDefinition, type Placement, type BoulderDefinition, type ModelDefinition, type Vec3, type Quat } from '@climbed/contracts';
import { validateScene, validateSceneChange } from '@climbed/geometry';

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

export function assertValidScene(scene: SceneDocument, options: { collisions?: boolean } = {}): void {
  const parsed = sceneSchema.safeParse(scene);
  if (!parsed.success) throw new InvalidSceneError(parsed.error.issues.map(issue => `${issue.path.join('.')} : ${issue.message}`));
  const problems = validateScene(parsed.data, options);
  if (problems.length) throw new InvalidSceneError(problems);
}

export function assertValidSceneChange(previous: SceneDocument, next: SceneDocument): void {
  const problems = validateSceneChange(previous, next);
  if (problems.length) throw new InvalidSceneError(problems);
}

/** Local editing only. These functions never execute reservations or rewrite installed state. */
export function createHistory(scene: SceneDocument): EditorHistory {
  // Older documents may predate collision checks. Opening must preserve them;
  // subsequent edits may resolve their contacts but cannot introduce new ones.
  assertValidScene(scene, { collisions: false });
  return { past: [], present: structuredClone(scene), future: [] };
}

export function commitScene(history: EditorHistory, next: SceneDocument): EditorHistory {
  assertValidSceneChange(history.present, next);
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
  assertValidSceneChange(source, scene);
  return scene;
}

interface ClipboardAssociation {
  boulderId: string;
  placementIds: string[];
  startIds: string[];
  finishIds: string[];
}
interface ClipboardContent {
  version: 1;
  rootId: string;
  /** Includes the selected placement itself when kind is 'placement'. */
  placements: Placement[];
  models: ModelDefinition[];
  associations: ClipboardAssociation[];
}
export type SceneClipboard = ClipboardContent & (
  | { kind: 'wall'; wall: WallDefinition }
  | { kind: 'placement' }
);
export interface SelectionCopyResult {
  scene: SceneDocument;
  selectedId: string;
  addedPlacementIds: string[];
}

/** A deep snapshot: later edits or deletion of the source do not alter clipboard contents. */
export function copySelection(scene: SceneDocument, id: string): SceneClipboard {
  assertValidScene(scene, { collisions: false });
  const wall = scene.walls.find(item => item.id === id);
  const root = scene.placements.find(item => item.id === id);
  if (!wall && !root) throw new InvalidSceneError([`Objet à copier introuvable : ${id}`]);
  const ids = new Set(wall
    ? scene.placements.filter(item => item.parentType === 'wall' && item.parentId === wall.id).map(item => item.id)
    : [id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of scene.placements) {
      if (item.parentType === 'volume' && ids.has(item.parentId) && !ids.has(item.id)) {
        ids.add(item.id); changed = true;
      }
    }
  }
  const placements = scene.placements.filter(item => ids.has(item.id));
  const modelIds = new Set(placements.map(item => item.modelId));
  const associations = scene.boulders.flatMap(boulder => {
    const placementIds = boulder.placementIds.filter(item => ids.has(item));
    return placementIds.length ? [{
      boulderId: boulder.id, placementIds,
      startIds: boulder.startIds.filter(item => ids.has(item)),
      finishIds: boulder.finishIds.filter(item => ids.has(item)),
    }] : [];
  });
  const content: ClipboardContent = {
    version: 1, rootId: id, placements,
    models: scene.models.filter(item => modelIds.has(item.id)), associations,
  };
  return structuredClone(wall ? { ...content, kind: 'wall', wall } : { ...content, kind: 'placement' });
}

function rotatedVector(vector: Vec3, rotation: Quat): Vec3 {
  // Quaternion rotation without introducing a rendering dependency in editor-core.
  const [x, y, z] = vector, [qx, qy, qz, qw] = rotation;
  const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
  return [x + qw * tx + qy * tz - qz * ty, y + qw * ty + qz * tx - qx * tz, z + qw * tz + qx * ty - qy * tx];
}
const addVector = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/**
 * Creates an atomic, validated local copy. The caller commits the returned scene through
 * its history and checks physical stock separately. pasteIndex is relative to the snapshot.
 */
export function createSelectionCopy(
  source: SceneDocument, clipboard: SceneClipboard, createId: () => string, pasteIndex = 1,
): SelectionCopyResult {
  if (clipboard.version !== 1 || !Number.isInteger(pasteIndex) || pasteIndex < 1) {
    throw new InvalidSceneError(['Presse-papiers ou numéro de copie invalide.']);
  }
  const scene = structuredClone(source);
  for (const model of clipboard.models) {
    const existing = scene.models.find(item => item.id === model.id);
    // Zod rebuilds keys in schema order so equivalent serialized definitions compare equally.
    if (!existing || JSON.stringify(modelSchema.parse(existing)) !== JSON.stringify(modelSchema.parse(model))) {
      throw new InvalidSceneError([`Le modèle copié n’existe plus avec la même définition : ${model.id}`]);
    }
  }
  const occupiedIds = new Set([
    ...scene.walls.flatMap(wall => [wall.id, ...wall.openings.map(opening => opening.id)]),
    ...scene.models.map(model => model.id), ...scene.placements.map(item => item.id), ...scene.boulders.map(item => item.id),
  ]);
  const freshId = (): string => {
    const id = createId();
    if (!id || occupiedIds.has(id)) throw new InvalidSceneError(['Le générateur doit fournir un identifiant nouveau pour chaque objet.']);
    occupiedIds.add(id); return id;
  };
  const remapped = new Map<string, string>();
  let selectedId: string;
  if (clipboard.kind === 'wall') {
    const wall = structuredClone(clipboard.wall);
    selectedId = freshId(); remapped.set(clipboard.rootId, selectedId);
    wall.id = selectedId;
    wall.name = `${wall.name.slice(0, 91)} (copie)`;
    wall.openings = wall.openings.map(opening => ({ ...opening, id: freshId() }));
    wall.position = addVector(wall.position, rotatedVector([(wall.width + .3) * pasteIndex, 0, 0], wall.rotation));
    scene.walls.push(wall);
  } else {
    const root = clipboard.placements.find(item => item.id === clipboard.rootId);
    if (!root) throw new InvalidSceneError(['La sélection copiée ne contient plus son élément principal.']);
    selectedId = freshId(); remapped.set(root.id, selectedId);
  }
  for (const item of clipboard.placements) if (!remapped.has(item.id)) remapped.set(item.id, freshId());
  const copied = clipboard.placements.map(original => {
    const item = structuredClone(original);
    item.id = remapped.get(original.id)!;
    item.parentId = remapped.get(original.parentId) ?? original.parentId;
    if (clipboard.kind === 'placement' && original.id === clipboard.rootId) {
      const model = clipboard.models.find(model => model.id === original.modelId);
      if (!model) throw new InvalidSceneError([`Modèle absent du presse-papiers : ${original.modelId}`]);
      item.position = addVector(item.position, [(model.dimensions[0] + .08) * pasteIndex, 0, 0]);
    }
    return item;
  });
  scene.placements.push(...copied);
  const append = (existing: string[], originals: string[]) => [...new Set([...existing, ...originals.map(id => remapped.get(id)!).filter(Boolean)])];
  for (const association of clipboard.associations) {
    const boulder = scene.boulders.find(item => item.id === association.boulderId);
    if (!boulder) continue;
    boulder.placementIds = append(boulder.placementIds, association.placementIds);
    boulder.startIds = append(boulder.startIds, association.startIds);
    boulder.finishIds = append(boulder.finishIds, association.finishIds);
  }
  assertValidSceneChange(source, scene);
  return { scene, selectedId, addedPlacementIds: copied.map(item => item.id) };
}
