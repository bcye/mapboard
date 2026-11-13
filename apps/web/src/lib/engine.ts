import { createContext, use } from "react";
import type { Engine } from "engine";

export const EngineContext = createContext<Engine | null>(null);

export function useEngine(): Engine {
  const engine = use(EngineContext);
  if (!engine) throw new Error("useEngine must be used inside EngineContext");
  return engine;
}
