export type CatalogViewMode = 'grid' | 'table'

export type CatalogOrigin = {
  url: string
  viewMode?: CatalogViewMode
}

export type CatalogNavigationIntent = 'return-to-catalog' | 'new-catalog-navigation'

export type CatalogRouteState = {
  catalogOrigin?: CatalogOrigin
  catalogNavigationIntent?: CatalogNavigationIntent
}

type CatalogSnapshot = CatalogOrigin & {
  scrollY: number
}

const SNAPSHOT_KEY = 'acervo:catalog-return'

function isCatalogUrl(value: unknown): value is string {
  return typeof value === 'string' && (value === '/acervo' || value.startsWith('/acervo?'))
}

export function createCatalogOrigin(url: string, viewMode?: CatalogViewMode): CatalogOrigin | undefined {
  if (!isCatalogUrl(url)) return undefined
  return { url, viewMode }
}

export function getCatalogOrigin(state: unknown): CatalogOrigin | undefined {
  const origin = (state as CatalogRouteState | null)?.catalogOrigin
  if (!origin || !isCatalogUrl(origin.url)) return undefined
  return origin
}

export function detailRouteState(origin: CatalogOrigin | undefined): CatalogRouteState | undefined {
  return origin ? { catalogOrigin: origin } : undefined
}

export function catalogRouteState(intent: CatalogNavigationIntent): CatalogRouteState {
  return { catalogNavigationIntent: intent }
}

export function saveCatalogSnapshot(origin: CatalogOrigin, scrollY: number) {
  try {
    const snapshot: CatalogSnapshot = { ...origin, scrollY: Math.max(0, Math.round(scrollY)) }
    sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot))
  } catch {
    // Storage pode estar indisponível; a URL ainda preserva os filtros.
  }
}

export function readCatalogSnapshot(url: string): CatalogSnapshot | undefined {
  try {
    const raw = sessionStorage.getItem(SNAPSHOT_KEY)
    if (!raw) return undefined
    const snapshot = JSON.parse(raw) as CatalogSnapshot
    if (!isCatalogUrl(snapshot.url) || snapshot.url !== url || !Number.isFinite(snapshot.scrollY)) return undefined
    return snapshot
  } catch {
    return undefined
  }
}

export function clearCatalogSnapshot() {
  try {
    sessionStorage.removeItem(SNAPSHOT_KEY)
  } catch {
    // Storage pode estar indisponível.
  }
}
