import { z } from 'zod';

export const vector3Schema = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
export type Vec3 = z.infer<typeof vector3Schema>;
export const quaternionSchema = z.tuple([z.number().finite(), z.number().finite(), z.number().finite(), z.number().finite()])
  .refine(q => Math.abs(Math.hypot(...q) - 1) < 0.001, 'Rotation non normalisée');
export type Quat = z.infer<typeof quaternionSchema>;
const id = z.string().min(1).max(100);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const dimension = z.number().finite().min(0.005).max(30);
export const dimensionsSchema = z.tuple([dimension, dimension, dimension]);
export const shapeSchema = z.enum(['dome', 'jug', 'crimp', 'pinch', 'box', 'pyramid', 'prism', 'scoop']);
export type ShapeKind = z.infer<typeof shapeSchema>;

// The mesh branch is a future contract only; upload/import is deliberately absent in this POC.
export type GeometrySource =
  | { type: 'parametric'; generatorVersion: 1 }
  | { type: 'mesh'; assetId: string; sha256: string; format: 'glb'; schemaVersion: 1 };

export const modelSchema = z.object({
  id,
  version: z.literal(1),
  name: z.string().min(1).max(120),
  kind: z.enum(['hold', 'volume']),
  shape: shapeSchema,
  dimensions: dimensionsSchema,
  color,
  source: z.object({ type: z.literal('parametric'), generatorVersion: z.literal(1) }).strict(),
}).strict();
export type ModelDefinition = z.infer<typeof modelSchema>;

export const openingSchema = z.object({
  id,
  x: z.number().finite(),
  y: z.number().finite(),
  width: dimension,
  height: dimension,
}).strict();
export type WallOpening = z.infer<typeof openingSchema>;

export const wallSchema = z.object({
  id,
  name: z.string().min(1).max(100),
  width: dimension,
  height: dimension,
  thickness: z.number().finite().min(0.01).max(1),
  position: vector3Schema,
  rotation: quaternionSchema,
  color,
  openings: z.array(openingSchema).max(20),
  fixingSpacing: z.number().finite().min(0.1).max(1),
}).strict();
export type WallDefinition = z.infer<typeof wallSchema>;

export const placementSchema = z.object({
  id,
  modelId: id,
  modelVersion: z.literal(1),
  parentType: z.enum(['wall', 'volume']),
  parentId: id,
  position: vector3Schema,
  rotation: quaternionSchema,
}).strict();
export type Placement = z.infer<typeof placementSchema>;

export const boulderSchema = z.object({
  id,
  name: z.string().min(1).max(120),
  grade: z.string().max(20),
  color,
  placementIds: z.array(id).max(2000),
  startIds: z.array(id).max(4),
  finishIds: z.array(id).max(4),
}).strict();
export type BoulderDefinition = z.infer<typeof boulderSchema>;

export const sceneSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.string().min(1).max(120),
  units: z.literal('m'),
  upAxis: z.literal('Y'),
  walls: z.array(wallSchema).min(1).max(100),
  models: z.array(modelSchema).max(300),
  placements: z.array(placementSchema).max(3000),
  boulders: z.array(boulderSchema).max(300),
}).strict();
export type SceneDocument = z.infer<typeof sceneSchema>;

export type UserRole = 'superadmin' | 'admin' | 'manager' | 'setter';
export interface SessionUser { id: string; name: string; email: string; role: UserRole; organizationId: string }
export interface RoomSummary { id: string; name: string; organizationId: string }
export interface InventorySummary {
  modelId: string;
  total: number;
  available: number;
  reserved: number;
  installed: number;
  returnPending: number;
}
export type ReservationState = 'reserved' | 'taken' | 'installed' | 'return_pending' | 'returned' | 'cancelled';
export type ReservationAction = 'withdraw' | 'install' | 'request_return' | 'return' | 'cancel';
export interface ReservationSummary {
  id: string;
  wallIds?: string[];
  state: ReservationState;
  actorName: string;
  createdAt: string;
  sceneRevision: number;
  pieceCount: number;
  addedCount: number;
  retainedCount: number;
  removedCount: number;
}
export interface AuditEntry { id: string; action: string; actorName: string; createdAt: string; detail: string }
export interface RoomState {
  scene: SceneDocument;
  revision: number;
  inventory: InventorySummary[];
  reservations: ReservationSummary[];
  audit: AuditEntry[];
}
export interface BootstrapResponse { user: SessionUser; csrfToken: string; rooms: RoomSummary[] }
export interface ApiErrorBody { message: string; code?: string; details?: unknown }

export const demoModels: ModelDefinition[] = [
  { id: 'hold-jug', version: 1, name: 'Bac confort', kind: 'hold', shape: 'jug', dimensions: [0.22, 0.16, 0.11], color: '#f07c54', source: { type: 'parametric', generatorVersion: 1 } },
  { id: 'hold-crimp', version: 1, name: 'Réglette', kind: 'hold', shape: 'crimp', dimensions: [0.20, 0.055, 0.07], color: '#a5c94d', source: { type: 'parametric', generatorVersion: 1 } },
  { id: 'hold-pinch', version: 1, name: 'Pince', kind: 'hold', shape: 'pinch', dimensions: [0.09, 0.20, 0.09], color: '#9175d1', source: { type: 'parametric', generatorVersion: 1 } },
  { id: 'hold-dome', version: 1, name: 'Plat arrondi', kind: 'hold', shape: 'dome', dimensions: [0.19, 0.16, 0.08], color: '#f4c34f', source: { type: 'parametric', generatorVersion: 1 } },
  { id: 'volume-pyramid', version: 1, name: 'Pyramide', kind: 'volume', shape: 'pyramid', dimensions: [1.0, 0.85, 0.48], color: '#303f4a', source: { type: 'parametric', generatorVersion: 1 } },
  { id: 'volume-prism', version: 1, name: 'Prisme', kind: 'volume', shape: 'prism', dimensions: [0.85, 1.10, 0.40], color: '#e7b14c', source: { type: 'parametric', generatorVersion: 1 } },
  { id: 'volume-box', version: 1, name: 'Boîte', kind: 'volume', shape: 'box', dimensions: [0.75, 0.50, 0.25], color: '#657d75', source: { type: 'parametric', generatorVersion: 1 } },
  { id: 'volume-dome', version: 1, name: 'Dôme', kind: 'volume', shape: 'dome', dimensions: [0.85, 0.85, 0.38], color: '#bdced1', source: { type: 'parametric', generatorVersion: 1 } },
  { id: 'volume-scoop', version: 1, name: 'Coupelle creuse', kind: 'volume', shape: 'scoop', dimensions: [0.85, 0.85, 0.30], color: '#d27660', source: { type: 'parametric', generatorVersion: 1 } },
];

export function createDemoScene(): SceneDocument {
  // A wall lies in local XY, faces +Z, and starts at y=0. Tilt around X creates an overhang.
  const tilt = 12 * Math.PI / 180 / 2;
  const placements: Placement[] = [
    { id: 'placement-volume', modelId: 'volume-pyramid', modelVersion: 1, parentType: 'wall', parentId: 'wall-main', position: [-0.65, 1.8, 0], rotation: [0, 0, 0.12, Math.sqrt(1 - 0.12 ** 2)] },
    { id: 'placement-prism', modelId: 'volume-prism', modelVersion: 1, parentType: 'wall', parentId: 'wall-main', position: [1.5, 2.7, 0], rotation: [0, 0, 0, 1] },
    { id: 'placement-scoop', modelId: 'volume-scoop', modelVersion: 1, parentType: 'wall', parentId: 'wall-main', position: [-1.65, 3.1, 0], rotation: [0, 0, 0, 1] },
    { id: 'placement-box', modelId: 'volume-box', modelVersion: 1, parentType: 'wall', parentId: 'wall-side', position: [0.5, 1.4, 0], rotation: [0, 0, 0, 1] },
    { id: 'placement-dome', modelId: 'volume-dome', modelVersion: 1, parentType: 'wall', parentId: 'wall-side', position: [-0.55, 2.7, 0], rotation: [0, 0, 0, 1] },
    { id: 'placement-child', modelId: 'hold-jug', modelVersion: 1, parentType: 'volume', parentId: 'placement-box', position: [0, 0, 0.25], rotation: [0, 0, 0, 1] },
  ];
  const routeModels = ['hold-jug', 'hold-crimp', 'hold-pinch', 'hold-dome'];
  const routeXs = [-1.85, -0.7, 0.55, 1.9];
  for (let route = 0; route < routeModels.length; route++) {
    for (let step = 0; step < 8; step++) {
      const x = routeXs[route]! + Math.sin(step * 1.8 + route) * 0.25;
      const y = 0.45 + step * 0.42;
      // Keep the demonstration's wall-mounted anchors clear of the visible volumes.
      if ((Math.abs(x + 0.65) < 0.7 && Math.abs(y - 1.8) < 0.65)
        || (Math.abs(x - 1.5) < 0.55 && Math.abs(y - 2.7) < 0.65)
        || (Math.abs(x + 1.65) < 0.55 && Math.abs(y - 3.1) < 0.55)) continue;
      const angle = Math.sin(step + route) * 0.35;
      placements.push({ id: `route-${route}-${step}`, modelId: routeModels[route]!, modelVersion: 1, parentType: 'wall', parentId: 'wall-main', position: [x, y, 0], rotation: [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)] });
    }
    for (let step = 0; step < 2; step++) {
      const x = route < 2 ? -0.95 + route * 0.4 : 0.55 + (route - 2) * 0.45;
      placements.push({ id: `side-${route}-${step}`, modelId: routeModels[route]!, modelVersion: 1, parentType: 'wall', parentId: 'wall-side', position: [x, 0.45 + step * 1.7, 0], rotation: [0, 0, 0, 1] });
    }
  }
  const routeIds = placements.filter(p => p.modelId === 'hold-jug' && p.parentType === 'wall').map(p => p.id);
  return {
    schemaVersion: 1, name: 'Atelier de bloc', units: 'm', upAxis: 'Y',
    models: structuredClone(demoModels),
    walls: [
      { id: 'wall-main', name: 'Pan principal', width: 5, height: 4, thickness: 0.18, position: [0, 0, 0], rotation: [Math.sin(tilt), 0, 0, Math.cos(tilt)], color: '#e3dfd3', openings: [], fixingSpacing: 0.25 },
      { id: 'wall-side', name: 'Pan vertical', width: 2.6, height: 3.5, thickness: 0.18, position: [3.8, 0, 0], rotation: [0, 0, 0, 1], color: '#81948e', openings: [], fixingSpacing: 0.25 },
      { id: 'wall-roof', name: 'Toit', width: 5, height: 1.2, thickness: 0.18, position: [0, 4 * Math.cos(tilt * 2), 4 * Math.sin(tilt * 2)], rotation: [Math.SQRT1_2, 0, 0, Math.SQRT1_2], color: '#c7b290', openings: [], fixingSpacing: 0.25 },
    ],
    placements,
    boulders: [{ id: 'boulder-first', name: 'Premier mouvement', grade: '5c', color: '#f07c54', placementIds: routeIds, startIds: routeIds.slice(0, 2), finishIds: routeIds.slice(-1) }],
  };
}
