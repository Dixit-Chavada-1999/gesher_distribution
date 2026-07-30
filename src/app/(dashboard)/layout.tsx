/**
 * Dashboard Layout
 *
 * Layout for all authenticated dashboard pages.
 * Includes sidebar, header, and main content area.
 *
 * Performance Optimization:
 * - Uses cached profile from cookie to avoid DB calls on every page
 * - Profile is cached during login (Server Action)
 * - Only fetches from DB if cache is missing
 */

import { redirect } from 'next/navigation';
import { getUser } from '@/shared/lib/supabase/server';
import { getAppUserByAuthId } from '@/shared/lib/auth';
import { getCachedProfile } from '@/shared/lib/auth/profile-cache';
import { AppLayout } from '@/shared/components/layout';
import { AuthHydrator } from '@/shared/components/auth';

// ============================================
// LAYOUT
// ============================================

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check authentication
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  // Try to get cached profile first (fast - no DB call)
  let appUser = await getCachedProfile();

  // If no cached profile, fetch from database
  // Note: Profile caching happens during login (Server Action)
  // If cache is missing, we fetch from DB but don't set cache here
  // (cookies can't be set in Server Components)
  if (!appUser) {
    appUser = await getAppUserByAuthId(user.id);
  }

  return (
    <AuthHydrator appUser={appUser}>
      <AppLayout>{children}</AppLayout>
    </AuthHydrator>
  );
}
