import type {
  ModelDefinition,
  RoomState,
  SceneDocument,
} from "@climbed/contracts";

function samePhysicalModel(a: ModelDefinition, b: ModelDefinition): boolean {
  return (
    a.id === b.id &&
    a.version === b.version &&
    a.shape === b.shape &&
    a.kind === b.kind &&
    a.color === b.color &&
    a.dimensions.every((n, i) => Math.abs(n - b.dimensions[i]!) < 1e-9)
  );
}
/** Draft demand uses storage stock; an existing occupation of this exact placement is retained. */
export function remainingStock(
  scene: SceneDocument,
  room: RoomState,
): Map<string, number> {
  const result = new Map(
    room.inventory.map((item) => [item.modelId, item.available]),
  );
  for (const placement of scene.placements) {
    const model = scene.models.find((item) => item.id === placement.modelId);
    if (!model) continue;
    const retained = room.occupations?.some(
      (item) =>
        item.state !== "return_pending" &&
        item.placementId === placement.id &&
        samePhysicalModel(item.model, model),
    );
    if (!retained) result.set(model.id, (result.get(model.id) ?? 0) - 1);
  }
  return result;
}
