import { CategoryCard } from "@/components/category-card";
import { categories } from "@/lib/catalog";

export function CategoriesGrid() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {categories.map((category) => (
        <CategoryCard key={category.slug} category={category} />
      ))}
    </div>
  );
}
