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
  function edit(change: Edit) {
    setHistory((old) => {
      try {
        const next = structuredClone(old.present);
        change(next);
        const result = commitScene(old, next);
        setIssue("");
        return result;
      } catch (e) {
        setIssue((e as Error).message);
        return old;
      }
    });
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
