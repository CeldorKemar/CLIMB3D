import type { ModelDefinition, ShapeKind } from "@climbed/contracts";

export const shapeLabels: Record<ShapeKind, string> = {
  jug: "Bac à cavité",
  crimp: "Réglette",
  pinch: "Pince",
  dome: "Dôme",
  pyramid: "Pyramide",
  prism: "Prisme",
  box: "Boîte",
  scoop: "Coupelle creuse",
};

export interface CatalogQuery {
  kind?: ModelDefinition["kind"];
  search?: string;
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/,/g, ".");
}

function searchableText(model: ModelDefinition): string {
  const dimensions = [
    { factor: 1, unit: "m" },
    { factor: 100, unit: "cm" },
    { factor: 1000, unit: "mm" },
  ].flatMap(({ factor, unit }) => {
    const values = model.dimensions.map((value) =>
      String(Number((value * factor).toFixed(5))),
    );
    return [
      ...values.map((value) => `${value} ${unit} ${value}${unit}`),
      values.join("x"),
    ];
  });
  return normalize(
    [
      model.name,
      model.kind === "hold" ? "prise prises" : "volume volumes",
      model.shape,
      shapeLabels[model.shape],
      model.color,
      ...dimensions,
    ].join(" "),
  );
}

/** Category and free text share one predicate, ready for additional structured filters. */
export function filterCatalog(
  models: ModelDefinition[],
  query: CatalogQuery,
): ModelDefinition[] {
  const words = normalize(query.search ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return models.filter((model) => {
    if (query.kind && model.kind !== query.kind) return false;
    const text = words.length ? searchableText(model) : "";
    return words.every((word) => text.includes(word));
  });
}
