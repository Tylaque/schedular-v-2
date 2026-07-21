export type RoleInfo = {
  id: string;
  role: "admin" | "super_admin" | "org_owner";
};

export function canViewAllProjects(role: string): boolean {
  return role === "org_owner" || role === "super_admin";
}

export function getScopeFilter(user: RoleInfo): { ownerId?: string } {
  if (canViewAllProjects(user.role)) return {};
  return { ownerId: user.id };
}

export function isOrgOwner(role: string): boolean {
  return role === "org_owner";
}

export function isSuperAdmin(role: string): boolean {
  return role === "super_admin";
}

export function isAdmin(role: string): boolean {
  return role === "admin";
}

export function canManageProject(
  user: RoleInfo,
  project: { ownerId: string | null }
): boolean {
  if (canViewAllProjects(user.role)) return true;
  return project.ownerId === user.id;
}
