import type { ModelDefinition, Placement, SceneDocument, SupportFixingHole, Vec3, WallDefinition } from '@climbed/contracts';
import { Quaternion, Vector3 } from 'three';
import { isPointOnModelSurface, isPointOnWall } from './index';
import { getMountingHoles, getMountingMethod, getSupportFixings, MOUNTING_ALIGNMENT_EPSILON, supportFor } from './mounting';

export function requiredPilotHoles(model: ModelDefinition) {
  if (model.mounting?.screwPlacement === 'direct') return [];
  return getMountingHoles(model).filter(h => getMountingMethod(model) === 'screw' || h.role === 'auxiliary');
}

export function canPrepareSupport(scene: SceneDocument, type: 'wall' | 'volume', id: string): boolean {
  const owner = type === 'wall' ? scene.walls.find(w => w.id === id) : scene.placements.find(p => p.id === id);
  const profile = type === 'wall' ? owner as WallDefinition | undefined : scene.models.find(m => m.id === (owner as Placement | undefined)?.modelId);
  if (!owner || !profile || (type === 'volume' && (profile as ModelDefinition).kind !== 'volume')) return false;
  const fixings = getSupportFixings(profile);
  return fixings.allowScrews && fixings.allowDrilling !== false && (owner.allowPilotDrilling === true || fixings.allowDrilling === true);
}

function sameHole(a: SupportFixingHole, b: SupportFixingHole) {
  return new Vector3(...a.position).distanceTo(new Vector3(...b.position)) <= MOUNTING_ALIGNMENT_EPSILON &&
    new Vector3(...a.normal).dot(new Vector3(...b.normal)) > .999;
}
function onSurface(support: WallDefinition | ModelDefinition, hole: SupportFixingHole): boolean {
  if ('width' in support) return hole.normal[2] > .999 && isPointOnWall(support, hole.position);
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(...hole.normal));
  return isPointOnModelSurface(support, hole.position, q.toArray() as Placement['rotation']);
}
function holeProblem(support: WallDefinition | ModelDefinition, hole: SupportFixingHole, existing: SupportFixingHole[]): string | undefined {
  if (!onSurface(support, hole)) return 'Le trou pilote serait hors de la surface du support.';
  if (existing.some(h => h.id === hole.id)) return 'Identifiant de trou pilote déjà utilisé sur ce support.';
  if (existing.some(h => new Vector3(...h.position).distanceTo(new Vector3(...hole.position)) < ((h.diameter ?? .012) + (hole.diameter ?? .005)) / 2 &&
    new Vector3(...h.normal).dot(new Vector3(...hole.normal)) > .999)) return 'Le trou pilote recouvrirait un trou ou un insert existant.';
  const orientation = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(...hole.normal));
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6, r = (hole.diameter ?? .005) / 2;
    const position = new Vector3(Math.cos(angle) * r, Math.sin(angle) * r, 0).applyQuaternion(orientation).add(new Vector3(...hole.position)).toArray() as Vec3;
    if (!onSurface(support, { ...hole, position })) return 'Le bord du trou pilote dépasserait la surface du support.';
  }
  return undefined;
}

/** Explicit planning operation: updates this support occurrence, never a stock model. */
export function prepareSupportForPlacement(source: SceneDocument, placement: Placement, options: { pilotDiameter?: number; createId?: () => string } = {}) {
  const model = source.models.find(m => m.id === placement.modelId), support = supportFor(source, placement);
  if (!model || !support) throw new Error('Support ou modèle introuvable pour préparer les trous pilotes.');
  const ownHoles = requiredPilotHoles(model);
  if (!ownHoles.length) throw new Error('Ce mode de fixation ne nécessite pas de préparation de trous pilotes.');
  const fixings = getSupportFixings(support), existing = [...fixings.holes], added: SupportFixingHole[] = [];
  const q = new Quaternion(...placement.rotation), normal = new Vector3(0, 0, 1).applyQuaternion(q).toArray() as Vec3;
  for (const own of ownHoles) {
    const hole = { id: (options.createId ?? (() => crypto.randomUUID()))(), kind: 'pilot' as const, position: new Vector3(...own.position).applyQuaternion(q).add(new Vector3(...placement.position)).toArray() as Vec3, normal, diameter: options.pilotDiameter };
    if (existing.some(h => h.kind === 'pilot' && sameHole(h, hole))) continue;
    if (!Number.isFinite(hole.diameter) || hole.diameter! < .001 || hole.diameter! > .05) throw new Error('Renseignez un diamètre pilote compris entre 1 et 50 mm.');
    if (!canPrepareSupport(source, placement.parentType, placement.parentId)) throw new Error('Le support n’autorise pas le préperçage. Renseignez son autorisation dans ses propriétés.');
    const problem = holeProblem(support, hole, existing);
    if (problem) throw new Error(problem);
    existing.push(hole); added.push(hole);
  }
  if (!added.length) return { scene: source, addedHoleCount: 0 };
  const scene = structuredClone(source);
  const owner = placement.parentType === 'wall' ? scene.walls.find(w => w.id === placement.parentId)! : scene.placements.find(p => p.id === placement.parentId)!;
  owner.preparedPilotHoles = [...(owner.preparedPilotHoles ?? []), ...added.map(h => ({ ...h, kind: 'pilot' as const, diameter: h.diameter! }))];
  if (owner.preparedPilotHoles.length > 200) throw new Error('Ce support atteint la limite de 200 trous pilotes préparés.');
  return { scene, addedHoleCount: added.length };
}

export function validatePreparedSupportGeometry(scene: SceneDocument): string[] {
  const errors: string[] = [];
  for (const owner of [...scene.walls, ...scene.placements]) {
    if (!owner.preparedPilotHoles?.length) continue;
    const support = 'width' in owner ? { ...owner, preparedPilotHoles: undefined } : scene.models.find(m => m.id === owner.modelId);
    if (!support || (!('width' in support) && support.kind !== 'volume')) { errors.push(`Seul un pan ou un volume peut recevoir des trous pilotes préparés : ${owner.id}`); continue; }
    const existing = [...getSupportFixings(support).holes];
    for (const hole of owner.preparedPilotHoles) {
      const problem = holeProblem(support, hole, existing);
      if (problem) errors.push(`${problem} : ${owner.id}`);
      existing.push(hole);
    }
  }
  return errors;
}

export function validatePreparedSupportChange(previous: SceneDocument, next: SceneDocument): string[] {
  const errors: string[] = [];
  for (const owner of [...next.walls, ...next.placements]) {
    const old = [...previous.walls, ...previous.placements].find(item => item.id === owner.id);
    const changed = owner.preparedPilotHoles?.some(h => !old?.preparedPilotHoles?.some(o => o.id === h.id && sameHole(o, h) && o.diameter === h.diameter));
    if (changed && !canPrepareSupport(next, 'width' in owner ? 'wall' : 'volume', owner.id)) errors.push(`Préperçage non autorisé sur ce support : ${owner.id}`);
  }
  return errors;
}
