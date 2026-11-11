import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-feed flex-col items-center gap-4 px-4 py-24 text-center">
      <p className="font-serif text-7xl font-bold text-accent">404</p>
      <h1 className="text-2xl font-bold">We couldn&apos;t find that page</h1>
      <p className="text-muted">The story may have been unpublished, or the link is wrong.</p>
      <ButtonLink href="/" variant="solid">Back to MedTeds</ButtonLink>
    </main>
  );
}
