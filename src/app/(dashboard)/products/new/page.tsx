'use client';

/**
 * New Product Page
 *
 * Form for creating a new product.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { ProductForm } from '@/features/products/components';
import { createProductFromData } from '@/features/products/actions';
import { formToCreateDTO, type ProductFormInput } from '@/features/products/lib/schemas';
import { toast } from 'sonner';

export default function NewProductPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (data: ProductFormInput) => {
    setIsLoading(true);
    try {
      const dto = formToCreateDTO(data);
      const result = await createProductFromData(dto);

      if (result.success) {
        toast.success('Product created successfully');
        router.push('/products');
      } else {
        if (result.errors) {
          const errorMessages = Object.values(result.errors).flat();
          toast.error(errorMessages[0] || 'Validation failed');
        } else {
          toast.error(result.error || 'Failed to create product');
        }
      }
    } catch {
      toast.error('An error occurred while creating the product');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/products');
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New Product"
        description="Add a new product to your catalog"
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
        <CardHeader>
          <CardTitle>Product Details</CardTitle>
          <CardDescription>
            Enter the details for the new product. Fields marked with * are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isLoading}
            submitLabel="Create Product"
          />
        </CardContent>
      </Card>
    </div>
  );
}
