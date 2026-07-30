/**
 * Settings Page
 *
 * Application settings and preferences.
 * Currently shows only Integration settings (QuickBooks & Pipedrive).
 */

import { Metadata } from 'next';
import { PageHeader } from '@/shared/components/layout';
import { IntegrationsSettings } from '@/features/integrations';

// ============================================
// METADATA
// ============================================

export const metadata: Metadata = {
  title: 'Settings | Gesher Distribution',
  description: 'Application settings and preferences',
};

// ============================================
// PAGE
// ============================================

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Settings"
        description="Manage your application preferences"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Settings' },
        ]}
      />

      <div className="grid gap-6">
        {/* Integrations - QuickBooks & Pipedrive */}
        <IntegrationsSettings />
      </div>
    </div>
  );
}
