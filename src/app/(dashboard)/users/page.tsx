/**
 * Users Management Page
 *
 * Page for managing system users.
 *
 * Performance Optimizations:
 * - Server-side data fetching for initial load (better FCP/LCP)
 * - Data passed to client components as initialData for React Query hydration
 */

import { Metadata } from 'next';

import { PageHeader } from '@/shared/components/layout';
import { UsersContent } from '@/features/users/components';
import { getUsers, getUserStatusCounts } from '@/features/users/actions';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Users Management | Gesher Distribution',
  description: 'Manage system users and permissions',
};

// ============================================
// PAGE
// ============================================

export default async function UsersPage() {
  // Fetch initial data server-side (parallel calls)
  const [usersResult, countsResult] = await Promise.all([
    getUsers({ page: 1, limit: 10 }),
    getUserStatusCounts(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage users and their access permissions"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Users' },
        ]}
      />

      <UsersContent
        initialUsers={usersResult.success ? usersResult.data : null}
        initialCounts={countsResult.success ? countsResult.data : null}
      />
    </div>
  );
}
