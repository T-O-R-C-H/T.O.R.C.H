/** Backend base URL — override with VITE_TORCH_API_URL in production builds if needed */
export const API_BASE = import.meta.env.VITE_TORCH_API_URL ?? 'http://localhost:8000'
export const WS_URL = API_BASE.replace(/^http/, 'ws') + '/ws'
