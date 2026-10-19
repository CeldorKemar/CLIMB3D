import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Compass,
  Eye,
  Grid2X2,
  Hand,
  Layers,
  LogOut,
  Maximize2,
  MousePointer2,
  Move3D,
  PanelRightClose,
  Redo2,
  RotateCcw,
  Save,
  Undo2,
  Warehouse,
  X,
  Info,
} from "lucide-react";
import type {
  BootstrapResponse,
  ModelDefinition,
  ReservationAction,
  RoomState,
} from "@climbed/contracts";
import { quaternionFromWallAngles } from "@climbed/geometry";
import { api } from "../api/client";
import { useEditor } from "../hooks/useEditor";
import {
  SceneCanvas,
  type SurfacePoint,
  type ViewMode,
} from "../renderer/SceneCanvas";
import { Brand } from "./Brand";
import { LibraryPanel } from "./LibraryPanel";
import { PropertiesPanel } from "./PropertiesPanel";
import { StockPanel } from "./StockPanel";
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
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<"design" | "stock">("design");
  const [grid, setGrid] = useState(true);
  const [view, setView] = useState<{ mode: ViewMode; seq: number }>({
    mode: "perspective",
    seq: 0,
  });
  const [activeBoulderId, setActiveBoulderId] = useState<string | null>(
    initial.scene.boulders[0]?.id ?? null,
  );
  const [focusBoulder, setFocusBoulder] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingRoom, setPendingRoom] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const dirty = JSON.stringify(scene) !== JSON.stringify(base.scene);
  const activeModel = scene.models.find((m) => m.id === activeModelId);
  const currentRoom = session.rooms.find((r) => r.id === roomId);
  function select(id: string | null) {
    setActiveModelId(null);
    setSelected(id);
  }
  function changeView(mode: ViewMode) {
    setView((old) => ({ mode, seq: old.seq + 1 }));
  }
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if (busy) return;
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (e.key === "Escape") {
        setActiveModelId(null);
        setHelp(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? editor.redo() : editor.undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        editor.redo();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [editor.undo, editor.redo, busy]);
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
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
      }
      if (!replaceScene && result.revision !== base.revision) {
        setError(
          "Un autre ouvreur a sauvegardé une nouvelle version du projet. Votre brouillon est conservé. Rechargez la page pour récupérer la dernière version ; vos modifications locales ne seront pas conservées.",
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
  function place(point: SurfacePoint) {
    if (!activeModel || busy) return;
    const id = crypto.randomUUID();
    edit((d) => {
      d.placements.push({
        id,
        modelId: activeModel.id,
        modelVersion: 1,
        ...point,
      });
      const b = d.boulders.find((b) => b.id === activeBoulderId);
      if (b && activeModel.kind === "hold") b.placementIds.push(id);
    });
    setSelected(id);
  }
  function addWall() {
    const id = crypto.randomUUID();
    const last = scene.walls.at(-1)!;
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
    );
    select(id);
    setRightTab("design");
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
            className={rightTab === "design" ? "active" : ""}
            title="Conception"
            aria-label="Conception"
            onClick={() => setRightTab("design")}
          >
            <Layers size={22} />
          </button>
          <button
            className={rightTab === "stock" ? "active" : ""}
            title="Stock et interventions"
            aria-label="Stock et interventions"
            onClick={() => setRightTab("stock")}
          >
            <Warehouse size={22} />
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
        <LibraryPanel
          scene={scene}
          selected={selected}
          activeModel={activeModel}
          onSelect={(id) => {
            select(id);
            setRightTab("design");
          }}
          onModel={(m) => {
            setActiveModelId(m?.id ?? null);
            setSelected(null);
          }}
          onAddWall={addWall}
        />
        <section className="viewport-area">
          <div className="viewport-heading">
            <div>
              <div className="breadcrumb">
                <span>{currentRoom?.name}</span>
                <ChevronRight size={12} />
                <span>Conception</span>
              </div>
              <h1>
                {scene.name}
                <span className="theory-badge">THÉORIQUE</span>
              </h1>
            </div>
            <button
              className="quiet-button"
              onClick={() => {
                setRightTab(rightTab === "stock" ? "design" : "stock");
              }}
            >
              <Warehouse size={15} />
              Stock de la salle
            </button>
          </div>
          <div className="canvas-wrap">
            <SceneCanvas
              scene={scene}
              selected={selected}
              activeModel={activeModel}
              grid={grid}
              view={view}
              onSelect={select}
              onPlace={place}
              activeBoulderId={activeBoulderId}
              focusBoulder={focusBoulder}
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
                <span>Cliquez pour poser</span>
                <button
                  aria-label="Quitter le placement"
                  onClick={() => setActiveModelId(null)}
                >
                  Échap
                  <X size={12} />
                </button>
              </div>
            )}
            {(error || editor.issue) && (
              <div className="canvas-message error-banner" role="alert">
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
            {notice && (
              <div className="canvas-message success-banner" role="status">
                <Check size={16} />
                {notice}
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
          <div className="inspector-tabs">
            <button
              className={rightTab === "design" ? "active" : ""}
              onClick={() => setRightTab("design")}
            >
              <Move3D size={15} />
              Propriétés
            </button>
            <button
              className={rightTab === "stock" ? "active" : ""}
              onClick={() => setRightTab("stock")}
            >
              <Warehouse size={15} />
              Stock & suivi
            </button>
          </div>
          {rightTab === "design" ? (
            <PropertiesPanel
              scene={scene}
              selected={selected}
              edit={edit}
              onSelect={select}
              activeBoulderId={activeBoulderId}
              setActiveBoulderId={setActiveBoulderId}
              focusBoulder={focusBoulder}
              setFocusBoulder={setFocusBoulder}
            />
          ) : (
            <StockPanel
              room={room}
              scene={scene}
              dirty={dirty}
              busy={busy}
              reserve={reserve}
              action={reservationAction}
            />
          )}
          <div className="inspector-footer">
            <span className="status-dot" />
            Projet v{base.revision}
            <span>POC · Données serveur</span>
          </div>
        </aside>
      </div>
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
                <strong>Construisez votre support.</strong> Ajoutez des pans,
                ajustez leurs dimensions et leur inclinaison dans les
                propriétés.
              </li>
              <li>
                <strong>Donnez du relief.</strong> Choisissez un volume puis
                cliquez sur un pan. Les prises peuvent se poser sur un pan ou un
                volume.
              </li>
              <li>
                <strong>Composez vos blocs.</strong> Choisissez un bloc actif :
                les nouvelles prises lui seront associées. Sélectionnez une
                prise pour indiquer départ ou arrivée.
              </li>
              <li>
                <strong>Passez au terrain.</strong> Sauvegardez, réservez dans «
                Stock & suivi », puis confirmez chaque étape physique.
              </li>
            </ol>
            <p>
              Glisser : orbiter · Clic droit : déplacer · Molette : zoomer
              <br />
              Échap : sélectionner · Ctrl Z : annuler · Ctrl Maj Z : rétablir
            </p>
            <p className="small-muted">
              Les modèles génériques du POC ne constituent pas une validation de
              fixation ou de montage. Import de modèles 3D et scan prévus en V2.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
