import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        There is no card or page at this address. It may have moved, or the link may be
        incomplete.
      </p>
      <Button asChild className="mt-6">
        <Link href="/browse">Browse cards</Link>
      </Button>
    </div>
  );
}
