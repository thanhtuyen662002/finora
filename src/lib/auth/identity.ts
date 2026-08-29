export function resolveDisplayIdentity(profile: any, user: any): string {
  return profile?.display_name ||
         user?.user_metadata?.full_name ||
         user?.user_metadata?.name ||
         user?.email?.split('@')[0] ||
         'Người dùng';
}
