import { useState } from "react";
import type { SceneDocument } from "@climbed/contracts";
import {
  createHistory,
  commitScene,
  undoHistory,
  redoHistory,
  InvalidSceneError,
} from "@climbed/editor-core";
import type { Edit } from "../domain/editor";
import { describeSceneProblems } from "../domain/diagnostics";
export interface EditResult {
  ok: boolean;
  problems: string[];
}
export function useEditor(initial: SceneDocument) {
  const [history, setHistory] = useState(() => createHistory(initial));
  const [issue, setIssue] = useState("");
  function editDetailed(change: Edit): EditResult {
    const next = structuredClone(history.present);
    try {
      change(next);
      const result = commitScene(history, next);
      setHistory(result);
      setIssue("");
      return { ok: true, problems: [] };
    } catch (e) {
      const rawProblems =
        e instanceof InvalidSceneError ? e.problems : [(e as Error).message];
      const problems = describeSceneProblems(next, rawProblems);
      setIssue(problems.join(" · "));
      return { ok: false, problems };
    }
  }
  function edit(change: Edit): boolean {
    return editDetailed(change).ok;
  }
  return {
    scene: history.present,
    edit,
    editDetailed,
    issue,
    clearIssue: () => setIssue(""),
    canUndo: !!history.past.length,
    canRedo: !!history.future.length,
    undo: () => setHistory(undoHistory),
    redo: () => setHistory(redoHistory),
    reset: (scene: SceneDocument) => setHistory(createHistory(scene)),
  };
}
