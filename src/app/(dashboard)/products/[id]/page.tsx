/**
 * Product Details Page
 *
 * Displays details for a single product.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Separator } from '@/shared/components/ui/separator';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { getProduct } from '@/features/products/actions';
import type { ProductWithFormattedPrices } from '@/features/products/types';

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const result = await getProduct(id);

  if (!result.success || !result.data) {
    notFound();
  }

  const product = result.data as ProductWithFormattedPrices;

  const statusColors: Record<string, 'default' | 'secondary' | 'destructive'> = {
    active: 'default',
    inactive: 'secondary',
    discontinued: 'destructive',
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={product.name}
        description={`SKU: ${product.sku}`}
        actions={
          <div className="flex gap-2">
            <Link href="/products">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            <Link href={`/products/${id}/edit`}>
              <Button variant="outline">
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
            <Button variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">SKU</p>
                <p className="font-mono text-lg">{product.sku}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge variant={statusColors[product.status]}>
                  {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
                </Badge>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Name</p>
              <p>{product.name}</p>
            </div>

            {product.shortDescription && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Short Description</p>
                <p className="text-sm">{product.shortDescription}</p>
              </div>
            )}

            {product.description && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Description</p>
                <p className="text-sm whitespace-pre-wrap">{product.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
            <CardDescription>Base cost and price information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Base Cost</p>
                <p className="text-2xl font-bold">{product.formattedBaseCost}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Base Price</p>
                <p className="text-2xl font-bold">{product.formattedBasePrice}</p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Margin</p>
                <p className="font-mono">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  }).format(product.margin / 100)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Margin %</p>
                <Badge
                  variant={
                    product.marginPercent >= 20
                      ? 'default'
                      : product.marginPercent >= 10
                        ? 'secondary'
                        : 'destructive'
                  }
                  className="font-mono"
                >
                  {product.marginPercent.toFixed(1)}%
                </Badge>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-sm font-medium text-muted-foreground">Sellable</p>
              <Badge variant={product.isSellable ? 'default' : 'outline'}>
                {product.isSellable ? 'Yes' : 'No'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Specifications */}
        <Card>
          <CardHeader>
            <CardTitle>Specifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Category</p>
                <p>{product.category || '—'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Weight</p>
                <p>{product.weightLbs ? `${product.weightLbs} lbs` : '—'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Rim Size</p>
                <p>{product.rimSize || '—'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tire Size</p>
                <p>{product.tireSize || '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Created</p>
                <p className="text-sm">
                  {new Date(product.createdAt).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Updated</p>
                <p className="text-sm">
                  {new Date(product.updatedAt).toLocaleString()}
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Product ID</p>
              <p className="font-mono text-xs text-muted-foreground">{product.id}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
