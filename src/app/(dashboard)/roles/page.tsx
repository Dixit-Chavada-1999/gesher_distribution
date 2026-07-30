/**
 * Roles Management Page
 *
 * Page for managing user roles and permissions.
 */

import { Metadata } from 'next';
import { RolesPageContent } from './roles-content';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Roles & Permissions | Gesher Distribution',
  description: 'Manage user roles and permissions',
};

// ============================================
// PAGE
// ============================================

export default function RolesPage() {
  return <RolesPageContent />;
}
