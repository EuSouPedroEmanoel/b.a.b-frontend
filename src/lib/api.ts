import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

function readCookie(name: string): string | null {
  const prefix = `${encodeURIComponent(name)}=`
  const value = document.cookie.split('; ').find((item) => item.startsWith(prefix))
  return value ? decodeURIComponent(value.slice(prefix.length)) : null
}

api.interceptors.request.use((config) => {
  const method = (config.method ?? 'get').toUpperCase()
  const csrf = readCookie('csrf_token')
  if (csrf && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) config.headers['X-CSRF-Token'] = csrf
  return config
})

// Queue for 401 refresh (W3C: anunciar erro via LiveRegion, não alert)
let isRefreshing = false
let failedQueue: Array<{
  resolve: (v: unknown) => void
  reject: (e: unknown) => void
}> = []

function processQueue(error: unknown) {
  failedQueue.forEach((p) => {
    if (error) p.reject(error)
    else p.resolve(null)
  })
  failedQueue = []
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config as { _retry?: boolean; headers: Record<string, string>; url?: string } & typeof error.config
    // 401 em /auth/* (login com credencial errada) é erro esperado — não tenta refresh nem recarrega página
    const isAuthRequest = typeof original.url === 'string' && original.url.includes('/auth/')
    if (isAuthRequest) return Promise.reject(error)
    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then(() => {
            return api(original)
          })
          .catch((e) => Promise.reject(e))
      }
      original._retry = true
      isRefreshing = true
      try {
        await axios.post(
          `${import.meta.env.VITE_API_URL ?? '/api'}/auth/refresh`,
          undefined,
          { withCredentials: true, headers: { 'X-CSRF-Token': readCookie('csrf_token') ?? '' } },
        )
        processQueue(null)
        return api(original)
      } catch (e) {
        processQueue(e)
        sessionStorage.removeItem('guest_school_name')
        sessionStorage.removeItem('guest_school_code')
        window.location.href = '/entrar'
        return Promise.reject(e)
      } finally {
        isRefreshing = false
      }
    }
    return Promise.reject(error)
  },
)

export default api
