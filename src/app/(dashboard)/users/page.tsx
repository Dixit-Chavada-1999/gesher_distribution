/**
 * Users Management Page
 *
 * Page for managing system users.
 */

import { Metadata } from 'next';

import { PageHeader } from '@/shared/components/layout';
import { UsersContent } from '@/features/users/components';

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

export default function UsersPage() {
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

      <UsersContent />
    </div>
  );
}
