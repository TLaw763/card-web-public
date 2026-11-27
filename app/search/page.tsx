import { redirect } from "next/navigation";
import { BROWSE_PATH } from "@/lib/search-url";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        query.append(key, entry);
      }
      continue;
    }

    query.set(key, value);
  }

  const suffix = query.toString();
  redirect(suffix ? `${BROWSE_PATH}?${suffix}` : BROWSE_PATH);
}
