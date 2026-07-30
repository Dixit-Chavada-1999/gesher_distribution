/**
 * Logo Component
 *
 * Application logo with optional text.
 * Supports collapsed mode for sidebar.
 */

import Link from 'next/link';

import { cn } from '@/shared/lib/utils';

// ============================================
// TYPES
// ============================================

interface LogoProps {
  /** Show only icon (collapsed mode) */
  collapsed?: boolean;
  /** Custom class name */
  className?: string;
  /** Link destination */
  href?: string;
  /** Show as link or static element */
  asLink?: boolean;
  /** Variant for different contexts */
  variant?: 'sidebar' | 'default';
}

// ============================================
// COMPONENT
// ============================================

export function Logo({
  collapsed = false,
  className,
  href = '/dashboard',
  asLink = true,
  variant = 'sidebar',
}: LogoProps) {
  const isSidebar = variant === 'sidebar';

  const content = (
    <div
      className={cn(
        'flex items-center gap-3 font-semibold',
        collapsed ? 'justify-center' : 'justify-start',
        className
      )}
    >
      {/* Logo Icon */}
      <div
        className={cn(
          'flex items-center justify-center rounded-xl shadow-sm',
          isSidebar
            ? 'h-8 w-8 bg-sidebar-primary text-sidebar-primary-foreground'
            : 'h-10 w-10 bg-gradient-to-br from-blue-600 to-blue-700 text-white'
        )}
      >
        <svg
          className={cn(isSidebar ? 'h-5 w-5' : 'h-6 w-6')}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>

      {/* Logo Text */}
      {!collapsed && (
        <div className="flex flex-col">
          <span
            className={cn(
              'font-bold leading-none tracking-tight',
              isSidebar
                ? 'text-base text-sidebar-primary-foreground'
                : 'text-lg text-slate-900'
            )}
          >
            Gesher
          </span>
          <span
            className={cn(
              'font-medium leading-none mt-0.5',
              isSidebar
                ? 'text-xs text-sidebar-foreground/70'
                : 'text-xs text-slate-500'
            )}
          >
            Distribution
          </span>
        </div>
      )}
    </div>
  );

  if (asLink) {
    return (
      <Link
        href={href}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {content}
      </Link>
    );
  }

  return content;
}
