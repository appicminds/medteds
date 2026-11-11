import { ButtonLink } from "@/components/ui/button";

/** Newer/older links. `base` ends with "?" or "&". */
export function Pager({ page, hasMore, base }: { page: number; hasMore: boolean; base: string }) {
  if (page === 1 && !hasMore) return null;
  return (
    <nav className="flex justify-between pt-8" aria-label="Pagination">
      {page > 1 ? (
        <ButtonLink href={`${base}page=${page - 1}`} variant="outline" size="sm">
          ← Newer
        </ButtonLink>
      ) : (
        <span />
      )}
      {hasMore ? (
        <ButtonLink href={`${base}page=${page + 1}`} variant="outline" size="sm">
          Older →
        </ButtonLink>
      ) : null}
    </nav>
  );
}
