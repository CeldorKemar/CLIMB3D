import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Grid2X2,
  Hand,
  History,
  Layers,
  Maximize2,
  MousePointer2,
  Move3D,
  Redo2,
  Save,
  Undo2,
  Warehouse,
  X,
} from "lucide-react";
import type {
  BootstrapResponse,
  ReservationAction,
  RoomState,
  WallDefinition,
  Vec3,
} from "@climbed/contracts";
import {
  findSceneCollisions,
  quaternionFromWallAngles,
  getRoomLevels,
  translateStructure,
} from "@climbed/geometry";
import { api } from "../api/client";
import { useEditor } from "../hooks/useEditor";
import { remainingStock } from "../domain/stock";
import { describeSceneProblems } from "../domain/diagnostics";
import {
  copySelection,
  createSelectionCopy,
  InvalidSceneError,
  removeSelection,
  type SceneClipboard,
} from "@climbed/editor-core";
import {
  SceneCanvas,
  type SurfacePoint,
  type ViewMode,
} from "../renderer/SceneCanvas";
import { Brand } from "./Brand";
import { LibraryPanel } from "./LibraryPanel";
import { PropertiesPanel } from "./PropertiesPanel";
import { StockPanel } from "./StockPanel";
import { CatalogEditor } from "./CatalogEditor";
import { MultiWallBuilder } from "./MultiWallBuilder";
import { HistoryPanel } from "./HistoryPanel";
import { RoomMap } from "./RoomMap";
import { LevelsPanel } from "./LevelsPanel";
import { MoveControls } from "./MoveControls";
interface Props {
  session: BootstrapResponse;
  roomId: string;
  initial: RoomState;
  changeRoom: (id: string) => void;
  onLogout: () => Promise<void>;
}
export function Workspace({
  session,
  roomId,
  initial,
  changeRoom,
  onLogout,
}: Props) {
  const editor = useEditor(initial.scene);
  const { scene, edit } = editor;
  const [room, setRoom] = useState(initial);
  const [base, setBase] = useState({
    scene: initial.scene,
    revision: initial.revision,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  const [moveStep, setMoveStep] = useState(.1);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [editorView, setEditorView] = useState<"room" | "catalog">("room");
  const [rightTab, setRightTab] = useState<
    "design" | "stock" | "history" | "levels"
  >("design");
  const [grid, setGrid] = useState(true);
  const [view, setView] = useState<{
    mode: ViewMode;
    seq: number;
    wallId?: string;
  }>({
    mode: "perspective",
    seq: 0,
  });
  const [activeBoulderId, setActiveBoulderId] = useState<string | null>(
    initial.scene.boulders[0]?.id ?? null,
  );
  const [hiddenRouteIds, setHiddenRouteIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingRoom, setPendingRoom] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [chainOpen, setChainOpen] = useState(false);
  const clipboard = useRef<{
    content: SceneClipboard;
    nextPasteIndex: number;
  } | null>(null);
  const dirty = JSON.stringify(scene) !== JSON.stringify(base.scene);
  const activeModel = scene.models.find((m) => m.id === activeModelId);
  const currentRoom = session.rooms.find((r) => r.id === roomId);
  const remaining = useMemo(() => remainingStock(scene, room), [scene, room]);
  const totals = useMemo(
    () => new Map(room.inventory.map((item) => [item.modelId, item.total])),
    [room.inventory],
  );
  const collisions = useMemo(() => findSceneCollisions(scene), [scene]);
  function setSelection(ids: string[]) {
    setSelectedIds(ids);
    setSelected(ids.at(-1) ?? null);
  }
  function select(id: string | null, additive = false) {
    setSelectedLevelId(null);
    setActiveModelId(null);
    if (additive && id && scene.placements.some((p) => p.id === id)) {
      const existing = selectedIds.filter((key) =>
        scene.placements.some((p) => p.id === key),
      );
      setSelection(
        existing.includes(id)
          ? existing.filter((key) => key !== id)
          : [...existing, id],
      );
    } else setSelection(id ? [id] : []);
  }
  function selectLevel(id: string) {
    setSelection([]);
    setSelectedLevelId(id);
    setActiveModelId(null);
    navigate("levels");
  }
  const moveTarget = selectedIds.length <= 1 && scene.walls.some(w => w.id === selected)
    ? { kind: "wall" as const, id: selected! }
    : selectedLevelId && getRoomLevels(scene).some(l => l.id === selectedLevelId)
      ? { kind: "level" as const, id: selectedLevelId } : null;
  const moveName = moveTarget?.kind === "wall" ? scene.walls.find(w => w.id === moveTarget.id)?.name
    : getRoomLevels(scene).find(l => l.id === moveTarget?.id)?.name;
  function moveStructure(delta: Vec3) {
    if (!moveTarget || busy) return;
    edit(d => Object.assign(d, translateStructure(d, moveTarget, delta)));
  }
  function openCatalog() {
    setActiveModelId(null);
    setEditorView("catalog");
  }
  function changeView(mode: ViewMode) {
    setView((old) => ({ mode, seq: old.seq + 1 }));
  }
  function navigate(tab: "design" | "stock" | "history" | "levels") {
    setEditorView("room");
    setRightTab(tab);
  }
  useEffect(() => {
    const retained = selectedIds.filter(
      (id) =>
        scene.walls.some((w) => w.id === id) ||
        scene.placements.some((p) => p.id === id),
    );
    if (retained.length !== selectedIds.length) setSelection(retained);
  }, [scene, selectedIds]);
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if (busy || e.defaultPrevented || e.isComposing) return;
      const target = e.target as HTMLElement;
      if (
        target.isContentEditable ||
        target.closest(
          'input, textarea, select, [contenteditable="true"], [role="textbox"]',
        )
      )
        return;
      if (e.key === "Escape") {
        setActiveModelId(null);
        setHelp(false);
        return;
      }
      if (help || pendingRoom || chainOpen || target.closest('[role="dialog"]'))
        return;
      const modifier = (e.ctrlKey || e.metaKey) && !e.altKey;
      if (modifier && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? editor.redo() : editor.undo();
        return;
      }
      if (modifier && e.key.toLowerCase() === "y") {
        e.preventDefault();
        editor.redo();
        return;
      }
      if (editorView !== "room") return;
      if (moveTarget && !activeModel && !e.ctrlKey && !e.metaKey && !target.closest('.room-map') && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        if (e.altKey && !["ArrowUp", "ArrowDown"].includes(e.key)) return;
        e.preventDefault();
        const step = moveStep * (e.shiftKey ? 10 : 1);
        const delta: Vec3 = [0, 0, 0];
        const axis = e.key === "ArrowLeft" || e.key === "ArrowRight" ? 0 : e.altKey ? 2 : 1;
        delta[axis] = (e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 1) * step;
        moveStructure(delta);
        return;
      }
      if (
        modifier &&
        !e.shiftKey &&
        e.key.toLowerCase() === "c" &&
        selected &&
        selectedIds.length <= 1
      ) {
        e.preventDefault();
        copySelected();
      } else if (
        modifier &&
        !e.shiftKey &&
        e.key.toLowerCase() === "v" &&
        clipboard.current &&
        selectedIds.length <= 1
      ) {
        e.preventDefault();
        pasteCopied();
      } else if (
        modifier &&
        !e.shiftKey &&
        e.key.toLowerCase() === "d" &&
        selected &&
        selectedIds.length <= 1
      ) {
        e.preventDefault();
        if (copySelected(false)) pasteCopied();
      } else if (
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        (e.key === "Delete" || e.key === "Backspace") &&
        selected
      ) {
        e.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [
    scene,
    selected,
    selectedIds,
    remaining,
    editorView,
    help,
    pendingRoom,
    chainOpen,
    busy,
    moveStep,
    selectedLevelId,
    activeModelId,
  ]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", unload);
    return () => window.removeEventListener("beforeunload", unload);
  }, [dirty]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  async function run(
    operation: () => Promise<RoomState>,
    message: string,
    replaceScene = false,
  ) {
    setBusy(true);
    setError("");
    try {
      const result = await operation();
      setRoom(result);
      if (replaceScene) {
        editor.reset(result.scene);
        setBase({ scene: result.scene, revision: result.revision });
        if (
          !result.scene.placements.some((p) => p.id === selected) &&
          !result.scene.walls.some((w) => w.id === selected)
        )
          setSelection([]);
      }
      if (!replaceScene && result.revision !== base.revision) {
        setError(
          "Un autre ouvreur a sauvegardé une nouvelle version. Votre brouillon est conservé ; rechargez la page pour récupérer la dernière version, après avoir conservé vos modifications.",
        );
        setNotice("");
      } else setNotice(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function save() {
    void run(
      () => api.save(roomId, scene, base.revision, session.csrfToken),
      "Projet sauvegardé.",
      true,
    );
  }
  function reserve(wallIds?: string[]) {
    void run(
      () => api.reserve(roomId, base.revision, session.csrfToken, wallIds),
      "Pièces réservées. Vous pouvez aller les chercher.",
    );
  }
  function reservationAction(id: string, action: ReservationAction) {
    void run(
      () => api.action(roomId, id, action, session.csrfToken),
      "État du matériel mis à jour.",
    );
  }
  async function declareStock(modelId: string, total: number) {
    setBusy(true);
    try {
      const result = await api.declareStock(
        roomId,
        modelId,
        total,
        base.revision,
        session.csrfToken,
      );
      setRoom(result);
      setNotice("Inventaire mis à jour.");
    } finally {
      setBusy(false);
    }
  }
  function copySelected(showNotice = true): boolean {
    if (!selected) return false;
    try {
      clipboard.current = {
        content: copySelection(scene, selected),
        nextPasteIndex: 1,
      };
      setError("");
      editor.clearIssue();
      if (showNotice)
        setNotice("Sélection copiée. Ctrl+V pour la coller dans cette salle.");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  function pasteCopied() {
    const copied = clipboard.current;
    if (!copied) return;
    const demand = new Map<string, number>();
    for (const placement of copied.content.placements)
      demand.set(placement.modelId, (demand.get(placement.modelId) ?? 0) + 1);
    const shortages = [...demand].flatMap(([id, count]) => {
      const available = Math.max(0, remaining.get(id) ?? 0);
      const model = copied.content.models.find((item) => item.id === id);
      return available < count
        ? [
            `${model?.name ?? id} : ${count} pièce(s) à copier, ${available} disponible(s).`,
          ]
        : [];
    });
    if (shortages.length) {
      setError(
        `Stock insuffisant. ${shortages.join(" · ")} Aucune copie ajoutée.`,
      );
      return;
    }
    try {
      const result = createSelectionCopy(
        scene,
        copied.content,
        () => crypto.randomUUID(),
        copied.nextPasteIndex,
      );
      if (edit((d) => Object.assign(d, result.scene))) {
        copied.nextPasteIndex++;
        select(result.selectedId);
        setRightTab("design");
        setError("");
        setNotice("Sélection collée. Aucun matériel réservé.");
        changeView("perspective");
      }
    } catch (e) {
      const problems =
        e instanceof InvalidSceneError ? e.problems : [(e as Error).message];
      setError(describeSceneProblems(scene, problems).join(" · "));
    }
  }
  function deleteSelected() {
    const ids = selectedIds.length ? selectedIds : selected ? [selected] : [];
    if (!ids.length) return;
    if (edit((d) => Object.assign(d, removeSelection(d, ids)))) {
      select(null);
      setError("");
    }
  }
  function place(point: SurfacePoint) {
    if (!activeModel || busy) return;
    if ((remaining.get(activeModel.id) ?? 0) <= 0) {
      setError(
        "Tous les exemplaires de ce modèle sont utilisés ou prévus dans le projet. Déclarez du stock supplémentaire ou retirez un autre placement.",
      );
      return;
    }
    const id = crypto.randomUUID();
    const accepted = edit((d) => {
      d.placements.push({
        id,
        modelId: activeModel.id,
        modelVersion: 1,
        ...point,
      });
      const route = d.boulders.find((b) => b.id === activeBoulderId);
      if (route) route.placementIds.push(id);
    });
    if (accepted) setSelection([id]);
  }
  function duplicatePlacement(id: string) {
    select(id);
    try {
      clipboard.current = {
        content: copySelection(scene, id),
        nextPasteIndex: 1,
      };
      pasteCopied();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function addWall() {
    const id = crypto.randomUUID();
    const last = scene.walls.at(-1)!;
    if (
      edit((d) =>
        d.walls.push({
          id,
          name: `Pan ${d.walls.length + 1}`,
          width: 3,
          height: 3.5,
          thickness: 0.18,
          position: [last.position[0] + last.width / 2 + 1.5, 0, 0],
          rotation: quaternionFromWallAngles(0),
          color: "#b8c4ad",
          openings: [],
          fixingSpacing: 0.25,
        }),
      )
    ) {
      select(id);
      setRightTab("design");
      changeView("perspective");
    }
  }
  function addChain(walls: WallDefinition[]): {
    ok: boolean;
    problems: string[];
  } {
    if (scene.walls.length + walls.length > 100) {
      return {
        ok: false,
        problems: [
          `Le projet contient ${scene.walls.length} pans. Ajouter ${walls.length} segments donnerait ${scene.walls.length + walls.length} pans, au-delà de la limite de 100.`,
        ],
      };
    }
    const result = editor.editDetailed((d) => d.walls.push(...walls));
    if (result.ok) {
      select(walls[0]!.id);
      setRightTab("design");
      changeView("perspective");
    }
    return result;
  }
  function requestRoom(id: string) {
    if (id === roomId) return;
    if (dirty) setPendingRoom(id);
    else changeRoom(id);
  }
  return (
    <main className="atelier-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <Brand />
          <span className="atelier-badge">ATELIER</span>
        </div>
        <div className="room-switch">
          <span className="room-switch-icon">
            <Layers size={17} />
          </span>
          <div>
            <span className="room-label">VOTRE SALLE</span>
            <select
              aria-label="Choisir une salle"
              disabled={busy}
              value={roomId}
              onChange={(e) => requestRoom(e.target.value)}
            >
              {session.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <ChevronDown size={13} />
        </div>
        <div className="topbar-actions">
          <span className={`save-state ${dirty ? "unsaved" : ""}`}>
            <span className="status-dot" />
            {dirty ? "Modifications en cours" : "Tout est sauvegardé"}
          </span>
          <div className="history-controls">
            <button
              className="icon-button"
              title="Annuler (Ctrl Z)"
              aria-label="Annuler"
              data-testid="scene-undo"
              disabled={!editor.canUndo || busy}
              onClick={editor.undo}
            >
              <Undo2 size={18} />
            </button>
            <button
              className="icon-button"
              title="Rétablir (Ctrl Maj Z)"
              aria-label="Rétablir"
              data-testid="scene-redo"
              disabled={!editor.canRedo || busy}
              onClick={editor.redo}
            >
              <Redo2 size={18} />
            </button>
          </div>
          <button
            className="primary save-button"
            data-testid="scene-save"
            onClick={save}
            disabled={!dirty || busy}
          >
            <Save size={15} />
            {busy ? "En cours…" : "Sauvegarder"}
          </button>
          <button
            className="avatar"
            title={`${session.user.name} · Se déconnecter`}
            aria-label="Se déconnecter"
            onClick={async () => {
              if (dirty) {
                setError("Sauvegardez votre projet avant de vous déconnecter.");
                return;
              }
              try {
                await onLogout();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {session.user.name
              .split(" ")
              .map((w) => w[0])
              .slice(0, 2)
              .join("")}
          </button>
        </div>
      </header>
      <div inert={busy} className={`atelier-body ${busy ? "is-busy" : ""}`}>
        <nav className="nav-rail" aria-label="Navigation de l’atelier">
          <button
            data-testid="nav-design"
            className={
              editorView === "room" && rightTab === "design" ? "active" : ""
            }
            title="Conception"
            aria-label="Conception"
            onClick={() => navigate("design")}
          >
            <Layers size={22} />
          </button>
          <button
            data-testid="nav-catalog"
            className={editorView === "catalog" ? "active" : ""}
            title="Éditeur de modèles"
            aria-label="Éditeur de modèles"
            onClick={openCatalog}
          >
            <BookOpen size={22} />
          </button>
          <button
            data-testid="nav-stock"
            className={
              editorView === "room" && rightTab === "stock" ? "active" : ""
            }
            title="Stock et interventions"
            aria-label="Stock et interventions"
            onClick={() => navigate("stock")}
          >
            <Warehouse size={22} />
          </button>
          <button
            data-testid="nav-history"
            className={
              editorView === "room" && rightTab === "history" ? "active" : ""
            }
            title="Historique des conceptions"
            aria-label="Historique des conceptions"
            onClick={() => navigate("history")}
          >
            <History size={22} />
          </button>
          <button
            data-testid="nav-levels"
            className={
              editorView === "room" && rightTab === "levels" ? "active" : ""
            }
            title="Sols et niveaux"
            aria-label="Sols et niveaux"
            onClick={() => navigate("levels")}
          >
            <Building2 size={22} />
          </button>
          <div className="rail-spacer" />
          <button
            title="Aide de l’éditeur"
            aria-label="Aide de l’éditeur"
            onClick={() => setHelp(true)}
          >
            <CircleHelp size={20} />
          </button>
        </nav>
        {editorView === "catalog" ? (
          <CatalogEditor
            scene={scene}
            room={room}
            edit={edit}
            onBack={() => setEditorView("room")}
            dirty={dirty}
            busy={busy}
            canManageStock={["superadmin", "admin", "manager"].includes(
              session.user.role,
            )}
            declareStock={declareStock}
          />
        ) : (
          <>
            <LibraryPanel
              scene={scene}
              selected={selected}
              activeModel={activeModel}
              onSelect={(id) => {
                select(id);
                setRightTab("design");
              }}
              onModel={(m) => {
                setSelectedLevelId(null);
                setActiveModelId(m?.id ?? null);
                setSelection([]);
              }}
              onAddWall={addWall}
              onAddChain={() => setChainOpen(true)}
              remaining={remaining}
              totals={totals}
            />
            <section
              className="viewport-area"
              data-testid="keyboard-workspace"
              tabIndex={0}
              aria-label="Éditeur de salle : Suppr, Ctrl+C, Ctrl+V et Ctrl+D sur la sélection"
            >
              <div className="viewport-heading">
                <div>
                  <div className="breadcrumb">
                    <span>{currentRoom?.name}</span>
                    <ChevronRight size={12} />
                    <span>Conception</span>
                  </div>
                  <h1>
                    {scene.name}
                    <span className="theory-badge">CONCEPTION</span>
                  </h1>
                </div>
                {collisions.length > 0 && (
                  <button
                    className="collision-warning"
                    data-testid="legacy-collisions"
                    onClick={() => {
                      select(collisions[0]!.firstId);
                      setRightTab("design");
                    }}
                  >
                    {collisions.length} intersection
                    {collisions.length > 1 ? "s" : ""} à corriger
                  </button>
                )}
              </div>
              <div className="canvas-wrap">
                <SceneCanvas
                  scene={scene}
                  selected={selected}
                  selectedIds={selectedIds}
                  selectedLevelId={selectedLevelId}
                  onSelectLevel={selectLevel}
                  activeModel={activeModel}
                  grid={grid}
                  view={view}
                  onSelect={select}
                  onPlace={place}
                  hiddenRouteIds={hiddenRouteIds}
                  remainingStock={remaining}
                />
                {moveTarget && moveName && !activeModel && <MoveControls name={moveName} step={moveStep} onStep={setMoveStep} onMove={moveStructure} />}
                <RoomMap
                  scene={scene}
                  selectedWallId={
                    scene.walls.some((w) => w.id === selected)
                      ? (selected ?? undefined)
                      : undefined
                  }
                  onFocusWall={(wallId) => {
                    select(wallId);
                    setRightTab("design");
                    setView((old) => ({
                      mode: "front",
                      seq: old.seq + 1,
                      wallId,
                    }));
                  }}
                />
                <div className="viewport-tools">
                  <button
                    className={!activeModel ? "active" : ""}
                    aria-label="Outil de sélection"
                    title="Sélection (Échap)"
                    onClick={() => setActiveModelId(null)}
                  >
                    <MousePointer2 size={18} />
                  </button>
                  <span />
                  <button
                    className={grid ? "active subtle" : ""}
                    title="Afficher les fixations et la grille"
                    aria-label="Afficher les fixations et la grille"
                    aria-pressed={grid}
                    onClick={() => setGrid((v) => !v)}
                  >
                    <Grid2X2 size={18} />
                  </button>
                  <button
                    title="Recentrer la vue"
                    aria-label="Recentrer la vue"
                    onClick={() => changeView("perspective")}
                  >
                    <Maximize2 size={18} />
                  </button>
                </div>
                <div className="view-switch">
                  <button
                    data-testid="view-perspective"
                    className={view.mode === "perspective" ? "active" : ""}
                    onClick={() => changeView("perspective")}
                  >
                    Perspective
                  </button>
                  <button
                    data-testid="view-front"
                    className={view.mode === "front" ? "active" : ""}
                    onClick={() => changeView("front")}
                  >
                    Face
                  </button>
                  <button
                    data-testid="view-top"
                    className={view.mode === "top" ? "active" : ""}
                    onClick={() => changeView("top")}
                  >
                    Dessus
                  </button>
                </div>
                <div className="scene-label">
                  <span className="status-dot" />
                  ESPACE DE CONCEPTION<span>Unité : mètre</span>
                </div>
                <div className="axis-indicator" aria-hidden="true">
                  <i className="axis-y">Y</i>
                  <i className="axis-z">Z</i>
                  <i className="axis-x">X</i>
                  <b />
                </div>
                {activeModel && (
                  <div className="placement-hint">
                    <span className="status-dot" />
                    <strong>{activeModel.name}</strong>
                    <span>
                      {Math.max(0, remaining.get(activeModel.id) ?? 0)} restants
                      · Cliquer pour poser
                    </span>
                    <button
                      aria-label="Quitter le placement"
                      onClick={() => setActiveModelId(null)}
                    >
                      Échap
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
              <footer className="viewport-footer">
                <span>
                  <MousePointer2 size={13} />
                  Cliquer : sélectionner
                </span>
                <span>
                  <Hand size={13} />
                  Glisser : orbiter · Clic droit : déplacer · Molette : zoomer
                </span>
                <span data-testid="placement-count">
                  {scene.placements.length} éléments
                </span>
              </footer>
            </section>
            <aside className="inspector-panel">
              <div className="inspector-heading">
                {rightTab === "design" ? (
                  <>
                    <Move3D size={15} />
                    Propriétés
                  </>
                ) : rightTab === "stock" ? (
                  <>
                    <Warehouse size={15} />
                    Stock & suivi
                  </>
                ) : rightTab === "history" ? (
                  <>
                    <History size={15} />
                    Historique des conceptions
                  </>
                ) : (
                  <>
                    <Building2 size={15} />
                    Sols et niveaux
                  </>
                )}
              </div>
              {rightTab === "design" ? (
                <PropertiesPanel
                  scene={scene}
                  selected={selected}
                  selectedIds={selectedIds}
                  onDeleteSelection={deleteSelected}
                  edit={edit}
                  onSelect={select}
                  activeBoulderId={activeBoulderId}
                  setActiveBoulderId={setActiveBoulderId}
                  hiddenRouteIds={hiddenRouteIds}
                  setHiddenRouteIds={setHiddenRouteIds}
                  onDuplicate={duplicatePlacement}
                />
              ) : rightTab === "stock" ? (
                <StockPanel
                  room={room}
                  scene={scene}
                  dirty={dirty}
                  busy={busy}
                  reserve={reserve}
                  action={reservationAction}
                />
              ) : rightTab === "levels" ? (
                <LevelsPanel
                  scene={scene}
                  selectedLevelId={selectedLevelId}
                  onSelectLevel={selectLevel}
                  selectedWallId={
                    scene.walls.some((w) => w.id === selected)
                      ? (selected ?? undefined)
                      : undefined
                  }
                  onChange={(next) => {
                    edit((d) => Object.assign(d, next));
                  }}
                />
              ) : (
                <HistoryPanel
                  roomId={roomId}
                  csrf={session.csrfToken}
                  revision={base.revision}
                  scene={scene}
                  dirty={dirty}
                  busy={busy}
                  restore={(id) =>
                    void run(
                      () =>
                        api.restoreSnapshot(
                          roomId,
                          id,
                          base.revision,
                          session.csrfToken,
                        ),
                      "Conception restaurée. Le stock physique reste inchangé.",
                      true,
                    )
                  }
                />
              )}
              <div className="inspector-footer">
                <span className="status-dot" />
                Projet v{base.revision}
                <span>POC · Données serveur</span>
              </div>
            </aside>
          </>
        )}
      </div>
      {(error || editor.issue) && (
        <div className="global-editor-message error-banner" role="alert">
          <span>{error || editor.issue}</span>
          <button
            className="icon-button small"
            aria-label="Fermer le message"
            onClick={() => {
              setError("");
              editor.clearIssue();
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {notice && !error && !editor.issue && (
        <div className="global-editor-message success-banner" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
      {chainOpen && (
        <MultiWallBuilder
          scene={scene}
          onClose={() => setChainOpen(false)}
          onApply={addChain}
        />
      )}
      {pendingRoom && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="switch-title"
          >
            <h2 id="switch-title">Changer de salle ?</h2>
            <p>Ce projet contient des modifications non sauvegardées.</p>
            <div>
              <button
                className="secondary"
                onClick={() => setPendingRoom(null)}
              >
                Rester ici
              </button>
              <button
                className="primary"
                onClick={() => changeRoom(pendingRoom)}
              >
                Quitter sans sauvegarder
              </button>
            </div>
          </section>
        </div>
      )}
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="modal help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Fermer l’aide"
              onClick={() => setHelp(false)}
            >
              <X size={18} />
            </button>
            <span className="eyebrow">BIENVENUE DANS L’ATELIER</span>
            <h2 id="help-title">Du pan au premier mouvement.</h2>
            <ol>
              <li>
                <strong>Construisez les supports.</strong> Ajoutez un pan ou un
                mur composé de segments raccordés à angles absolus.
              </li>
              <li>
                <strong>Préparez les modèles.</strong> L’éditeur de bibliothèque
                permet de créer les formes et de déclarer explicitement le
                stock.
              </li>
              <li>
                <strong>Composez les voies.</strong> Les nouveaux placements
                rejoignent la voie active. Un même volume ou une même prise peut
                appartenir à plusieurs voies.
              </li>
              <li>
                <strong>Conservez et installez.</strong> Sauvegardez et gardez
                une version dans l’historique. Le check-in réserve le matériel,
                avant son retrait puis son installation.
              </li>
            </ol>
            <p>
              Glisser : orbiter · Clic droit : déplacer · Molette : zoomer
              <br />
              Échap : sélectionner · Ctrl Z : annuler · Ctrl Maj Z : rétablir
              <br />
              Sélection : Suppr ou Retour arrière · Ctrl C / Ctrl V : copier /
              coller · Ctrl D : dupliquer
              <br />
              Le presse-papiers de conception reste dans cette salle. Les copies
              incluent les éléments du pan et respectent le stock disponible.
            </p>
            <p className="small-muted">
              Les modèles génériques ne constituent pas une validation
              mécanique. Scan et import de modèles externes prévus en V2.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
