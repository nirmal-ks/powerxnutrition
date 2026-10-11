import { ReviewsManager } from "@/components/admin/ReviewsManager";
import { NoAccess } from "@/components/admin/ui";
import { pageAccess } from "@/lib/page-auth";
import { getStore } from "@/lib/store";

export const metadata = { title: "Reviews" };

export default async function AdminReviewsPage() {
  const { allowed } = await pageAccess("reviews.manage");
  if (!allowed) return <NoAccess />;
  const store = getStore();
  const [reviews, products] = await Promise.all([store.listReviews(), store.listProducts({ fresh: true })]);
  const names = Object.fromEntries(products.map((p) => [p.slug, p.name]));
  return (
    <div>
      <h1 className="font-display text-4xl">Reviews</h1>
      <p className="mb-6 text-sm text-smoke">New reviews wait here until you approve them. “Verified buyer” means the mobile number has ordered this product.</p>
      <ReviewsManager reviews={reviews} names={names} />
    </div>
  );
}
