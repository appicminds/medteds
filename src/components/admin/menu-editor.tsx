"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage, Input, Select } from "@/components/ui/field";
import { saveMenus } from "@/lib/site-actions";

type Item = { label: string; url: string };

function MenuList({ name, title, items, setItems, suggestions }: {
  name: string;
  title: string;
  items: Item[];
  setItems: (fn: (items: Item[]) => Item[]) => void;
  suggestions: Item[];
}) {
  const update = (i: number, patch: Partial<Item>) => setItems((list) => list.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const move = (i: number, d: number) =>
    setItems((list) => {
      const next = [...list];
      const [x] = next.splice(i, 1);
      next.splice(i + d, 0, x);
      return next;
    });
  return (
    <section className="flex flex-col gap-3 rounded-md border border-line p-4">
      <h2 className="font-semibold">{title}</h2>
      {items.length ? (
        <ol className="flex flex-col gap-2">
          {items.map((it, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
              <span className="w-5 text-right text-xs text-muted tabular-nums">{i + 1}</span>
              <label htmlFor={`${name}-label-${i}`} className="sr-only">Label</label>
              <Input id={`${name}-label-${i}`} value={it.label} placeholder="Label" maxLength={40} onChange={(e) => update(i, { label: e.target.value })} className="min-w-0 flex-1" />
              <label htmlFor={`${name}-url-${i}`} className="sr-only">Link</label>
              <Input id={`${name}-url-${i}`} value={it.url} placeholder="/about or https://…" onChange={(e) => update(i, { url: e.target.value })} className="min-w-0 flex-1 font-mono text-sm" />
              <span className="flex">
                <Button variant="ghost" size="icon" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={16} /></Button>
                <Button variant="ghost" size="icon" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown size={16} /></Button>
                <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => setItems((list) => list.filter((_, j) => j !== i))}><X size={16} /></Button>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted">No links yet.</p>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <Button variant="outline" size="sm" onClick={() => setItems((list) => [...list, { label: "", url: "" }])}>
          <Plus size={15} /> Custom link
        </Button>
        <label htmlFor={`${name}-quick`} className="sr-only">Add a page or topic</label>
        <Select
          id={`${name}-quick`}
          value=""
          onChange={(e) => {
            const s = suggestions[Number(e.target.value)];
            if (s) setItems((list) => [...list, { ...s }]);
          }}
          className="h-8 w-full min-w-0 py-0 text-sm sm:w-auto sm:max-w-xs"
        >
          <option value="">Add a page or topic…</option>
          {suggestions.map((s, i) => (
            <option key={`${s.url}-${i}`} value={i}>{s.label} ({s.url})</option>
          ))}
        </Select>
      </div>
    </section>
  );
}

export function MenuEditor({ header, footer, suggestions }: { header: Item[]; footer: Item[]; suggestions: Item[] }) {
  const [h, setH] = useState(header);
  const [f, setF] = useState(footer);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-6">
      <MenuList name="header" title="Header menu" items={h} setItems={setH} suggestions={suggestions} />
      <MenuList name="footer" title="Footer menu" items={f} setItems={setF} suggestions={suggestions} />
      {msg ? <FormMessage tone={msg.ok ? "success" : "error"}>{msg.text}</FormMessage> : null}
      <div>
        <Button
          variant="solid"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await saveMenus(h, f);
              setMsg(res.ok ? { ok: true, text: res.message ?? "Saved." } : { ok: false, text: res.error });
            })
          }
        >
          {pending ? "Saving…" : "Save menus"}
        </Button>
      </div>
    </div>
  );
}
