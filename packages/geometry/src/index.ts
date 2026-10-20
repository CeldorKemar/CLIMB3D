import {
  sceneSchema, type ModelDefinition, type Placement, type Quat,
  type SceneDocument, type Vec3, type WallDefinition,
} from '@climbed/contracts';
import {
  BoxGeometry, BufferGeometry, Euler, ExtrudeGeometry, Float32BufferAttribute,
  Matrix4, Path, Quaternion, Shape, Triangle, Vector3,
} from 'three';
import { detectSolidContacts, type CollisionPair, type CollisionSolid } from './collisions';
import { getMountingHoles, getSupportFixings, mountingFingerprint, mountingObjectFingerprint, validatePlacementMounting } from './mounting';
import { perforateGeometry } from './perforation';
import { validateRoomLayout } from './layout';
export * from './mounting';
export * from './layout';
export { COLLISION_EPSILON, type CollisionPair } from './collisions';

/** Numerical tolerance in metres; this is not a mechanical clearance. */
export const SURFACE_EPSILON = 0.0001;
const DEG = Math.PI / 180;
const tuple = (v: Vector3): Vec3 => [v.x, v.y, v.z];
const quatTuple = (q: Quaternion): Quat => [q.x, q.y, q.z, q.w];

/** Positive inclination moves the top of a wall towards its front (+Z). */
export function quaternionFromWallAngles(inclinationDeg: number, yawDeg = 0): Quat {
  return quatTuple(new Quaternion().setFromEuler(new Euler(inclinationDeg * DEG, yawDeg * DEG, 0, 'YXZ')));
}

/** A wall tool uses yaw followed by local X inclination; arbitrary roll is not represented here. */
export function getWallAngles(rotation: Quat): { inclination: number; yaw: number } {
  const q = new Quaternion(...rotation);
  // The wall's local X axis is unaffected by inclination, including at a horizontal roof.
  const right = new Vector3(1, 0, 0).applyQuaternion(q);
  const yaw = Math.atan2(-right.z, right.x);
  const up = new Vector3(0, 1, 0).applyQuaternion(q)
    .applyQuaternion(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -yaw));
  return { inclination: Math.atan2(up.z, up.y) / DEG, yaw: yaw / DEG };
}

export interface WallChainOptions {
  origin: Vec3;
  width: number;
  thickness: number;
  yaw?: number;
  segments: { length: number; inclination: number }[];
  color: string;
  fixingSpacing: number;
  name?: string;
  idPrefix?: string;
  angleMode?: 'absolute' | 'relative';
}

/** Connect equal-width pans edge-to-edge. Length is measured along each pan, never its projection. */
export function createWallChain(options: WallChainOptions): WallDefinition[] {
  let base = new Vector3(...options.origin), angle = 0;
  return options.segments.map((segment, index) => {
    if (!Number.isFinite(segment.length) || segment.length <= 0 || !Number.isFinite(segment.inclination)) {
      throw new Error('Longueur ou inclinaison de pan invalide');
    }
    angle = options.angleMode === 'relative' ? angle + segment.inclination : segment.inclination;
    const rotation = quaternionFromWallAngles(angle, options.yaw ?? 0);
    const wall: WallDefinition = {
      id: `${options.idPrefix ?? 'chain'}-${index + 1}`, name: `${options.name ?? 'Pan'} ${index + 1}`,
      width: options.width, height: segment.length, thickness: options.thickness,
      position: tuple(base), rotation, color: options.color, fixingSpacing: options.fixingSpacing, openings: [],
    };
    base = new Vector3(0, segment.length, 0).applyQuaternion(new Quaternion(...rotation)).add(base);
    return wall;
  });
}

export function wallProjectedDimensions(wall: WallDefinition): { length: number; verticalHeight: number; horizontalDepth: number } {
  const delta = new Vector3(0, wall.height, 0).applyQuaternion(new Quaternion(...wall.rotation));
  return { length: wall.height, verticalHeight: Math.abs(delta.y), horizontalDepth: Math.hypot(delta.x, delta.z) };
}

function wallErrors(wall: WallDefinition): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const opening of wall.openings) {
    if (ids.has(opening.id)) errors.push(`Ouverture dupliquée : ${opening.id}`);
    ids.add(opening.id);
    const { x, y, width, height } = opening;
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
      errors.push(`Dimensions d’ouverture invalides : ${opening.id}`);
      continue;
    }
    if (x - width / 2 <= -wall.width / 2 + SURFACE_EPSILON ||
        x + width / 2 >= wall.width / 2 - SURFACE_EPSILON ||
        y - height / 2 <= SURFACE_EPSILON || y + height / 2 >= wall.height - SURFACE_EPSILON) {
      errors.push(`L’ouverture ${opening.id} touche ou dépasse le bord du pan ${wall.id}`);
    }
  }
  for (let i = 0; i < wall.openings.length; i++) {
    const a = wall.openings[i]!;
    for (let j = i + 1; j < wall.openings.length; j++) {
      const b = wall.openings[j]!;
      if (Math.abs(a.x - b.x) <= (a.width + b.width) / 2 + SURFACE_EPSILON &&
          Math.abs(a.y - b.y) <= (a.height + b.height) / 2 + SURFACE_EPSILON) {
        errors.push(`Ouvertures en contact ou superposées : ${a.id}, ${b.id}`);
      }
    }
  }
  return errors;
}

/** Local XY front face at z=0; the solid thickness extends behind it. */
export function createWallGeometry(wall: WallDefinition): BufferGeometry {
  if (![wall.width, wall.height, wall.thickness].every(n => Number.isFinite(n) && n > 0)) {
    throw new Error('Dimensions de pan invalides');
  }
  const errors = wallErrors(wall);
  if (errors.length) throw new Error(errors.join('; '));
  const shape = new Shape();
  shape.moveTo(-wall.width / 2, 0);
  shape.lineTo(wall.width / 2, 0);
  shape.lineTo(wall.width / 2, wall.height);
  shape.lineTo(-wall.width / 2, wall.height);
  shape.closePath();
  for (const o of wall.openings) {
    const hole = new Path();
    hole.moveTo(o.x - o.width / 2, o.y - o.height / 2);
    hole.lineTo(o.x - o.width / 2, o.y + o.height / 2);
    hole.lineTo(o.x + o.width / 2, o.y + o.height / 2);
    hole.lineTo(o.x + o.width / 2, o.y - o.height / 2);
    hole.closePath();
    shape.holes.push(hole);
  }
  return new ExtrudeGeometry(shape, { depth: wall.thickness, bevelEnabled: false, steps: 1 })
    .translate(0, 0, -wall.thickness);
}

export function isPointOnWall(wall: WallDefinition, point: Vec3): boolean {
  const [x, y, z] = point;
  return point.every(Number.isFinite) && Math.abs(z) <= SURFACE_EPSILON &&
    x >= -wall.width / 2 - SURFACE_EPSILON && x <= wall.width / 2 + SURFACE_EPSILON &&
    y >= -SURFACE_EPSILON && y <= wall.height + SURFACE_EPSILON &&
    !wall.openings.some(o => Math.abs(x - o.x) <= o.width / 2 + SURFACE_EPSILON &&
      Math.abs(y - o.y) <= o.height / 2 + SURFACE_EPSILON);
}

class SolidBuilder {
  private positions: number[] = [];
  private normals: number[] = [];
  triangle(a: Vector3, b: Vector3, c: Vector3, normals?: [Vector3, Vector3, Vector3]): void {
    if (new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).lengthSq() < 1e-20) return;
    const normal = new Triangle(a, b, c).getNormal(new Vector3());
    [a, b, c].forEach((v, i) => {
      this.positions.push(v.x, v.y, v.z);
      const n = normals?.[i] ?? normal;
      this.normals.push(n.x, n.y, n.z);
    });
  }
  quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3): void {
    this.triangle(a, b, c); this.triangle(a, c, d);
  }
  finish(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(this.normals, 3));
    return geometry;
  }
}

function polyhedron(vertices: Vec3[], faces: number[][]): BufferGeometry {
  const builder = new SolidBuilder();
  const points = vertices.map(p => new Vector3(...p));
  for (const face of faces) {
    for (let i = 1; i < face.length - 1; i++) {
      builder.triangle(points[face[0]!]!, points[face[i]!]!, points[face[i + 1]!]!);
    }
  }
  return builder.finish();
}

/** A closed elliptical surface of revolution, with an optional real concave interior. */
function roundSolid(width: number, height: number, depth: number, concave: boolean): BufferGeometry {
  const builder = new SolidBuilder();
  const segments = 40;
  const rings = 16;
  const xRadius = width / 2, yRadius = height / 2;
  const point = (r: number, phi: number, z: number) => new Vector3(xRadius * r * Math.cos(phi), yRadius * r * Math.sin(phi), z);
  const origin = new Vector3(0, 0, 0);
  const down = new Vector3(0, 0, -1);
  const up = new Vector3(0, 0, 1);
  if (concave) {
    // Inner paraboloid reaches the lip at radius .86, while the underside stays at z=0.
    const radius = 0.86, bottom = depth * 0.16, k = (depth - bottom) / (radius * radius);
    const inner = (r: number, phi: number) => point(r, phi, bottom + k * r * r);
    const innerNormal = (r: number, phi: number) => new Vector3(-2 * k * r * Math.cos(phi) / xRadius, -2 * k * r * Math.sin(phi) / yRadius, 1).normalize();
    for (let i = 0; i < rings; i++) {
      const r0 = radius * i / rings, r1 = radius * (i + 1) / rings;
      for (let j = 0; j < segments; j++) {
        const p0 = j * Math.PI * 2 / segments, p1 = (j + 1) * Math.PI * 2 / segments;
        const a = inner(r0, p0), b = inner(r1, p0), c = inner(r1, p1), d = inner(r0, p1);
        builder.triangle(a, b, c, [innerNormal(r0, p0), innerNormal(r1, p0), innerNormal(r1, p1)]);
        builder.triangle(a, c, d, [innerNormal(r0, p0), innerNormal(r1, p1), innerNormal(r0, p1)]);
      }
    }
    for (let j = 0; j < segments; j++) {
      const p0 = j * Math.PI * 2 / segments, p1 = (j + 1) * Math.PI * 2 / segments;
      const a = point(radius, p0, depth), b = point(1, p0, depth), c = point(1, p1, depth), d = point(radius, p1, depth);
      builder.triangle(a, b, c, [up, up, up]); builder.triangle(a, c, d, [up, up, up]);
      const n0 = new Vector3(Math.cos(p0) / xRadius, Math.sin(p0) / yRadius, 0).normalize();
      const n1 = new Vector3(Math.cos(p1) / xRadius, Math.sin(p1) / yRadius, 0).normalize();
      const e = point(1, p0, 0), f = point(1, p1, 0);
      builder.triangle(e, f, c, [n0, n1, n1]); builder.triangle(e, c, b, [n0, n1, n0]);
    }
  } else {
    // Hemisphere rather than a sphere intersecting a fictitious wall.
    const surface = (theta: number, phi: number) => point(Math.sin(theta), phi, depth * Math.cos(theta));
    const normal = (theta: number, phi: number) => new Vector3(Math.sin(theta) * Math.cos(phi) / xRadius, Math.sin(theta) * Math.sin(phi) / yRadius, Math.cos(theta) / depth).normalize();
    for (let i = 0; i < rings; i++) {
      const t0 = i / rings * Math.PI / 2, t1 = (i + 1) / rings * Math.PI / 2;
      for (let j = 0; j < segments; j++) {
        const p0 = j * Math.PI * 2 / segments, p1 = (j + 1) * Math.PI * 2 / segments;
        const a = surface(t0, p0), b = surface(t1, p0), c = surface(t1, p1), d = surface(t0, p1);
        builder.triangle(a, b, c, [normal(t0, p0), normal(t1, p0), normal(t1, p1)]);
        builder.triangle(a, c, d, [normal(t0, p0), normal(t1, p1), normal(t0, p1)]);
      }
    }
  }
  for (let j = 0; j < segments; j++) {
    const p0 = j * Math.PI * 2 / segments, p1 = (j + 1) * Math.PI * 2 / segments;
    builder.triangle(origin, point(1, p1, 0), point(1, p0, 0), [down, down, down]);
  }
  return builder.finish();
}

/** Base solids have exact bounding dimensions, centered in XY, mounting face at z=0. */
function createUnperforatedModelGeometry(model: ModelDefinition): BufferGeometry {
  const [width, height, depth] = model.dimensions;
  if (!model.dimensions.every(n => Number.isFinite(n) && n > 0)) throw new Error('Dimensions de modèle invalides');
  const x = width / 2, y = height / 2;
  switch (model.shape) {
    case 'box': return new BoxGeometry(width, height, depth).translate(0, 0, depth / 2);
    case 'dome': return roundSolid(width, height, depth, false);
    case 'scoop': case 'jug': return roundSolid(width, height, depth, true);
    case 'pyramid': return polyhedron(
      [[-x, -y, 0], [x, -y, 0], [x, y, 0], [-x, y, 0], [0, 0, depth]],
      [[0, 3, 2, 1], [0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]],
    );
    case 'prism': return polyhedron(
      [[-x, -y, 0], [x, -y, 0], [0, -y, depth], [-x, y, 0], [x, y, 0], [0, y, depth]],
      [[0, 1, 2], [3, 5, 4], [0, 3, 4, 1], [1, 4, 5, 2], [0, 2, 5, 3]],
    );
    case 'crimp': return polyhedron(
      [[-x, -y, 0], [x, -y, 0], [x, y, 0], [-x, y, 0], [-x, -y, depth * .4], [x, -y, depth * .4], [x, y, depth], [-x, y, depth]],
      [[0, 3, 2, 1], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 6, 7]],
    );
    case 'pinch': {
      const shape = new Shape();
      const points: [number, number][] = [[-x * .65, -y], [x * .65, -y], [x, -y * .6], [x, y * .6], [x * .65, y], [-x * .65, y], [-x, y * .6], [-x, -y * .6]];
      shape.moveTo(...points[0]!); for (const p of points.slice(1)) shape.lineTo(...p);
      shape.closePath();
      return new ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 });
    }
  }
}

/** Example holes are real through-tunnels, including the model's mounting bores and receiving inserts. */
const modelGeometryTemplates = new Map<string, BufferGeometry>();
export function createModelGeometry(model: ModelDefinition): BufferGeometry {
  const bores = [
    ...getMountingHoles(model).map(hole => ({ position: hole.position, normal: [0, 0, 1] as Vec3, diameter: hole.diameter })),
    ...getSupportFixings(model).holes.map(hole => ({ position: hole.position, normal: hole.normal, diameter: hole.diameter ?? Math.min(.012, ...model.dimensions.map(d => d * .18)) })),
  ];
  const uniqueBores = [...new Map(bores.map(bore => {
    const normal = new Vector3(...bore.normal).normalize();
    if (normal.z < 0 || (normal.z === 0 && (normal.y < 0 || (normal.y === 0 && normal.x < 0)))) normal.negate();
    const origin = new Vector3(...bore.position).addScaledVector(normal, -new Vector3(...bore.position).dot(normal));
    return [JSON.stringify([...origin.toArray(), ...normal.toArray(), bore.diameter].map(n => Math.round(n * 1e9))), bore];
  })).values()];
  const key = JSON.stringify([model.shape, model.dimensions, uniqueBores]);
  const existing = modelGeometryTemplates.get(key);
  if (existing) return existing.clone();
  const geometry = perforateGeometry(createUnperforatedModelGeometry(model), uniqueBores);
  if (modelGeometryTemplates.size >= 40) {
    const oldest = modelGeometryTemplates.keys().next().value!;
    modelGeometryTemplates.get(oldest)!.dispose(); modelGeometryTemplates.delete(oldest);
  }
  modelGeometryTemplates.set(key, geometry);
  return geometry.clone();
}

function modelMountingErrors(model: ModelDefinition): string[] {
  const errors: string[] = [];
  const [width, height] = model.dimensions;
  const holes = getMountingHoles(model), ids = new Set<string>();
  const isBaseMaterial = (x: number, y: number) => {
    if (Math.abs(x) >= width / 2 - SURFACE_EPSILON || Math.abs(y) >= height / 2 - SURFACE_EPSILON) return false;
    if (['dome', 'jug', 'scoop'].includes(model.shape)) return (x / (width / 2)) ** 2 + (y / (height / 2)) ** 2 < 1 - SURFACE_EPSILON;
    if (model.shape === 'pinch') {
      const dx = Math.max(0, Math.abs(x) / (width / 2) - .65) / .35;
      const dy = Math.max(0, Math.abs(y) / (height / 2) - .6) / .4;
      return dx + dy < 1 - SURFACE_EPSILON;
    }
    return true;
  };
  for (const hole of holes) {
    if (ids.has(hole.id)) errors.push(`Identifiant de trou de fixation dupliqué : ${model.id}, ${hole.id}`);
    ids.add(hole.id);
    for (let i = 0; i < 16; i++) {
      const angle = i * Math.PI * 2 / 16;
      if (!isBaseMaterial(hole.position[0] + Math.cos(angle) * hole.diameter / 2,
        hole.position[1] + Math.sin(angle) * hole.diameter / 2)) {
        errors.push(`Le trou de fixation ${hole.id} sort de la matière du modèle ${model.id}`); break;
      }
    }
  }
  if (model.mounting?.method === 'bolt' && !holes.some(h => h.role === 'primary')) {
    errors.push(`Aucun trou principal de boulonnage sur le modèle ${model.id}`);
  }
  const supportIds = new Set<string>();
  if (model.supportFixings?.holes.length) {
    const geometry = createUnperforatedModelGeometry(model), attr = geometry.getAttribute('position'), index = geometry.getIndex();
    const triangle = new Triangle(), a = new Vector3(), b = new Vector3(), c = new Vector3(), nearest = new Vector3(), normal = new Vector3();
    try {
      for (const hole of model.supportFixings.holes) {
        if (supportIds.has(hole.id)) errors.push(`Identifiant d’insert dupliqué : ${model.id}, ${hole.id}`);
        supportIds.add(hole.id);
        const target = new Vector3(...hole.position), targetNormal = new Vector3(...hole.normal);
        let found = false;
        for (let i = 0; i < (index?.count ?? attr.count); i += 3) {
          a.fromBufferAttribute(attr, index ? index.getX(i) : i);
          b.fromBufferAttribute(attr, index ? index.getX(i + 1) : i + 1);
          c.fromBufferAttribute(attr, index ? index.getX(i + 2) : i + 2);
          triangle.set(a, b, c).getNormal(normal);
          if (normal.dot(targetNormal) < .8 || (normal.z < -.99 && Math.max(a.z, b.z, c.z) < SURFACE_EPSILON)) continue;
          triangle.closestPointToPoint(target, nearest);
          if (nearest.distanceToSquared(target) <= SURFACE_EPSILON ** 2) { found = true; break; }
        }
        if (!found) errors.push(`L’insert ${hole.id} ne correspond pas à une face du modèle ${model.id}`);
      }
    } finally { geometry.dispose(); }
  }
  return errors;
}

export interface WorldPose { position: Vec3; rotation: Quat }

export function getWorldPose(scene: SceneDocument, placementId: string): WorldPose {
  return createPoseResolver(scene)(placementId);
}

/** Per-operation maps and memoization, never stale across mutable editor documents. */
function createPoseResolver(scene: SceneDocument): (id: string) => WorldPose {
  const placements = new Map(scene.placements.map(p => [p.id, p]));
  const walls = new Map(scene.walls.map(w => [w.id, w]));
  const visited = new Set<string>();
  const poses = new Map<string, WorldPose>();
  function resolve(id: string): WorldPose {
    const cached = poses.get(id);
    if (cached) return cached;
    if (visited.has(id)) throw new Error(`Cycle de supports : ${id}`);
    const placement = placements.get(id);
    if (!placement) throw new Error(`Placement introuvable : ${id}`);
    visited.add(id);
    let parent: WorldPose;
    if (placement.parentType === 'wall') {
      const wall = walls.get(placement.parentId);
      if (!wall) throw new Error(`Pan introuvable : ${placement.parentId}`);
      parent = wall;
    } else parent = resolve(placement.parentId);
    const q = new Quaternion(...parent.rotation);
    const position = new Vector3(...placement.position).applyQuaternion(q).add(new Vector3(...parent.position));
    const rotation = q.multiply(new Quaternion(...placement.rotation));
    visited.delete(id);
    const pose = { position: tuple(position), rotation: quatTuple(rotation) };
    poses.set(id, pose);
    return pose;
  }
  return resolve;
}

/** Surface test independent of the rendering scene. Ignores the back mounting face. */
export function isPointOnModelSurface(model: ModelDefinition, point: Vec3, rotation: Quat): boolean {
  // A receiving insert is an admissible anchor even though its centre is an actual tunnel.
  const targetNormal = new Vector3(0, 0, 1).applyQuaternion(new Quaternion(...rotation));
  if (getSupportFixings(model).holes.some(hole => new Vector3(...hole.position).distanceTo(new Vector3(...point)) <= SURFACE_EPSILON &&
    targetNormal.dot(new Vector3(...hole.normal)) > .999)) return true;
  const geometry = createModelGeometry(model);
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const count = index?.count ?? position.count;
  const target = new Vector3(...point);
  const mountNormal = new Vector3(0, 0, 1).applyQuaternion(new Quaternion(...rotation));
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), nearest = new Vector3(), normal = new Vector3();
  const triangle = new Triangle();
  try {
    for (let i = 0; i < count; i += 3) {
      a.fromBufferAttribute(position, index ? index.getX(i) : i);
      b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1);
      c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2);
      triangle.set(a, b, c).getNormal(normal);
      if (normal.z < -.99 && Math.max(a.z, b.z, c.z) < SURFACE_EPSILON) continue;
      if (normal.dot(mountNormal) < .8) continue;
      triangle.closestPointToPoint(target, nearest);
      if (nearest.distanceToSquared(target) <= SURFACE_EPSILON ** 2) return true;
    }
    return false;
  } finally { geometry.dispose(); }
}

export function validateScene(scene: SceneDocument, options: { collisions?: boolean; mounting?: boolean } = {}): string[] {
  const parsed = sceneSchema.safeParse(scene);
  if (!parsed.success) return parsed.error.issues.map(issue => `${issue.path.join('.')} : ${issue.message}`);
  const errors: string[] = [...validateRoomLayout(scene)];
  const allIds = new Set<string>();
  for (const item of [...scene.walls, ...scene.models, ...scene.placements, ...scene.boulders]) {
    if (allIds.has(item.id)) errors.push(`Identifiant dupliqué : ${item.id}`);
    allIds.add(item.id);
  }
  const walls = new Map(scene.walls.map(w => [w.id, w]));
  const models = new Map(scene.models.map(m => [m.id, m]));
  const placements = new Map(scene.placements.map(p => [p.id, p]));
  const resolvePose = createPoseResolver(scene);
  for (const wall of scene.walls) errors.push(...wallErrors(wall));
  for (const model of scene.models) errors.push(...modelMountingErrors(model));
  for (const placement of scene.placements) {
    const model = models.get(placement.modelId);
    if (!model) { errors.push(`Modèle introuvable : ${placement.modelId}`); continue; }
    if (model.version !== placement.modelVersion) errors.push(`Version de modèle introuvable : ${placement.id}`);
    if (placement.parentType === 'wall') {
      const wall = walls.get(placement.parentId);
      if (!wall) errors.push(`Pan introuvable : ${placement.parentId}`);
      else {
        if (!isPointOnWall(wall, placement.position)) errors.push(`Ancrage hors du pan ou dans une ouverture : ${placement.id}`);
        const normal = new Vector3(0, 0, 1).applyQuaternion(new Quaternion(...placement.rotation));
        if (normal.z < .999) errors.push(`Orientation incompatible avec la face du pan : ${placement.id}`);
      }
    } else {
      const parent = placements.get(placement.parentId);
      const parentModel = parent && models.get(parent.modelId);
      if (!parent || !parentModel) errors.push(`Support introuvable : ${placement.parentId}`);
      else {
        if (parentModel.kind !== 'volume' || model.kind !== 'hold' || parent.parentType !== 'wall') {
          errors.push(`Relation de support interdite en V1 : ${placement.id}`);
        } else if (!isPointOnModelSurface(parentModel, placement.position, placement.rotation)) {
          errors.push(`Ancrage hors de la surface du volume : ${placement.id}`);
        }
      }
    }
    try { resolvePose(placement.id); } catch (error) { errors.push((error as Error).message); }
  }
  if (options.mounting) for (const placement of scene.placements) errors.push(...validatePlacementMounting(scene, placement));
  for (const boulder of scene.boulders) {
    const ids = new Set(boulder.placementIds);
    if (ids.size !== boulder.placementIds.length) errors.push(`Prise dupliquée dans le bloc : ${boulder.id}`);
    for (const id of boulder.placementIds) {
      const placement = placements.get(id);
      if (!placement) errors.push(`Prise du bloc introuvable : ${id}`);
    }
    for (const id of [...boulder.startIds, ...boulder.finishIds]) {
      if (!ids.has(id)) errors.push(`Départ ou arrivée absent du bloc : ${id}`);
      const placement = placements.get(id);
      if (placement && models.get(placement.modelId)?.kind !== 'hold') errors.push(`Départ ou arrivée doit être une prise : ${id}`);
    }
    if (new Set(boulder.startIds).size !== boulder.startIds.length || new Set(boulder.finishIds).size !== boulder.finishIds.length) {
      errors.push(`Départ ou arrivée dupliqué : ${boulder.id}`);
    }
  }
  if (!errors.length && options.collisions !== false) {
    errors.push(...footprintErrors(scene));
    errors.push(...findSceneCollisions(scene).map(pair => `Collision entre ${pair.firstId} et ${pair.secondId}`));
  }
  return [...new Set(errors)];
}

function poseMatrix(pose: WorldPose): Matrix4 {
  return new Matrix4().compose(new Vector3(...pose.position), new Quaternion(...pose.rotation), new Vector3(1, 1, 1));
}

/** Contacts of pieces in world coordinates, including pieces on different pans and non-supporting walls. */
export function findSceneCollisions(scene: SceneDocument): CollisionPair[] {
  const models = new Map(scene.models.map(model => [model.id, model]));
  const geometryByModel = new Map<string, BufferGeometry>();
  const wallIds = new Set(scene.walls.map(wall => wall.id));
  const solids: CollisionSolid[] = [];
  const resolvePose = createPoseResolver(scene);
  try {
    for (const wall of scene.walls) {
      solids.push({ id: wall.id, geometry: createWallGeometry(wall), matrix: poseMatrix(wall), exemptIds: wallIds });
    }
    for (const placement of scene.placements) {
      const model = models.get(placement.modelId);
      if (!model) continue;
      let geometry = geometryByModel.get(model.id);
      if (!geometry) { geometry = createModelGeometry(model); geometryByModel.set(model.id, geometry); }
      solids.push({ id: placement.id, geometry, matrix: poseMatrix(resolvePose(placement.id)), exemptIds: new Set([placement.parentId]) });
    }
    return detectSolidContacts(solids);
  } finally {
    for (const geometry of new Set(solids.map(solid => solid.geometry))) geometry.dispose();
  }
}

type Point2 = { x: number; y: number };
const cross2 = (a: Point2, b: Point2, c: Point2) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
function convexHull(points: Point2[]): Point2[] {
  const sorted = [...new Map(points.map(p => [`${p.x.toFixed(9)},${p.y.toFixed(9)}`, p])).values()]
    .sort((a, b) => a.x - b.x || a.y - b.y);
  const lower: Point2[] = [], upper: Point2[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross2(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0) lower.pop();
    lower.push(point);
  }
  for (const point of [...sorted].reverse()) {
    while (upper.length >= 2 && cross2(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0) upper.pop();
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
function polygonsOverlap(a: Point2[], b: Point2[]): boolean {
  for (const polygon of [a, b]) for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i]!, q = polygon[(i + 1) % polygon.length]!;
    const axis = { x: -(q.y - p.y), y: q.x - p.x };
    const length = Math.hypot(axis.x, axis.y);
    const project = (v: Point2) => (v.x * axis.x + v.y * axis.y) / length;
    const ap = a.map(project), bp = b.map(project);
    if (Math.max(...ap) < Math.min(...bp) - SURFACE_EPSILON || Math.max(...bp) < Math.min(...ap) - SURFACE_EPSILON) return false;
  }
  return true;
}

// Cache only immutable local contours, not placements, meshes or caller-owned model objects.
// The bound prevents an editing session with many dimension changes from retaining every version.
const localFootprints = new Map<string, readonly Point2[]>();
function localMountingFootprint(model: ModelDefinition): readonly Point2[] {
  const key = JSON.stringify([model.shape, model.dimensions]);
  const cached = localFootprints.get(key);
  if (cached) return cached;
  const geometry = createModelGeometry(model);
  let hull: Point2[];
  try {
    const attr = geometry.getAttribute('position');
    const points: Point2[] = [];
    for (let i = 0; i < attr.count; i++) {
      if (Math.abs(attr.getZ(i)) <= SURFACE_EPSILON) points.push({ x: attr.getX(i), y: attr.getY(i) });
    }
    hull = convexHull(points);
  } finally { geometry.dispose(); }
  if (localFootprints.size >= 300) localFootprints.delete(localFootprints.keys().next().value!);
  localFootprints.set(key, hull);
  return hull;
}

/** Tests the actual convex mounting footprint, rather than a bounding rectangle or sphere. */
export function isMountingFootprintOnWall(wall: WallDefinition, model: ModelDefinition, placement: Pick<Placement, 'position' | 'rotation'>): boolean {
    const q = new Quaternion(...placement.rotation);
    // A rigid transform preserves the contour order; no hull rebuild is needed per occurrence.
    const hull = localMountingFootprint(model).map(point => {
      const v = new Vector3(point.x, point.y, 0).applyQuaternion(q);
      return { x: v.x + placement.position[0], y: v.y + placement.position[1] };
    });
    if (hull.length < 3 || hull.some(p => p.x < -wall.width / 2 - SURFACE_EPSILON || p.x > wall.width / 2 + SURFACE_EPSILON || p.y < -SURFACE_EPSILON || p.y > wall.height + SURFACE_EPSILON)) return false;
    for (const o of wall.openings) {
      const rectangle = [
        { x: o.x - o.width / 2, y: o.y - o.height / 2 }, { x: o.x + o.width / 2, y: o.y - o.height / 2 },
        { x: o.x + o.width / 2, y: o.y + o.height / 2 }, { x: o.x - o.width / 2, y: o.y + o.height / 2 },
      ];
      if (polygonsOverlap(hull, rectangle)) return false;
    }
    return true;
}

function footprintErrors(scene: SceneDocument): string[] {
  const errors: string[] = [];
  const walls = new Map(scene.walls.map(wall => [wall.id, wall]));
  const models = new Map(scene.models.map(model => [model.id, model]));
  for (const placement of scene.placements) {
    if (placement.parentType !== 'wall') continue;
    const wall = walls.get(placement.parentId), model = models.get(placement.modelId);
    if (wall && model && !isMountingFootprintOnWall(wall, model, placement)) errors.push(`Empreinte hors du pan ou sur une ouverture : ${placement.id}`);
  }
  return errors;
}

function solidFingerprint(scene: SceneDocument, id: string): string {
  const wall = scene.walls.find(w => w.id === id);
  if (wall) return JSON.stringify([wall.width, wall.height, wall.thickness, wall.openings, wall.position, wall.rotation]);
  const placement = scene.placements.find(p => p.id === id);
  const model = placement && scene.models.find(m => m.id === placement.modelId);
  return JSON.stringify([model?.shape, model?.dimensions, placement && getWorldPose(scene, id)]);
}

/** Legacy contacts may survive unchanged. A changed colliding object must resolve its contact. */
export function validateSceneChange(previous: SceneDocument, next: SceneDocument): string[] {
  const errors = validateScene(next, { collisions: false });
  if (errors.length) return errors;
  const key = (pair: CollisionPair) => JSON.stringify([pair.firstId, pair.secondId]);
  const oldPlacements = new Map(previous.placements.map(p => [p.id, p]));
  for (const placement of next.placements) {
    const previousPlacement = oldPlacements.get(placement.id);
    if (!previousPlacement || mountingFingerprint(previous, previousPlacement) !== mountingFingerprint(next, placement)) {
      const nextErrors = validatePlacementMounting(next, placement);
      // Support repairs may retain an unchanged legacy defect, but never invalidate
      // a previously valid fixing or excuse a moved object/model.
      const oldErrors = previousPlacement && mountingObjectFingerprint(previous, previousPlacement) === mountingObjectFingerprint(next, placement)
        ? new Set(validatePlacementMounting(previous, previousPlacement)) : new Set<string>();
      errors.push(...nextErrors.filter(error => !oldErrors.has(error)));
    }
  }
  const oldPairs = new Set(findSceneCollisions(previous).map(key));
  for (const pair of findSceneCollisions(next)) {
    if (!oldPairs.has(key(pair)) || solidFingerprint(previous, pair.firstId) !== solidFingerprint(next, pair.firstId) ||
        solidFingerprint(previous, pair.secondId) !== solidFingerprint(next, pair.secondId)) {
      errors.push(`Collision entre ${pair.firstId} et ${pair.secondId}`);
    }
  }
  const oldFootprints = new Set(footprintErrors(previous));
  for (const error of footprintErrors(next)) {
    const id = error.slice(error.lastIndexOf(' : ') + 3);
    const p = next.placements.find(placement => placement.id === id);
    if (!oldFootprints.has(error) || solidFingerprint(previous, id) !== solidFingerprint(next, id) ||
        (p && solidFingerprint(previous, p.parentId) !== solidFingerprint(next, p.parentId))) errors.push(error);
  }
  return errors;
}
