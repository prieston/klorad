import type { SceneEventBusAPI } from "../types/interfaces";
import type { SceneEventMap, SceneEventType, SceneEventHandler } from "../types";

export function createEventBus(): SceneEventBusAPI {
  const listeners = new Map<SceneEventType, Set<SceneEventHandler<SceneEventType>>>();

  function on<T extends SceneEventType>(event: T, handler: SceneEventHandler<T>): () => void {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(handler as SceneEventHandler<SceneEventType>);
    return () => off(event, handler);
  }

  function off<T extends SceneEventType>(event: T, handler: SceneEventHandler<T>): void {
    listeners.get(event)?.delete(handler as SceneEventHandler<SceneEventType>);
  }

  function emit<T extends SceneEventType>(event: T, payload: SceneEventMap[T]): void {
    listeners.get(event)?.forEach((handler) => handler(payload as SceneEventMap[SceneEventType]));
  }

  return { on, off, emit };
}
