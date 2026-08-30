/**
 * Proxy de imagem via wsrv.nl – redimensiona para w=400 (2:3 → 400x600) e converte para WebP.
 * Evita baixar originais grandes e aproveita cache CDN `Cache-Control: immutable` do wsrv.
 */
export function getCoverProxyUrl(url: string | null | undefined, w = 400): string | undefined {
  if (!url) return undefined
  const trimmed = url.trim()
  if (!trimmed) return undefined
  let effW = w
  // picsum seed/random com w=400 dá 404 intermitente, w=800 tem cache 200; força 800 para picsum
  if (trimmed.includes('picsum.photos')) effW = 800
  const h = Math.round((effW * 3) / 2) // 2:3
  return `https://wsrv.nl/?url=${encodeURIComponent(trimmed)}&w=${effW}&h=${h}&output=webp&q=80&fit=cover`
}
