import { useState } from "react";
import type { SceneDocument } from "@climbed/contracts";
import {
  createHistory,
  commitScene,
  undoHistory,
  redoHistory,
} from "@climbed/editor-core";
import type { Edit } from "../domain/editor";
export function useEditor(initial: SceneDocument) {
  const [history, setHistory] = useState(() => createHistory(initial));
  const [issue, setIssue] = useState("");
  function edit(change: Edit): boolean {
    try {
      const next = structuredClone(history.present);
      change(next);
      const result = commitScene(history, next);
      setHistory(result);
      setIssue("");
      return true;
    } catch (e) {
      setIssue((e as Error).message);
      return false;
    }
  }
  return {
    scene: history.present,
    edit,
    issue,
    clearIssue: () => setIssue(""),
    canUndo: !!history.past.length,
    canRedo: !!history.future.length,
    undo: () => setHistory(undoHistory),
    redo: () => setHistory(redoHistory),
    reset: (scene: SceneDocument) => setHistory(createHistory(scene)),
  };
}
