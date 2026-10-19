import type { SceneDocument } from "@climbed/contracts";
export type Edit = (draft: SceneDocument) => void;
export function removePlacement(scene: SceneDocument, id: string) {
  const ids = new Set([
    id,
    ...scene.placements.filter((p) => p.parentId === id).map((p) => p.id),
  ]);
  scene.placements = scene.placements.filter((p) => !ids.has(p.id));
  for (const b of scene.boulders) {
    b.placementIds = b.placementIds.filter((i) => !ids.has(i));
    b.startIds = b.startIds.filter((i) => !ids.has(i));
    b.finishIds = b.finishIds.filter((i) => !ids.has(i));
  }
}
