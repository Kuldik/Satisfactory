import type { RollingStockKind } from "./trainRollingStockCatalog.ts";

const DEFAULT_STORAGE_PREFIX = "factory-builder:rolling-stock-default:";

export function getRollingStockDefaultId(kind: RollingStockKind): string | null {
  return localStorage.getItem(`${DEFAULT_STORAGE_PREFIX}${kind}`);
}

export function setRollingStockDefaultId(
  kind: RollingStockKind,
  variantId: string | null,
): void {
  const key = `${DEFAULT_STORAGE_PREFIX}${kind}`;
  if (variantId) {
    localStorage.setItem(key, variantId);
  } else {
    localStorage.removeItem(key);
  }
}
