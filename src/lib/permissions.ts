export type PermissionRole = string | null | undefined

const PERSONAL_READER_ROLES = new Set(['student', 'teacher'])

/** Capacidade de consultar e operar dados pessoais de circulação. */
export function hasPersonalReaderCapability(role: PermissionRole) {
  return role != null && PERSONAL_READER_ROLES.has(role)
}
