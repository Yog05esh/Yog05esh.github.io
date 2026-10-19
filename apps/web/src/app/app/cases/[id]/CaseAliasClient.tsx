"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

/** /app/cases/{id} remains a client-side alias in the static export. */
export default function CaseAliasPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  useEffect(() => {
    const id = params?.id;
    if (!id) return;
    const query = new URLSearchParams();
    const stage = search.get("stage");
    const tab = search.get("tab");
    if (stage) query.set("stage", stage);
    else if (tab) query.set("tab", tab);
    router.replace(`/app/incidents/${encodeURIComponent(id)}${query.size ? `?${query}` : ""}`);
  }, [params, router, search]);
  return null;
}
