import type { Staff, TeamRole } from './model'
export const teamRoleLabels: Record<TeamRole, string> = { manager: 'Manager', washer: 'Washer' }
export function canAssignWash(member: Staff) {
  return (
    member.active !== false &&
    member.region !== 'Unassigned' &&
    member.roles?.includes('washer') === true
  )
}
export function teamRolesLabel(member: Staff) {
  return member.roles?.map((r) => teamRoleLabels[r]).join(' · ') || 'Roles not set'
}
