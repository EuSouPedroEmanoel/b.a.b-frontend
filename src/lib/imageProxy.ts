/**
 * Proxy de imagens controlado pelo backend. A origem é validada por allowlist
 * no servidor, sem enviar dados da conta ou da escola ao terceiro.
 */
export function getCoverProxyUrl(url: string | null | undefined, w = 400): string | undefined {
  if (!url) return undefined
  const trimmed = url.trim()
  if (!trimmed) return undefined
  const apiBase = import.meta.env.VITE_API_URL ?? '/api'
  return `${apiBase}/images/proxy?url=${encodeURIComponent(trimmed)}&w=${w}`
}
