'use client';

/**
 * Pipedrive — connection panel
 *
 * UI ONLY. Nothing here talks to Pipedrive yet; every action moves local state.
 * When the backend lands, the seams are:
 *
 *   handleConnect    -> POST the token to a server action that verifies it via
 *                       /users/me, then stores it encrypted (never in the client)
 *   handleTest       -> re-run that verify call against the stored token
 *   handleDisconnect -> soft-delete the connection row
 *
 * The token is held in component state only long enough to submit it. It is
 * never echoed back once the connection exists — the connected view shows the
 * domain and the account, not the secret.
 *
 * Pipeline options below are placeholders. Per the brief the real pipeline
 * structure has to be confirmed with the client before this is wired.
 *
 * Performance Optimizations:
 * - Uses React.memo to prevent unnecessary re-renders
 * - Memoized callbacks with useCallback
 */

import { memo, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Eye, EyeOff, Handshake, Info, Loader2, Plug, RefreshCw, Unplug } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Separator } from '@/shared/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import {
  IntegrationCard,
  IntegrationDetails,
  IntegrationToggle,
} from './IntegrationCard';
import type { PipedriveConnection } from '../types';

// ============================================
// CONSTANTS
// ============================================

/** Placeholder — replace once the client confirms their pipeline structure. */
const PIPELINE_OPTIONS = [
  { id: 'sales', label: 'Sales Pipeline' },
  { id: 'oem', label: 'OEM Pipeline' },
  { id: 'dealer', label: 'Dealer Pipeline' },
] as const;

const DEFAULT_PIPELINE_ID = PIPELINE_OPTIONS[0].id;

const formatStamp = (iso: string | null) =>
  iso ? format(new Date(iso), 'd MMM yyyy, HH:mm') : 'Never';

// ============================================
// COMPONENT
// ============================================

function PipedriveCardComponent() {
  const [connection, setConnection] = useState<PipedriveConnection | null>(null);
  const [token, setToken] = useState('');
  const [domain, setDomain] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  const canConnect = token.trim().length > 0 && domain.trim().length > 0;

  const handleConnect = useCallback(() => {
    if (!canConnect) {
      return;
    }
    setConnecting(true);

    // Stands in for the token-verification call.
    window.setTimeout(() => {
      setConnection({
        companyDomain: domain.trim(),
        connectedAs: 'andy@gesher.com',
        pipelineId: DEFAULT_PIPELINE_ID,
        connectedAt: new Date().toISOString(),
        lastSyncAt: null,
        pushQuotes: true,
        pullWonDeals: true,
      });

      // Drop the secret from client state the moment it is no longer needed.
      setToken('');
      setShowToken(false);
      setConnecting(false);
      toast.success('Pipedrive connected');
    }, 700);
  }, [canConnect, domain]);

  const handleTest = useCallback(() => {
    setTesting(true);
    window.setTimeout(() => {
      setTesting(false);
      toast.success('Connection healthy');
    }, 700);
  }, []);

  const handleDisconnect = useCallback(() => {
    setConnection(null);
    setDomain('');
    setDisconnectOpen(false);
    toast.success('Pipedrive disconnected');
  }, []);

  const handlePipelineChange = useCallback(
    (value: string) => setConnection((prev) => prev ? { ...prev, pipelineId: value } : null),
    []
  );

  const handlePushQuotesChange = useCallback(
    (checked: boolean) => setConnection((prev) => prev ? { ...prev, pushQuotes: checked } : null),
    []
  );

  const handlePullWonDealsChange = useCallback(
    (checked: boolean) => setConnection((prev) => prev ? { ...prev, pullWonDeals: checked } : null),
    []
  );

  // ============================================
  // DISCONNECTED
  // ============================================

  if (!connection) {
    return (
      <IntegrationCard
        name="Pipedrive"
        description="Two-way CRM sync. A sent quote creates or updates a deal; a won deal reflects back onto the quote."
        icon={Handshake}
        iconClassName="bg-sky-50 text-sky-700"
        status="disconnected"
        footer={
          <Button onClick={handleConnect} disabled={!canConnect || connecting}>
            {connecting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plug className="mr-2 h-4 w-4" />
            )}
            Connect
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pipedrive-domain">Company domain</Label>
            <Input
              id="pipedrive-domain"
              placeholder="gesher.pipedrive.com"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-form-type="other"
              data-lpignore="true"
            />
            <p className="text-xs text-muted-foreground">
              Found in your Pipedrive URL.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pipedrive-token">API token</Label>
            <div className="flex gap-2">
              <Input
                id="pipedrive-token"
                type={showToken ? 'text' : 'password'}
                placeholder="Paste your personal API token"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                className="font-mono"
                autoComplete="new-password"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-form-type="other"
                data-lpignore="true"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowToken((previous) => !previous)}
                aria-label={showToken ? 'Hide API token' : 'Show API token'}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Personal preferences &rsaquo; API in Pipedrive.
            </p>
          </div>
        </div>

        <div className="flex gap-3 rounded-lg border bg-muted/40 p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            The token is stored encrypted on the server and is never shown again once
            saved. Confirm the pipeline structure with the client before enabling sync.
          </p>
        </div>
      </IntegrationCard>
    );
  }

  // ============================================
  // CONNECTED
  // ============================================

  return (
    <>
      <IntegrationCard
        name="Pipedrive"
        description="Two-way CRM sync. A sent quote creates or updates a deal; a won deal reflects back onto the quote."
        icon={Handshake}
        iconClassName="bg-sky-50 text-sky-700"
        status="connected"
        footer={
          <>
            <Button variant="outline" onClick={handleTest} disabled={testing}>
              {testing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Test connection
            </Button>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setDisconnectOpen(true)}
            >
              <Unplug className="mr-2 h-4 w-4" />
              Disconnect
            </Button>
          </>
        }
      >
        <IntegrationDetails
          items={[
            { label: 'Domain', value: connection.companyDomain },
            { label: 'Connected as', value: connection.connectedAs },
            { label: 'Connected', value: formatStamp(connection.connectedAt) },
            { label: 'Last sync', value: formatStamp(connection.lastSyncAt) },
            { label: 'API token', value: <span className="font-mono text-xs">••••••••</span> },
          ]}
        />

        <Separator />

        <div className="max-w-xs space-y-2">
          <Label htmlFor="pipedrive-pipeline">Target pipeline</Label>
          <Select
            value={connection.pipelineId}
            onValueChange={handlePipelineChange}
          >
            <SelectTrigger id="pipedrive-pipeline">
              <SelectValue placeholder="Select pipeline" />
            </SelectTrigger>
            <SelectContent>
              {PIPELINE_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Where deals created from quotes land.
          </p>
        </div>

        <Separator />

        <div className="space-y-4">
          <p className="text-sm font-medium text-foreground">What syncs</p>

          <IntegrationToggle
            label="Quote sent creates or updates a deal"
            description="Sending a quote pushes it to Pipedrive as a deal on the pipeline above."
            checked={connection.pushQuotes}
            onCheckedChange={handlePushQuotesChange}
          />

          <Separator />

          <IntegrationToggle
            label="Deal won updates the quote"
            description="Marking a deal won in Pipedrive reflects onto the linked quote and sales order."
            checked={connection.pullWonDeals}
            onCheckedChange={handlePullWonDealsChange}
          />
        </div>
      </IntegrationCard>

      <AlertDialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Pipedrive?</AlertDialogTitle>
            <AlertDialogDescription>
              Quotes will stop creating deals and won deals will stop updating quotes. The
              stored API token is removed — you&apos;ll need a new one to reconnect. Deals
              already in Pipedrive are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Export memoized component
export const PipedriveCard = memo(PipedriveCardComponent);
