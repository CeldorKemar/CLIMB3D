import { Box3, BufferGeometry, Matrix4, Triangle, Vector3 } from 'three';

export interface CollisionPair { firstId: string; secondId: string }
export interface CollisionSolid { id: string; geometry: BufferGeometry; matrix: Matrix4; exemptIds: Set<string> }
interface Facet { triangle: Triangle; bounds: Box3 }
interface Node { bounds: Box3; left?: Node; right?: Node; facets?: Facet[] }
interface Body { source: CollisionSolid; facets: Facet[]; bounds: Box3; tree?: Node }
/** Contact of neighbouring pieces is forbidden, including gaps below this numerical threshold. */
export const COLLISION_EPSILON = 0.0001;

function facetsOf(solid: CollisionSolid): Facet[] {
  const pos = solid.geometry.getAttribute('position'), index = solid.geometry.getIndex();
  const result: Facet[] = [];
  for (let i = 0; i < (index?.count ?? pos.count); i += 3) {
    const vertices = [0, 1, 2].map(offset => new Vector3().fromBufferAttribute(pos, index ? index.getX(i + offset) : i + offset).applyMatrix4(solid.matrix));
    const triangle = new Triangle(vertices[0]!, vertices[1]!, vertices[2]!);
    result.push({ triangle, bounds: new Box3().setFromPoints(vertices) });
  }
  return result;
}

function tree(facets: Facet[]): Node {
  const bounds = new Box3(); for (const facet of facets) bounds.union(facet.bounds);
  if (facets.length <= 8) return { bounds, facets };
  const size = bounds.getSize(new Vector3());
  const axis = size.x >= size.y && size.x >= size.z ? 'x' : size.y >= size.z ? 'y' : 'z';
  const sorted = [...facets].sort((a, b) => a.bounds.min[axis] + a.bounds.max[axis] - b.bounds.min[axis] - b.bounds.max[axis]);
  const middle = Math.floor(sorted.length / 2);
  return { bounds, left: tree(sorted.slice(0, middle)), right: tree(sorted.slice(middle)) };
}

function closeBounds(a: Box3, b: Box3): boolean {
  const e = COLLISION_EPSILON;
  return a.min.x <= b.max.x + e && a.max.x + e >= b.min.x &&
    a.min.y <= b.max.y + e && a.max.y + e >= b.min.y &&
    a.min.z <= b.max.z + e && a.max.z + e >= b.min.z;
}

const scratch = new Vector3();
function segmentDistanceSquared(a: Vector3, b: Vector3, c: Vector3, d: Vector3): number {
  // Closest points between finite segments; handles parallel and zero-length edges.
  const u = new Vector3().subVectors(b, a), v = new Vector3().subVectors(d, c), w = new Vector3().subVectors(a, c);
  const aa = u.dot(u), bb = u.dot(v), cc = v.dot(v), dd = u.dot(w), ee = v.dot(w);
  const denom = aa * cc - bb * bb;
  let s = denom > 1e-24 ? Math.max(0, Math.min(1, (bb * ee - cc * dd) / denom)) : 0;
  let t = cc > 1e-24 ? (bb * s + ee) / cc : 0;
  if (t < 0) { t = 0; s = aa > 1e-24 ? Math.max(0, Math.min(1, -dd / aa)) : 0; }
  else if (t > 1) { t = 1; s = aa > 1e-24 ? Math.max(0, Math.min(1, (bb - dd) / aa)) : 0; }
  return w.addScaledVector(u, s).addScaledVector(v, -t).lengthSq();
}

function segmentPierces(a: Vector3, b: Vector3, triangle: Triangle): boolean {
  const normal = triangle.getNormal(new Vector3());
  const da = normal.dot(new Vector3().subVectors(a, triangle.a));
  const db = normal.dot(new Vector3().subVectors(b, triangle.a));
  if (da * db > 0 || Math.abs(da - db) < 1e-14) return false;
  const point = a.clone().lerp(b, da / (da - db));
  return triangle.containsPoint(point);
}

function touching(a: Triangle, b: Triangle): boolean {
  const eps2 = COLLISION_EPSILON ** 2;
  const av = [a.a, a.b, a.c], bv = [b.a, b.b, b.c];
  for (const point of av) if (b.closestPointToPoint(point, scratch).distanceToSquared(point) <= eps2) return true;
  for (const point of bv) if (a.closestPointToPoint(point, scratch).distanceToSquared(point) <= eps2) return true;
  for (let i = 0; i < 3; i++) {
    const start = av[i]!, end = av[(i + 1) % 3]!;
    if (segmentPierces(start, end, b) || segmentPierces(bv[i]!, bv[(i + 1) % 3]!, a)) return true;
    for (let j = 0; j < 3; j++) {
      if (segmentDistanceSquared(start, end, bv[j]!, bv[(j + 1) % 3]!) <= eps2) return true;
    }
  }
  return false;
}

function surfacesTouch(a: Node, b: Node): boolean {
  if (!closeBounds(a.bounds, b.bounds)) return false;
  if (a.facets && b.facets) {
    for (const x of a.facets) for (const y of b.facets) {
      if (closeBounds(x.bounds, y.bounds) && touching(x.triangle, y.triangle)) return true;
    }
    return false;
  }
  if (a.left && a.right) return surfacesTouch(a.left, b) || surfacesTouch(a.right, b);
  return Boolean(b.left && b.right && (surfacesTouch(a, b.left) || surfacesTouch(a, b.right)));
}

function inside(point: Vector3, facets: Facet[]): boolean {
  // Oriented solid angle works for closed concave meshes and cavities, without ray-edge ambiguity.
  let angle = 0;
  for (const { triangle } of facets) {
    const a = triangle.a.clone().sub(point), b = triangle.b.clone().sub(point), c = triangle.c.clone().sub(point);
    const la = a.length(), lb = b.length(), lc = c.length();
    const numerator = a.dot(new Vector3().crossVectors(b, c));
    const denominator = la * lb * lc + a.dot(b) * lc + b.dot(c) * la + c.dot(a) * lb;
    angle += 2 * Math.atan2(numerator, denominator);
  }
  return Math.abs(angle) > Math.PI * 2;
}

export function detectSolidContacts(solids: CollisionSolid[]): CollisionPair[] {
  const bodies: Body[] = solids.map(source => {
    // A shared model mesh is immutable during this operation. Computing its bounds for
    // every occurrence otherwise scans the same thousands of vertices hundreds of times.
    if (!source.geometry.boundingBox) source.geometry.computeBoundingBox();
    return { source, bounds: source.geometry.boundingBox!.clone().applyMatrix4(source.matrix), facets: [] };
  }).sort((a, b) => a.bounds.min.x - b.bounds.min.x);
  const prepare = (body: Body) => {
    if (!body.tree) { body.facets = facetsOf(body.source); body.tree = tree(body.facets); }
  };
  const collisions: CollisionPair[] = [];
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i]!;
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j]!;
      if (b.bounds.min.x > a.bounds.max.x + COLLISION_EPSILON) break;
      if (a.source.exemptIds.has(b.source.id) || b.source.exemptIds.has(a.source.id) || !closeBounds(a.bounds, b.bounds)) continue;
      prepare(a); prepare(b);
      if (surfacesTouch(a.tree!, b.tree!) || inside(a.facets[0]!.triangle.a, b.facets) || inside(b.facets[0]!.triangle.a, a.facets)) {
        const [firstId, secondId] = [a.source.id, b.source.id].sort();
        collisions.push({ firstId: firstId!, secondId: secondId! });
      }
    }
  }
  return collisions;
}
