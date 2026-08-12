'use client';

/**
 * Sidebar Component
 *
 * Modern dark sidebar with navigation sections.
 */

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  Shield,
  FileText,
  ShoppingCart,
  Settings,
  X,
  LogOut,
  ChevronRight,
  Inbox,
  // Only used by the hidden Permissions entry — uncomment with it.
  // Key,
  Package,
  MapPin,
  Building2,
  // DollarSign,
FileSignature,
  ClipboardList, // Purchase Orders
  Truck, // Operations dashboard
  // Receipt, // Uncomment when Invoices module is enabled
  Factory, // Suppliers
  ClipboardCheck, // Pick Tickets
} from 'lucide-react';

import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/components/ui/button';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { useSidebarStore, useAuthStore } from '@/shared/stores';
import { logoutAction } from '@/features/auth/actions';

// Navigation configuration
const NAV_SECTIONS = [
  {
    title: 'Main',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        permission: 'dashboard.view_module',
      },
      {
        id: 'inbox',
        label: 'Inbox',
        href: '/inbox',
        icon: Inbox,
        permission: 'quotes.view_module', // Uses quotes permission for now
      },
    ],
  },
  // Catalog section is temporarily hidden from the sidebar.
  // The routes still work if visited directly — only the nav entries are gone.
  // Uncomment this block to bring it back.
  {
    title: 'Catalog',
    items: [
      {
        id: 'products',
        label: 'Products',
        href: '/products',
        icon: Package,
        permission: 'products.view_module',
      },
      {
        id: 'locations',
        label: 'Locations',
        href: '/locations',
        icon: MapPin,
        permission: 'locations.view_module',
      },
      {
        id: 'customers',
        label: 'Customers',
        href: '/customers',
        icon: Building2,
        permission: 'customers.view_module',
      },
      {
        id: 'suppliers',
        label: 'Suppliers',
        href: '/suppliers',
        icon: Factory,
        permission: 'suppliers.view_module',
      },
  //     {
  //       id: 'pricing',
  //       label: 'Pricing',
  //       href: '/pricing',
  //       icon: DollarSign,
  //       permission: 'pricing.view_module',
  //     },
    ],
  },
  {
    title: 'Sales',
    items: [
      {
        id: 'quotes',
        label: 'Quotes',
        href: '/quotes',
        icon: FileSignature,
        permission: 'quotes.view_module',
      },
      {
        id: 'sales-orders',
        label: 'Sales Orders',
        href: '/sales-orders',
        icon: ShoppingCart,
        permission: 'orders.view_module',
      },
      // {
      //   id: 'invoices',
      //   label: 'Invoices',
      //   href: '/invoices',
      //   icon: Receipt,
      //   permission: 'invoices.view_module',
      // },
    ],
  },
{
    title: 'Operations',
    items: [
      {
        id: 'operations',
        label: 'Operations',
        href: '/operations',
        icon: Truck,
        permission: 'dashboard.view_module', // Uses dashboard permission for now
      },
      {
        id: 'pick-tickets',
        label: 'Pick Tickets',
        href: '/pick-tickets',
        icon: ClipboardCheck,
        permission: 'pick_tickets.view_module',
      },
    ],
  },
  {
    title: 'Procurement',
    items: [
      {
        id: 'purchase-orders',
        label: 'Purchase Orders',
        href: '/purchase-orders',
        icon: ClipboardList,
        permission: 'purchase_orders.view_module',
      },
],
  },
  // Shipments section is temporarily hidden from the sidebar.
  // Uncomment this block when Shipments module is enabled.
  // {
  //   title: 'Shipments',
  //   items: [
  //     {
  //       id: 'shipments',
  //       label: 'Shipments',
  //       href: '/shipments',
  //       icon: Truck,
  //       permission: 'shipments.view_module',
  //     },
  //   ],
  // },
  {
    title: 'Internal',
    items: [
      {
        id: 'users',
        label: 'Users',
        href: '/users',
        icon: Users,
        permission: 'users.view_module',
      },
      {
        id: 'roles',
        label: 'Roles',
        href: '/roles',
        icon: Shield,
        permission: 'roles.view_module',
      },
      // Permissions is temporarily hidden from the sidebar.
      // The route still works if visited directly — only the nav entry is gone.
      // Uncomment this block (and the Key icon import) to bring it back.
      // {
      //   id: 'permissions',
      //   label: 'Permissions',
      //   href: '/permissions',
      //   icon: Key,
      //   permission: 'permissions.view_module',
      // },
      {
        id: 'audit-logs',
        label: 'Audit Logs',
        href: '/audit-logs',
        icon: FileText,
        permission: 'audit.view_module',
      },
    ],
  },
  {
    title: 'Settings',
    items: [
      {
        id: 'settings',
        label: 'Settings',
        href: '/settings',
        icon: Settings,
        permission: 'settings.view_module',
      },
    ],
  },
];

export function Sidebar() {
  const [hasMounted, setHasMounted] = useState(false);
  const pathname = usePathname();
  const { hasPermission, logout } = useAuthStore();
  const { isCollapsed, isMobileOpen, closeMobile } = useSidebarStore();

  // Handle hydration - only use client state after mount
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Use default state on server to prevent hydration mismatch
  const collapsed = hasMounted ? isCollapsed : false;
  const mobileOpen = hasMounted ? isMobileOpen : false;

  const handleLogout = async () => {
    // Clear client-side state
    logout();
    // Call server action to sign out and clear cookies
    await logoutAction();
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') {return pathname === href;}
    return pathname.startsWith(href);
  };

  // Skeleton loader for nav items
  const NavSkeleton = () => (
    <div className="space-y-6 animate-pulse">
      {[1, 2, 3].map((section) => (
        <div key={section}>
          <div className="mb-2 px-3 h-3 w-16 bg-[hsl(var(--sidebar-accent))] rounded" />
          <div className="space-y-1">
            {[1, 2].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5"
              >
                <div className="h-5 w-5 bg-[hsl(var(--sidebar-accent))] rounded" />
                <div className="h-4 w-24 bg-[hsl(var(--sidebar-accent))] rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4 sidebar-scroll">
        {/* Show skeleton until hydrated */}
        {!hasMounted ? (
          <NavSkeleton />
        ) : (
        <nav className="space-y-6">
          {NAV_SECTIONS.map((section) => {
            // Filter items by permissions
            const filteredItems = section.items.filter(
              (item) => !item.permission || hasPermission(item.permission)
            );

            if (filteredItems.length === 0) {return null;}

            return (
              <div key={section.title}>
                {/* Section Title */}
                {!collapsed && (
                  <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--sidebar-muted))]">
                    {section.title}
                  </h3>
                )}

                {/* Section Items */}
                <div className="space-y-1">
                  {filteredItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);

                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        className={cn(
                          'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                          active
                            ? 'bg-[hsl(var(--sidebar-primary))] text-white shadow-sm'
                            : 'text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-white hover:translate-x-1',
                          collapsed && 'justify-center px-2 hover:translate-x-0'
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        <Icon className={cn(
                          "h-5 w-5 shrink-0 transition-transform duration-200",
                          !active && "group-hover:scale-110"
                        )} />
                        {!collapsed && <span>{item.label}</span>}
                        {!collapsed && active && (
                          <ChevronRight className="ml-auto h-4 w-4" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        )}
      </ScrollArea>

      {/* Sign Out Button */}
      <div className="border-t border-[hsl(var(--sidebar-border))] p-3">
        <button
          onClick={handleLogout}
          className={cn(
            'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
            'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))]',
            'hover:bg-red-500/90 hover:text-white transition-all duration-200',
            collapsed && 'justify-center px-2'
          )}
        >
          <LogOut className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden lg:flex lg:flex-col',
          'bg-[hsl(var(--sidebar-background))] border-r border-[hsl(var(--sidebar-border))] shadow-sm',
          collapsed ? 'lg:w-[70px]' : 'lg:w-64',
          'transition-all duration-300'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 lg:hidden',
          'bg-[hsl(var(--sidebar-background))] border-r border-[hsl(var(--sidebar-border))]',
          'transition-transform duration-300',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Mobile Close Button */}
        <div className="flex h-16 items-center justify-end border-b border-[hsl(var(--sidebar-border))] px-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-accent))] hover:text-white"
            onClick={closeMobile}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {sidebarContent}
      </aside>
    </>
  );
}
