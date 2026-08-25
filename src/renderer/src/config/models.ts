/**
 * Fallback speed/depth choices shown before /api/models responds.
 *
 * Users never see model or vendor names, so these are labelled by what they
 * do. Both the command input and the prompt input read this list, so they
 * cannot drift apart.
 */
export interface ModelOption {
  id: string
  label: string
}

export const FALLBACK_MODELS: ModelOption[] = [{ id: 'auto', label: 'Automatic' }]
