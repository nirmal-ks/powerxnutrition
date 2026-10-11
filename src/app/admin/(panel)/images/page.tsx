import { Suspense } from "react";
import { ImageReview } from "@/components/admin/images/ImageReview";
import { NoAccess, PageHeader } from "@/components/admin/ui";
import { pageAccess } from "@/lib/page-auth";

export const metadata = { title: "Product photos" };

export default async function ImagesPage() {
  const { allowed } = await pageAccess(["images.review"]);
  if (!allowed) return <NoAccess />;
  return (
    <div>
      <PageHeader
        title="Product photos"
        subtitle="Only APPROVED photos appear on the website. Candidates are suggestions — check brand, size, flavour and packaging before approving. Existing approved photos are never replaced automatically."
      />
      <Suspense>
        <ImageReview />
      </Suspense>
    </div>
  );
}
