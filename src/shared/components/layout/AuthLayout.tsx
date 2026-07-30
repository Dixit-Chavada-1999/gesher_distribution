/**
 * AuthLayout Component
 *
 * Layout for authentication pages (login, forgot password, etc.).
 * Centered card layout with logo.
 */

import { cn } from '@/shared/lib/utils';
import { Logo } from './Logo';

// ============================================
// TYPES
// ============================================

interface AuthLayoutProps {
  /** Page content */
  children: React.ReactNode;
  /** Page title */
  title: string;
  /** Page description */
  description?: string;
  /** Custom class name */
  className?: string;
}

// ============================================
// COMPONENT
// ============================================

export function AuthLayout({
  children,
  title,
  description,
  className,
}: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Subtle Background Pattern */}
      <div className="absolute inset-0 -z-10 opacity-40 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:40px_40px]" />

      {/* Main Content */}
      <main className="flex flex-1 items-center justify-center p-4">
        <div className={cn('w-full max-w-[420px] space-y-8', className)}>
          {/* Logo */}
          <div className="flex justify-center">
            <Logo asLink={false} variant="default" />
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-200/50">
            {/* Header */}
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                {title}
              </h1>
              {description && (
                <p className="mt-2 text-sm text-slate-500">
                  {description}
                </p>
              )}
            </div>

            {/* Form Content */}
            {children}
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-slate-400">
            © {new Date().getFullYear()} Gesher Distribution. All rights reserved.
          </p>
        </div>
      </main>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * AuthLayout.Skeleton
 * Loading state for auth layout
 */
function AuthLayoutSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-[420px] space-y-8">
          {/* Logo Skeleton */}
          <div className="flex justify-center">
            <div className="h-10 w-40 animate-pulse rounded-lg bg-slate-200" />
          </div>

          {/* Card Skeleton */}
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-200/50">
            <div className="mb-8 space-y-3 text-center">
              <div className="mx-auto h-7 w-40 animate-pulse rounded-lg bg-slate-200" />
              <div className="mx-auto h-4 w-64 animate-pulse rounded-lg bg-slate-100" />
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                <div className="h-11 w-full animate-pulse rounded-lg bg-slate-100" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
                <div className="h-11 w-full animate-pulse rounded-lg bg-slate-100" />
              </div>
              <div className="h-12 w-full animate-pulse rounded-lg bg-slate-200" />
            </div>
          </div>

          {/* Footer Skeleton */}
          <div className="flex justify-center">
            <div className="h-4 w-52 animate-pulse rounded bg-slate-200" />
          </div>
        </div>
      </main>
    </div>
  );
}

AuthLayout.Skeleton = AuthLayoutSkeleton;
