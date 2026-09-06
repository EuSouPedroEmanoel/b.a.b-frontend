import { beforeEach, describe, expect, it } from 'vitest'
import {
  catalogRouteState,
  clearCatalogSnapshot,
  createCatalogOrigin,
  detailRouteState,
  getCatalogOrigin,
  readCatalogSnapshot,
  saveCatalogSnapshot,
} from '@/lib/catalogNavigation'

describe('catalog navigation contract', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('preserves the original catalog through a chain of recommended details', () => {
    const origin = createCatalogOrigin('/acervo?q=machado&genre_id=3&page=2', 'grid')
    expect(origin).toBeDefined()

    const detailA = detailRouteState(origin)
    const detailB = detailRouteState(getCatalogOrigin(detailA))
    const detailC = detailRouteState(getCatalogOrigin(detailB))

    expect(getCatalogOrigin(detailC)).toEqual(origin)
    expect(getCatalogOrigin(detailC)?.url).toBe('/acervo?q=machado&genre_id=3&page=2')
    expect(getCatalogOrigin(detailC)?.viewMode).toBe('grid')
  })

  it('uses an explicit return intent instead of browser history', () => {
    const state = catalogRouteState('return-to-catalog')

    expect(state).toEqual({ catalogNavigationIntent: 'return-to-catalog' })
    expect(state.catalogNavigationIntent).not.toBe('new-catalog-navigation')
  })

  it('marks filter badges as a new catalog navigation', () => {
    expect(catalogRouteState('new-catalog-navigation')).toEqual({
      catalogNavigationIntent: 'new-catalog-navigation',
    })
  })

  it('restores scroll only for the matching catalog origin', () => {
    const origin = createCatalogOrigin('/acervo?q=clarice&state=available', 'table')
    expect(origin).toBeDefined()
    saveCatalogSnapshot(origin!, 742.6)

    expect(readCatalogSnapshot(origin!.url)).toEqual({
      ...origin,
      scrollY: 743,
    })
    expect(readCatalogSnapshot('/acervo?q=other')).toBeUndefined()
  })

  it('clears a consumed return snapshot', () => {
    const origin = createCatalogOrigin('/acervo?page=4')
    expect(origin).toBeDefined()
    saveCatalogSnapshot(origin!, 320)

    clearCatalogSnapshot()

    expect(readCatalogSnapshot(origin!.url)).toBeUndefined()
  })

  it('does not create an origin for a direct detail or unrelated route', () => {
    expect(getCatalogOrigin(undefined)).toBeUndefined()
    expect(createCatalogOrigin('/acervo/42')).toBeUndefined()
    expect(createCatalogOrigin('/entrar')).toBeUndefined()
    expect(detailRouteState(undefined)).toBeUndefined()
  })
})
