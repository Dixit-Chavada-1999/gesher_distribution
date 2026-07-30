/**
 * Audit Logs Page
 *
 * View system audit logs and user activity.
 */

import { Metadata } from 'next';
import { AuditLogsContent } from './audit-logs-content';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Audit Logs | Gesher Distribution',
  description: 'View system audit logs and activity',
};

// ============================================
// PAGE
// ============================================

export default function AuditLogsPage() {
  return <AuditLogsContent />;
}
