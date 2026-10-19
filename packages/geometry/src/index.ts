import {
  sceneSchema, type ModelDefinition, type Placement, type Quat,
  type SceneDocument, type Vec3, type WallDefinition,
} from '@climbed/contracts';
import {
  BoxGeometry, BufferGeometry, Euler, ExtrudeGeometry, Float32BufferAttribute,
  Path, Quaternion, Shape, Triangle, Vector3,
} from 'three';

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

/** All model meshes have exact bounding dimensions, centered in XY, base at z=0. */
export function createModelGeometry(model: ModelDefinition): BufferGeometry {
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

export interface WorldPose { position: Vec3; rotation: Quat }

export function getWorldPose(scene: SceneDocument, placementId: string): WorldPose {
  const placements = new Map(scene.placements.map(p => [p.id, p]));
  const walls = new Map(scene.walls.map(w => [w.id, w]));
  const visited = new Set<string>();
  function resolve(id: string): WorldPose {
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
    return { position: tuple(position), rotation: quatTuple(rotation) };
  }
  return resolve(placementId);
}

/** Surface test independent of the rendering scene. Ignores the back mounting face. */
export function isPointOnModelSurface(model: ModelDefinition, point: Vec3, rotation: Quat): boolean {
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

export function validateScene(scene: SceneDocument): string[] {
  const parsed = sceneSchema.safeParse(scene);
  if (!parsed.success) return parsed.error.issues.map(issue => `${issue.path.join('.')} : ${issue.message}`);
  const errors: string[] = [];
  const allIds = new Set<string>();
  for (const item of [...scene.walls, ...scene.models, ...scene.placements, ...scene.boulders]) {
    if (allIds.has(item.id)) errors.push(`Identifiant dupliqué : ${item.id}`);
    allIds.add(item.id);
  }
  const walls = new Map(scene.walls.map(w => [w.id, w]));
  const models = new Map(scene.models.map(m => [m.id, m]));
  const placements = new Map(scene.placements.map(p => [p.id, p]));
  for (const wall of scene.walls) errors.push(...wallErrors(wall));
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
    try { getWorldPose(scene, placement.id); } catch (error) { errors.push((error as Error).message); }
  }
  for (const boulder of scene.boulders) {
    const ids = new Set(boulder.placementIds);
    if (ids.size !== boulder.placementIds.length) errors.push(`Prise dupliquée dans le bloc : ${boulder.id}`);
    for (const id of boulder.placementIds) {
      const placement = placements.get(id);
      if (!placement) errors.push(`Prise du bloc introuvable : ${id}`);
      else if (models.get(placement.modelId)?.kind !== 'hold') errors.push(`Le bloc référence un volume : ${id}`);
    }
    for (const id of [...boulder.startIds, ...boulder.finishIds]) {
      if (!ids.has(id)) errors.push(`Départ ou arrivée absent du bloc : ${id}`);
    }
    if (new Set(boulder.startIds).size !== boulder.startIds.length || new Set(boulder.finishIds).size !== boulder.finishIds.length) {
      errors.push(`Départ ou arrivée dupliqué : ${boulder.id}`);
    }
  }
  return [...new Set(errors)];
}
