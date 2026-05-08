"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CampusAPI, SceneData } from "@klorad/api";

const MAX_STACK = 50;
/** Rapid pushSnapshot() calls (e.g. typing) coalesce into one snapshot. */
const COALESCE_MS = 400;

export interface UseUndoRedoResult {
  /** Call before any mutation — captures the current state onto the past stack. */
  pushSnapshot: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Simple snapshot-based undo/redo for the campus Studio. Wraps the
 * scene API: before every user action, call pushSnapshot() to record
 * the current sceneData. undo() pops the last snapshot and calls
 * api.load() to restore it. onAfter fires after any undo/redo so the
 * caller can refresh local derived state (setPois, etc.).
 */
export function useUndoRedo(
  apiRef: React.MutableRefObject<CampusAPI | null>,
  onAfter: () => void
): UseUndoRedoResult {
  const pastRef = useRef<SceneData[]>([]);
  const futureRef = useRef<SceneData[]>([]);
  const lastPushAt = useRef(0);
  const [, forceVersion] = useState(0);
  const bump = () => forceVersion((v) => v + 1);

  const snapshot = (): SceneData | null => {
    if (!apiRef.current) return null;
    try {
      return JSON.parse(JSON.stringify(apiRef.current.export())) as SceneData;
    } catch {
      return null;
    }
  };

  const pushSnapshot = useCallback(() => {
    // Coalesce rapid successive calls (e.g. keystrokes) into one snapshot.
    const now = Date.now();
    if (now - lastPushAt.current < COALESCE_MS) {
      lastPushAt.current = now;
      return;
    }
    const snap = snapshot();
    if (!snap) return;
    lastPushAt.current = now;
    pastRef.current.push(snap);
    if (pastRef.current.length > MAX_STACK) pastRef.current.shift();
    // Any new action invalidates the redo stack.
    futureRef.current = [];
    bump();
  }, [apiRef]);

  const undo = useCallback(() => {
    if (pastRef.current.length === 0 || !apiRef.current) return;
    const current = snapshot();
    const snap = pastRef.current.pop();
    if (!snap) return;
    if (current) futureRef.current.push(current);
    apiRef.current.load(snap);
    onAfter();
    bump();
  }, [apiRef, onAfter]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0 || !apiRef.current) return;
    const current = snapshot();
    const snap = futureRef.current.pop();
    if (!snap) return;
    if (current) pastRef.current.push(current);
    apiRef.current.load(snap);
    onAfter();
    bump();
  }, [apiRef, onAfter]);

  // Keyboard shortcuts — Cmd/Ctrl+Z undo, +Shift to redo. Ignore when
  // focused inside an input / textarea / contenteditable.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return {
    pushSnapshot,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  };
}
