import type { SceneDocument } from "@climbed/contracts";
/** A shared object stays visible while one of its routes is visible; supports follow their visible children. */
export function visiblePlacementIds(
  scene: SceneDocument,
  hiddenRouteIds: string[],
): Set<string> {
  const hidden = new Set(hiddenRouteIds);
  const ids = new Set(
    scene.placements
      .filter((placement) => {
        const routes = scene.boulders.filter((route) =>
          route.placementIds.includes(placement.id),
        );
        return !routes.length || routes.some((route) => !hidden.has(route.id));
      })
      .map((placement) => placement.id),
  );
  for (const placement of scene.placements)
    if (ids.has(placement.id) && placement.parentType === "volume")
      ids.add(placement.parentId);
  return ids;
}
