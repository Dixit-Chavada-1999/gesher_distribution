'use client';

/**
 * Edit Product Page
 *
 * Form for editing an existing product.
 */

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { ProductForm } from '@/features/products/components';
import { getProduct, updateProductFromData } from '@/features/products/actions';
import { formToCreateDTO, type ProductFormInput } from '@/features/products/lib/schemas';
import type { ProductWithFormattedPrices } from '@/features/products/types';
import { toast } from 'sonner';

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [product, setProduct] = useState<ProductWithFormattedPrices | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProduct() {
      const result = await getProduct(id);

      if (result.success && result.data) {
        setProduct(result.data as ProductWithFormattedPrices);
      } else {
        setError(result.error || 'Product not found');
      }
      setIsLoading(false);
    }

    loadProduct();
  }, [id]);

  const handleSubmit = async (data: ProductFormInput) => {
    setIsSaving(true);
    try {
      const dto = formToCreateDTO(data);
      const result = await updateProductFromData(id, dto);

      if (result.success) {
        toast.success('Product updated successfully');
        router.push(`/products/${id}`);
      } else {
        if (result.errors) {
          const errorMessages = Object.values(result.errors).flat();
          toast.error(errorMessages[0] || 'Validation failed');
        } else {
          toast.error(result.error || 'Failed to update product');
        }
      }
    } catch {
      toast.error('An error occurred while updating the product');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    router.push(`/products/${id}`);
  };

  if (isLoading) {
    return <LoadingState message="Loading product..." />;
  }

  if (error || !product) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Edit Product"
          actions={
            <Link href="/products">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Products
              </Button>
            </Link>
          }
        />
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-destructive">{error || 'Product not found'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Edit Product"
        description={`Editing ${product.name} (${product.sku})`}
        actions={
          <Link href={`/products/${id}`}>
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Product
            </Button>
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Product Details</CardTitle>
          <CardDescription>
            Update the product information. Fields marked with * are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductForm
            initialData={{
              sku: product.sku,
              name: product.name,
              description: product.description,
              shortDescription: product.shortDescription,
              category: product.category,
              rimSize: product.rimSize,
              tireSize: product.tireSize,
              weightLbs: product.weightLbs,
              baseCost: product.baseCost,
              basePrice: product.basePrice,
              status: product.status,
              isSellable: product.isSellable,
              imageUrl: product.imageUrl,
            }}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isSaving}
            submitLabel="Update Product"
          />
        </CardContent>
      </Card>
    </div>
  );
}
