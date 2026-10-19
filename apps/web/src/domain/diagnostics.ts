import type { SceneDocument } from "@climbed/contracts";

/** Keep every validator reason while replacing internal object IDs with scene labels. */
export function describeSceneProblems(
  scene: SceneDocument,
  problems: readonly string[],
): string[] {
  const names = new Map<string, string>();
  for (const wall of scene.walls) {
    names.set(wall.id, wall.name);
    for (const [index, opening] of wall.openings.entries()) {
      names.set(opening.id, `Ouverture ${index + 1} de ${wall.name}`);
    }
  }
  for (const model of scene.models) names.set(model.id, model.name);
  for (const [index, placement] of scene.placements.entries()) {
    const model = scene.models.find((item) => item.id === placement.modelId);
    names.set(placement.id, `${model?.name ?? "Élément"} — pièce ${index + 1}`);
  }
  for (const route of scene.boulders) names.set(route.id, route.name);
  const entries = [...names].sort(([a], [b]) => b.length - a.length);
  return [
    ...new Set(
      problems.map((problem) => {
        // Replace once in the original text, so labels containing other IDs are not reinterpreted.
        const escaped = entries.map(([id]) =>
          id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        );
        if (!escaped.length) return problem;
        return problem.replace(
          new RegExp(escaped.join("|"), "g"),
          (id) => `« ${names.get(id)} »`,
        );
      }),
    ),
  ];
}
