import type { ModelDefinition, MountingHole, Placement, SceneDocument, SupportFixingHole, SupportFixings, Vec3, WallDefinition } from '@climbed/contracts';
import { Quaternion, Vector3 } from 'three';
import { isPointOnModelSurface, isPointOnWall } from './index';

/** Metres, numerical alignment tolerance only. Not a manufacturer fitting allowance. */
export const MOUNTING_ALIGNMENT_EPSILON = 0.0005;
/** Synthetic demonstration holes; these defaults do not claim any supplier specification.
 * Inference never mutates legacy catalogue JSON or inventory fingerprints.
 */
export function getMountingHoles(model: ModelDefinition): MountingHole[] {
  if (model.mounting) return structuredClone(model.mounting.holes);
  const method = getMountingMethod(model);
  const [width, height] = model.dimensions;
  if (method === 'bolt') return [{ id: 'primary', position: [0, 0, 0], diameter: Math.min(.012, width * .18, height * .18), role: 'primary' }];
  const diameter = Math.min(.005, width * .08, height * .08);
  return [[-.3, -.3], [.3, -.3], [.3, .3], [-.3, .3]].map(([x, y], i) => ({
    id: `screw-${i + 1}`, position: [width * x!, height * y!, 0], diameter, role: 'primary',
  }));
}
export function getMountingMethod(model: ModelDefinition): 'bolt' | 'screw' {
  if (model.mounting) return model.mounting.method;
  if (model.fixing?.method === 'bolt' || model.fixing?.method === 'screw') return model.fixing.method;
  return model.kind === 'volume' ? 'screw' : 'bolt';
}

export function getSupportFixings(support: WallDefinition | ModelDefinition): SupportFixings {
  if (support.supportFixings) return structuredClone(support.supportFixings);
  if ('width' in support) {
    const grid = support.fixingGrid;
    const pitchX = grid?.pitchX ?? support.fixingSpacing, pitchY = grid?.pitchY ?? support.fixingSpacing;
    const originX = grid?.offsetX ?? 0, originY = grid?.offsetY ?? 0;
    const angle = (grid?.rotationDegrees ?? 0) * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
    // Scan in grid coordinates, including negative indices when an origin was explicitly provided.
    const radius = Math.hypot(support.width, support.height) + Math.hypot(originX, originY);
    const nx = Math.min(200, Math.ceil(radius / pitchX)), ny = Math.min(200, Math.ceil(radius / pitchY));
    const holes: SupportFixingHole[] = [];
    for (let ix = -nx; ix <= nx; ix++) for (let iy = -ny; iy <= ny; iy++) {
      const gx = ix * pitchX, gy = iy * pitchY;
      const position: Vec3 = [originX + gx * cos - gy * sin, originY + gx * sin + gy * cos, 0];
      if (!isPointOnWall(support, position)) continue;
      holes.push({ id: `insert-${ix}-${iy}`, position, normal: [0, 0, 1],
        ...(support.fixing?.holeDiameterMm ? { diameter: support.fixing.holeDiameterMm / 1000 } : {}),
        ...(support.fixing?.threadDesignation ? { threadDesignation: support.fixing.threadDesignation } : {}),
      });
      if (holes.length >= 4000) return { allowScrews: true, holes };
    }
    return { allowScrews: true, holes };
  }
  // A single explicitly synthetic front insert on the demonstration box; other volume
  // faces are screw-capable example material, without invented receiving inserts.
  return { allowScrews: true, holes: support.kind === 'volume' && support.shape === 'box'
    ? [{ id: 'example-front-insert', position: [0, 0, support.dimensions[2]], normal: [0, 0, 1] }]
    : [] };
}
function supportFor(scene: SceneDocument, placement: Placement): WallDefinition | ModelDefinition | undefined {
  if (placement.parentType === 'wall') return scene.walls.find(w => w.id === placement.parentId);
  const parent = scene.placements.find(p => p.id === placement.parentId);
  return parent && scene.models.find(m => m.id === parent.modelId);
}
function mountedPoint(placement: Placement, hole: MountingHole): Vector3 {
  return new Vector3(...hole.position).applyQuaternion(new Quaternion(...placement.rotation)).add(new Vector3(...placement.position));
}
function compatible(model: ModelDefinition, normal: Vector3, hole: SupportFixingHole): boolean {
  const requiredThread = model.mounting?.threadDesignation ?? model.fixing?.threadDesignation;
  return normal.dot(new Vector3(...hole.normal)) >= .999 &&
    !(requiredThread && hole.threadDesignation && requiredThread !== hole.threadDesignation);
}
export function nearestCompatibleHole(scene: SceneDocument, placement: Placement): SupportFixingHole | undefined {
  const model = scene.models.find(m => m.id === placement.modelId), support = supportFor(scene, placement);
  if (!model || !support) return undefined;
  const own = getMountingHoles(model).find(hole => hole.role === 'primary');
  if (!own) return undefined;
  const point = mountedPoint(placement, own), normal = new Vector3(0, 0, 1).applyQuaternion(new Quaternion(...placement.rotation));
  let nearest: SupportFixingHole | undefined, nearestDistance = Infinity;
  for (const hole of getSupportFixings(support).holes) {
    if (!compatible(model, normal, hole)) continue;
    const distance = point.distanceToSquared(new Vector3(...hole.position));
    if (distance < nearestDistance) { nearestDistance = distance; nearest = hole; }
  }
  return nearest;
}
/** Human-readable errors also used by the authoritative API validation. */
export function validatePlacementMounting(scene: SceneDocument, placement: Placement): string[] {
  const model = scene.models.find(m => m.id === placement.modelId), support = supportFor(scene, placement);
  if (!model || !support) return [`Support ou modèle de fixation introuvable : ${placement.id}`];
  const fixings = getSupportFixings(support), holes = getMountingHoles(model), method = getMountingMethod(model);
  const errors: string[] = [];
  if (method === 'screw' && !fixings.allowScrews) return [`Le support n’autorise pas le vissage direct : ${placement.id}`];
  const normal = new Vector3(0, 0, 1).applyQuaternion(new Quaternion(...placement.rotation));
  const primary = holes.filter(h => h.role === 'primary');
  if (method === 'bolt' && !primary.length) errors.push(`Le modèle ne possède aucun trou principal de boulonnage : ${placement.id}`);
  const occupied = new Set<string>();
  for (const hole of holes) {
    const point = mountedPoint(placement, hole), position = point.toArray() as Vec3;
    if (method === 'bolt' && hole.role === 'primary') {
      const insert = fixings.holes.find(candidate => !occupied.has(candidate.id) && compatible(model, normal, candidate) &&
        point.distanceTo(new Vector3(...candidate.position)) <= MOUNTING_ALIGNMENT_EPSILON);
      if (!insert) errors.push(`Trou ${hole.id} non aligné avec un insert compatible du support : ${placement.id}`);
      else occupied.add(insert.id);
    } else {
      if (!fixings.allowScrews) { errors.push(`La fixation complémentaire ${hole.id} nécessite une zone de vissage autorisée : ${placement.id}`); continue; }
      const onSurface = 'width' in support ? isPointOnWall(support, position) : isPointOnModelSurface(support, position, placement.rotation);
      if (!onSurface) errors.push(`Trou de vis ${hole.id} hors de la surface autorisée du support : ${placement.id}`);
    }
  }
  return errors;
}
/** Preserve rotation; snapping translates the model's own bolt hole onto the receiving insert. */
export function snapPlacementToFixing(scene: SceneDocument, placement: Placement, maxDistance = .06): Placement | undefined {
  const model = scene.models.find(m => m.id === placement.modelId);
  if (!model) return undefined;
  if (getMountingMethod(model) === 'screw') return validatePlacementMounting(scene, placement).length ? undefined : structuredClone(placement);
  const own = getMountingHoles(model).find(hole => hole.role === 'primary'), nearest = nearestCompatibleHole(scene, placement);
  if (!own || !nearest) return undefined;
  const point = mountedPoint(placement, own), delta = new Vector3(...nearest.position).sub(point);
  if (delta.length() > maxDistance) return undefined;
  const next = structuredClone(placement);
  next.position = new Vector3(...next.position).add(delta).toArray() as Vec3;
  return validatePlacementMounting(scene, next).length ? undefined : next;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}
export function mountingFingerprint(scene: SceneDocument, placement: Placement): string {
  const model = scene.models.find(m => m.id === placement.modelId), support = supportFor(scene, placement);
  // Compare the immutable source parameters, rather than materialising hundreds of
  // insert points for every unchanged piece on each pointer move or save.
  const modelKey = model && [model.kind, model.shape, model.dimensions, model.mounting, model.fixing];
  const supportKey = support && ('width' in support
    ? [support.fixingSpacing, support.fixingGrid, support.fixing, support.supportFixings]
    : [support.kind, support.shape, support.dimensions, support.fixingGrid, support.fixing, support.supportFixings]);
  return JSON.stringify(canonical([placement, modelKey, supportKey]));
}
