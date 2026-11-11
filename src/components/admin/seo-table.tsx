"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminTable } from "@/components/admin/page-header";
import { SeoDrawer, SeoFields, type SeoValues } from "@/components/cms/seo-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormMessage, Select } from "@/components/ui/field";
import { bulkSeo, savePageSeo, saveStorySeo, type BulkSeoAction } from "@/lib/seo-actions";
import type { SeoRow } from "@/lib/queries";

function Score({ passed, total }: { passed: number; total: number }) {
  const tone = passed === total ? "success" : passed >= total - 1 ? "warning" : "danger";
  return (
    <Badge tone={tone}>
      <span className="tabular-nums">{passed}/{total}</span>
    </Badge>
  );
}

function AutoTag({ custom }: { custom: boolean }) {
  return custom ? (
    <span className="rounded-pill bg-accent-soft px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-accent">Custom</span>
  ) : (
    <span className="rounded-pill bg-surface px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-muted">Auto</span>
  );
}

export function SeoTable({ rows, kind, host, siteName }: { rows: SeoRow[]; kind: "stories" | "pages"; host: string; siteName: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<BulkSeoAction | "">("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState<SeoRow | null>(null);
  const [values, setValues] = useState<SeoValues | null>(null);
  const [drawerMsg, setDrawerMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const noun = kind === "stories" ? "story" : "page";

  function open(r: SeoRow) {
    setEditing(r);
    setDrawerMsg(null);
    setValues({
      slug: r.slug,
      seoTitle: r.seoTitle,
      seoDescription: r.seoDescription,
      noindex: r.noindex,
      canonicalUrl: r.canonicalUrl,
      shareImage: r.shareImage,
    });
  }

  function save(next?: SeoValues) {
    if (!editing || !values) return;
    const v = next ?? values;
    setDrawerMsg(null);
    start(async () => {
      const res =
        kind === "stories"
          ? await saveStorySeo(editing.id, v)
          : await savePageSeo(editing.id, { seoTitle: v.seoTitle, seoDescription: v.seoDescription, noindex: v.noindex });
      if (!res.ok) return setDrawerMsg({ ok: false, text: res.error });
      setEditing(null);
      setResult({ ok: true, text: `${res.message} “${editing.title}” updated.` });
      router.refresh();
    });
  }

  function apply() {
    if (!action) return setResult({ ok: false, text: "Choose an action first." });
    if (!selected.size) return setResult({ ok: false, text: `Select at least one ${noun}.` });
    setResult(null);
    start(async () => {
      const res = await bulkSeo(kind, [...selected], action);
      setResult(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.error });
      setSelected(new Set());
      setAction("");
      router.refresh();
    });
  }

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const viewHref = (r: SeoRow) => (kind === "stories" ? `/p/${r.slug}` : `/${r.slug}`);
  const editHref = (r: SeoRow) => (kind === "stories" ? `/editor/${r.id}` : `/admin/pages/${r.id}`);

  return (
    <div className="flex flex-col gap-4">
      {rows.length ? (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="seo-bulk" className="sr-only">Bulk action</label>
          <Select id="seo-bulk" value={action} onChange={(e) => setAction(e.target.value as BulkSeoAction)} className="w-auto min-w-52">
            <option value="">Bulk actions</option>
            <option value="reset">Reset to automatic</option>
            <option value="hide">Hide from search engines</option>
            <option value="show">Show to search engines</option>
          </Select>
          <Button variant="outline" size="sm" disabled={pending} onClick={apply}>
            {pending ? "Applying…" : "Apply"}
          </Button>
          <span className="text-sm text-muted">{selected.size ? `${selected.size} selected` : ""}</span>
        </div>
      ) : null}
      {result ? <FormMessage tone={result.ok ? "success" : "error"}>{result.text}</FormMessage> : null}

      {rows.length ? (
        <AdminTable>
          <thead>
            <tr>
              <th className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allChecked}
                  onChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
              </th>
              <th>{kind === "stories" ? "Story" : "Page"}</th>
              <th>Search listing</th>
              <th>Score</th>
              <th>Search</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={selected.has(r.id) ? "bg-accent-soft/40" : undefined}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.title}`}
                    checked={selected.has(r.id)}
                    onChange={() =>
                      setSelected((s) => {
                        const n = new Set(s);
                        if (n.has(r.id)) n.delete(r.id);
                        else n.add(r.id);
                        return n;
                      })
                    }
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                </td>
                <td className="max-w-[240px]">
                  <button type="button" onClick={() => open(r)} className="block max-w-full cursor-pointer truncate text-left font-medium hover:underline">
                    {r.title}
                  </button>
                  <span className="flex flex-wrap gap-x-3 text-xs text-muted">
                    <button type="button" className="cursor-pointer hover:text-fg" onClick={() => open(r)}>Edit SEO</button>
                    <Link href={editHref(r)} className="hover:text-fg">Edit {noun}</Link>
                    <Link href={viewHref(r)} className="hover:text-fg">{r.live ? "View" : "Preview"}</Link>
                    {!r.live ? <span>· {r.status === "pending" ? "Pending" : r.status === "scheduled" ? "Scheduled" : "Draft"}</span> : null}
                  </span>
                </td>
                <td className="max-w-[380px]">
                  <span className="flex items-center gap-2">
                    <AutoTag custom={!!r.seoTitle} />
                    <span className="truncate text-accent">{r.effectiveTitle}</span>
                  </span>
                  <span className="mt-0.5 flex items-start gap-2">
                    <AutoTag custom={!!r.seoDescription} />
                    <span className="line-clamp-2 text-xs text-muted">{r.effectiveDescription || "No description yet."}</span>
                  </span>
                </td>
                <td>
                  <button type="button" onClick={() => open(r)} className="cursor-pointer" aria-label={`Score ${r.passed} of ${r.total}. Open checklist`}>
                    <Score passed={r.passed} total={r.total} />
                  </button>
                </td>
                <td className="whitespace-nowrap">{r.noindex ? <Badge tone="danger">Hidden</Badge> : <span className="text-muted">Shown</span>}</td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      ) : (
        <p className="py-10 text-center text-muted">Nothing here.</p>
      )}

      <SeoDrawer
        open={!!editing && !!values}
        onClose={() => setEditing(null)}
        heading={editing ? `SEO: ${editing.title}` : "SEO"}
        subheading="Leave a field blank to keep it automatic."
        footer={
          <div className="flex flex-col gap-3">
            {drawerMsg ? <FormMessage tone={drawerMsg.ok ? "success" : "error"}>{drawerMsg.text}</FormMessage> : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="accent" disabled={pending} onClick={() => save()}>
                {pending ? "Saving…" : "Save"}
              </Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <span className="flex-1" />
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => {
                  if (!values) return;
                  const next = { ...values, seoTitle: "", seoDescription: "", shareImage: "" };
                  setValues(next);
                  save(next);
                }}
              >
                Reset all to automatic
              </Button>
            </div>
          </div>
        }
      >
        {editing && values ? (
          <SeoFields
            idPrefix="admin-seo"
            values={values}
            onChange={(patch) => setValues((v) => (v ? { ...v, ...patch } : v))}
            auto={{ title: editing.autoTitle, description: editing.autoDescription, image: editing.autoImage }}
            options={
              kind === "stories"
                ? {
                    slugPrefix: "/p/",
                    slugNote: editing.slug.startsWith("draft-") ? "The web address is created when the story is first published." : undefined,
                    canonical: true,
                    shareImage: true,
                    topicCount: editing.topicCount ?? 0,
                  }
                : { noun: "page" }
            }
            host={host}
            siteName={siteName}
          />
        ) : null}
      </SeoDrawer>
    </div>
  );
}
