function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
    hash |= 0
  }
  return Math.abs(hash)
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function generateFallbackCoverDataUrl(title: string, width = 320, height = 480): string {
  const safeTitle = (title ?? '').trim() || 'Sem título'
  const hash = hashString(safeTitle)
  const hue = hash % 360
  const hue2 = (hue + 30) % 360
  // cores idênticas a getBookCoverGradient 25%/15%
  const c1 = `hsl(${hue}, 65%, 25%)`
  const c2 = `hsl(${hue2}, 65%, 15%)`

  // escapa para foreignObject HTML
  const escaped = escapeXml(safeTitle)

  // SVG com gradiente + overlay + ícone + título com line-clamp-3 via foreignObject
  // viewBox fixo para escalar via object-cover
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
  <defs>
    <linearGradient id="g" gradientTransform="rotate(135)">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" rx="0" fill="url(#g)"/>
  <rect width="${width}" height="${height}" fill="black" opacity="0.1"/>
  <!-- ícone BookOpen centralizado acima do título -->
  <g transform="translate(${width / 2 - 16} ${height / 2 - 40})" opacity="0.85">
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  </g>
  <foreignObject x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.52)}" width="${Math.round(width * 0.84)}" height="90">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; font-weight:700; font-size:14px; line-height:1.3; color:white; text-align:center; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; text-shadow:0 1px 2px rgba(0,0,0,0.6); word-break:break-word;">${escaped}</div>
  </foreignObject>
</svg>`

  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

// mantém compatibilidade com import anterior se necessário
export const getFallbackCoverDataUrl = generateFallbackCoverDataUrl
