import { BufferGeometry, Float32BufferAttribute, Quaternion, Ray, Triangle, Vector3 } from 'three';
import type { Vec3 } from '@climbed/contracts';

export interface GeometryBore { position: Vec3; normal: Vec3; diameter: number }
const EPS = 1e-9;
type Face = [Vector3, Vector3, Vector3];

function triangles(geometry: BufferGeometry): Face[] {
  const attr = geometry.getAttribute('position'), index = geometry.getIndex();
  const faces: Face[] = [];
  for (let i = 0; i < (index?.count ?? attr.count); i += 3) {
    faces.push([0, 1, 2].map(j => new Vector3().fromBufferAttribute(attr, index ? index.getX(i + j) : i + j)) as Face);
  }
  return faces;
}
function clip(poly: Vector3[], distance: (p: Vector3) => number, inside: boolean): Vector3[] {
  const output: Vector3[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
    const da = distance(a), db = distance(b);
    const aIn = inside ? da >= -EPS : da <= EPS, bIn = inside ? db >= -EPS : db <= EPS;
    if (aIn) output.push(a);
    if (aIn !== bIn && Math.abs(da - db) > EPS) output.push(a.clone().lerp(b, da / (da - db)));
  }
  return output;
}
function finish(faces: Face[]): BufferGeometry {
  const positions: number[] = [], normals: number[] = [];
  for (const [a, b, c] of faces) {
    const normal = new Triangle(a, b, c).getNormal(new Vector3());
    if (normal.lengthSq() < .5) continue;
    for (const p of [a, b, c]) { positions.push(p.x, p.y, p.z); normals.push(normal.x, normal.y, normal.z); }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  return geometry;
}

/** Subtract a polygonal through-bore. Face clipping preserves every original external facet.
 * The inner tunnel uses the same clipped boundary knots, including the sloped/concave top.
 * This is geometric subtraction, rather than a dark disk or a renderer-only decal.
 */
function subtractVerticalBore(geometry: BufferGeometry, diameter: number): BufferGeometry {
  const original = triangles(geometry), faces: Face[] = [];
  const segments = 16, radius = diameter / 2;
  const circle = Array.from({ length: segments }, (_, i) => new Vector3(radius * Math.cos(i * Math.PI * 2 / segments), radius * Math.sin(i * Math.PI * 2 / segments), 0));
  const cuts = circle.map((a, i) => {
    const b = circle[(i + 1) % segments]!, dx = b.x - a.x, dy = b.y - a.y;
    return { a, b, distance: (p: Vector3) => (dx * (p.y - a.y) - dy * (p.x - a.x)) / Math.hypot(dx, dy), knots: new Set([0, 1]) };
  });
  const emit = (poly: Vector3[]) => {
    for (const cut of cuts) {
      const edge = new Vector3().subVectors(cut.b, cut.a), lengthSq = edge.lengthSq();
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
        if (Math.abs(cut.distance(a)) > 1e-7 || Math.abs(cut.distance(b)) > 1e-7) continue;
        for (const p of [a, b]) {
          const t = new Vector3().subVectors(p, cut.a).dot(edge) / lengthSq;
          if (t >= -EPS && t <= 1 + EPS) cut.knots.add(Math.max(0, Math.min(1, t)));
        }
      }
    }
    for (let i = 1; i + 1 < poly.length; i++) faces.push([poly[0]!, poly[i]!, poly[i + 1]!]);
  };
  for (const face of original) {
    let remainder: Vector3[] = face;
    for (const cut of cuts) {
      if (!remainder.length) break;
      const outside = clip(remainder, cut.distance, false);
      if (outside.length >= 3) emit(outside);
      remainder = clip(remainder, cut.distance, true);
    }
  }
  // Current parametric solids are vertical height fields. Intersect their original triangles
  // at each boundary knot, so no invented constant-depth cylinder cap closes the opening.
  const ray = new Ray(new Vector3(), new Vector3(0, 0, -1));
  const hit = new Vector3();
  let maxZ = -Infinity, minZ = Infinity;
  for (const face of original) for (const p of face) { maxZ = Math.max(maxZ, p.z); minZ = Math.min(minZ, p.z); }
  const bounds = (p: Vector3): [number, number] | undefined => {
    ray.origin.set(p.x, p.y, maxZ + 1);
    const zs: number[] = [];
    for (const face of original) if (ray.intersectTriangle(...face, false, hit)) zs.push(hit.z);
    if (zs.length < 2) return undefined;
    return [Math.min(...zs), Math.max(...zs)];
  };
  for (const cut of cuts) {
    const knots = [...cut.knots].sort((a, b) => a - b).filter((t, i, all) => i === 0 || t - all[i - 1]! > 1e-7);
    for (let i = 0; i + 1 < knots.length; i++) {
      const a = cut.a.clone().lerp(cut.b, knots[i]!), b = cut.a.clone().lerp(cut.b, knots[i + 1]!);
      const ab = bounds(a), bb = bounds(b);
      if (!ab || !bb) continue;
      const loA = new Vector3(a.x, a.y, ab[0]), loB = new Vector3(b.x, b.y, bb[0]);
      const hiA = new Vector3(a.x, a.y, ab[1]), hiB = new Vector3(b.x, b.y, bb[1]);
      // A counter-clockwise bore contour has its material outside; the tunnel faces inwards.
      faces.push([loA, hiA, hiB], [loA, hiB, loB]);
    }
  }
  return finish(faces);
}

export function perforateGeometry(original: BufferGeometry, bores: GeometryBore[]): BufferGeometry {
  let geometry = original;
  for (const bore of bores) {
    const position = new Vector3(...bore.position), normal = new Vector3(...bore.normal).normalize();
    const rotation = new Quaternion().setFromUnitVectors(normal, new Vector3(0, 0, 1));
    const inverse = rotation.clone().invert();
    const local = geometry.clone().translate(-position.x, -position.y, -position.z).applyQuaternion(rotation);
    const next = subtractVerticalBore(local, bore.diameter).applyQuaternion(inverse).translate(position.x, position.y, position.z);
    local.dispose(); geometry.dispose(); geometry = next;
  }
  return geometry;
}
