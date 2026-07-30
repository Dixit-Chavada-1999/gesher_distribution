/**
 * 403 Forbidden Page
 *
 * Displayed when user doesn't have permission to access a resource.
 */

import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: '403 - Forbidden | Gesher Distribution',
  description: 'Access denied',
};

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-10 w-10 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
        </div>

        {/* Code */}
        <p className="text-sm font-medium text-red-600">403</p>

        {/* Title */}
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
          Access Denied
        </h1>

        {/* Description */}
        <p className="mt-4 text-muted-foreground">
          You don&apos;t have permission to access this resource. If you believe
          this is a mistake, please contact your administrator.
        </p>

        {/* Actions */}
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link href="/dashboard">
            <Button>Go to Dashboard</Button>
          </Link>
          <Link href="/">
            <Button variant="outline">Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
