import "server-only";
import type { ProviderAdapter, ProviderCode } from "./types";
import { qcstAdapter } from "./qcst";
import { vbrAdapter } from "./vbr";
import { canbosoAdapter } from "./canboso";

const REGISTRY: Record<ProviderCode, ProviderAdapter> = {
  QCST: qcstAdapter,
  VBR: vbrAdapter,
  CANBOSO: canbosoAdapter,
};

export function getAdapter(code: string): ProviderAdapter | null {
  const c = code.trim().toUpperCase() as ProviderCode;
  return c in REGISTRY ? REGISTRY[c] : null;
}

export { qcstAdapter, vbrAdapter, canbosoAdapter };
export * from "./types";