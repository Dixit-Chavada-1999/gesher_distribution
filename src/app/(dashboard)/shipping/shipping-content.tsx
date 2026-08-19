'use client';

/**
 * Shipping Content
 *
 * Client component for shipping tracking page.
 */

import { useEffect, useState } from 'react';
import {
  Ship,
  Mail,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Package,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { getShippingEmails, getShippingStats } from '@/features/shipping/actions';
import type { ShippingEmailWithInbound } from '@/features/shipping/types';

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
  booked: 'bg-gray-100 text-gray-800',
  container_picked: 'bg-blue-100 text-blue-800',
  loaded_on_vessel: 'bg-blue-100 text-blue-800',
  departed_origin: 'bg-indigo-100 text-indigo-800',
  in_transit: 'bg-purple-100 text-purple-800',
  arrived_port: 'bg-green-100 text-green-800',
  customs_clearance: 'bg-yellow-100 text-yellow-800',
  on_rail: 'bg-orange-100 text-orange-800',
  at_ramp: 'bg-teal-100 text-teal-800',
  out_for_delivery: 'bg-cyan-100 text-cyan-800',
  delivered: 'bg-green-100 text-green-800',
  exception: 'bg-red-100 text-red-800',
};

// Format status for display
function formatStatus(status: string | null): string {
  if (!status) {
    return 'Unknown';
  }
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Format date for display
function formatDate(dateStr: string | null): string {
  if (!dateStr) {
    return '-';
  }
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ShippingContent() {
  const [emails, setEmails] = useState<ShippingEmailWithInbound[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    processed: 0,
    unprocessed: 0,
    matched: 0,
    unmatched: 0,
    withIssues: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [emailsResult, statsResult] = await Promise.all([
        getShippingEmails({ page: 1, limit: 50 }),
        getShippingStats(),
      ]);

      if (emailsResult.success && emailsResult.data) {
        setEmails(emailsResult.data.data);
      }

      if (statsResult.success && statsResult.data) {
        setStats(statsResult.data);
      }
    } catch (error) {
      console.error('Error fetching shipping data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shipping Tracking</h1>
          <p className="text-muted-foreground">
            Monitor shipping emails and container tracking updates
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Emails</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.unprocessed} pending processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Matched</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.matched}</div>
            <p className="text-xs text-muted-foreground">
              Linked to shipments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unmatched</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.unmatched}</div>
            <p className="text-xs text-muted-foreground">
              Needs manual review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.withIssues}</div>
            <p className="text-xs text-muted-foreground">
              Requires attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Email Setup Instructions */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Ship className="h-8 w-8 text-blue-600" />
            <div>
              <h3 className="font-semibold text-blue-900">
                Forward Shipping Emails Here
              </h3>
              <p className="text-sm text-blue-700 mt-1">
                Forward shipping tracking emails from SEAIR/logistics providers to:
              </p>
              <code className="mt-2 block bg-white px-3 py-2 rounded border border-blue-200 text-blue-900 font-mono text-sm">
                shipping@inbound.gesher.dev-build.in
              </code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shipping Emails Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Shipping Emails
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : emails.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No shipping emails received yet.</p>
              <p className="text-sm">
                Forward shipping emails to start tracking.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Received</TableHead>
                  <TableHead>Container #</TableHead>
                  <TableHead>SO #</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>ETA</TableHead>
                  <TableHead>LFD</TableHead>
                  <TableHead>Matched</TableHead>
                  <TableHead>Issues</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emails.map((email) => (
                  <TableRow key={email.id}>
                    <TableCell className="text-sm">
                      {formatDate(email.inbound_emails?.received_at || email.created_at)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {email.container_number || '-'}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {email.so_number || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          STATUS_COLORS[email.detected_status || ''] ||
                          'bg-gray-100'
                        }
                      >
                        {formatStatus(email.detected_status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(email.eta_port)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(email.lfd_date)}
                    </TableCell>
                    <TableCell>
                      {email.is_matched ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Yes
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                          <Clock className="h-3 w-3 mr-1" />
                          No
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {email.has_issue ? (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {email.issue_type?.replace('_', ' ')}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
