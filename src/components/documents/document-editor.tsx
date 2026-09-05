"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { Bold, Heading1, Heading2, Heading3, Italic, List, ListOrdered, Loader2, MessageSquareQuote, Redo2, Save, Table as TableIcon, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { pmToSections, sectionsToPm, type PmNode } from "@/lib/documents/editor-convert";
import type { DocSection } from "@/lib/documents/types";
import { cn } from "@/lib/utils";

export interface EditorPayload {
  type: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  sections: DocSection[];
  changeNote: string | null;
}

export interface DocumentEditorProps {
  initial: { type: string; title: string; subtitle: string | null; summary: string | null; sections: DocSection[] };
  typeOptions: Array<{ value: string; label: string }>;
  typeLocked: boolean;
  isNewVersion: boolean;
  organizationName: string;
  reference: string | null;
  backHref: string;
  save: (payload: EditorPayload) => Promise<ActionResult<{ id: string; href: string }>>;
}

function ToolbarButton({ onClick, active, disabled, title, children }: { onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn("inline-flex size-8 items-center justify-center rounded-md text-sm transition-colors hover:bg-muted disabled:opacity-40", active && "bg-navy text-white hover:bg-navy")}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const inTable = editor.isActive("table");
  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-t-lg border-b bg-background/95 px-2 py-1.5 backdrop-blur">
      <ToolbarButton title="Ongedaan maken" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}><Undo2 className="size-4" /></ToolbarButton>
      <ToolbarButton title="Opnieuw" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}><Redo2 className="size-4" /></ToolbarButton>
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolbarButton title="Hoofdstuk (kop 1)" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="size-4" /></ToolbarButton>
      <ToolbarButton title="Paragraaf (kop 2)" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="size-4" /></ToolbarButton>
      <ToolbarButton title="Subparagraaf (kop 3)" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="size-4" /></ToolbarButton>
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolbarButton title="Vet (Ctrl+B)" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="size-4" /></ToolbarButton>
      <ToolbarButton title="Cursief (Ctrl+I)" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="size-4" /></ToolbarButton>
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolbarButton title="Opsomming" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="size-4" /></ToolbarButton>
      <ToolbarButton title="Genummerde lijst" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="size-4" /></ToolbarButton>
      <ToolbarButton title="Opmerking (kader)" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><MessageSquareQuote className="size-4" /></ToolbarButton>
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolbarButton title="Tabel invoegen (3 x 3)" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon className="size-4" /></ToolbarButton>
      {inTable ? (
        <>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().addRowAfter().run()} className="rounded-md px-2 py-1 text-xs hover:bg-muted">+ rij</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().addColumnAfter().run()} className="rounded-md px-2 py-1 text-xs hover:bg-muted">+ kolom</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().deleteRow().run()} className="rounded-md px-2 py-1 text-xs hover:bg-muted">- rij</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().deleteColumn().run()} className="rounded-md px-2 py-1 text-xs hover:bg-muted">- kolom</button>
          <ToolbarButton title="Tabel verwijderen" onClick={() => editor.chain().focus().deleteTable().run()}><Trash2 className="size-4" /></ToolbarButton>
        </>
      ) : null}
    </div>
  );
}

/** Word-like document editor: A4 sheet, toolbar, title fields; saves as a new StructuredDocument version. */
export function DocumentEditor({ initial, typeOptions, typeLocked, isNewVersion, organizationName, reference, backHref, save }: DocumentEditorProps) {
  const [type, setType] = useState(initial.type);
  const [title, setTitle] = useState(initial.title);
  const [subtitle, setSubtitle] = useState(initial.subtitle ?? "");
  const [summary, setSummary] = useState(initial.summary ?? "");
  const [changeNote, setChangeNote] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const content = useMemo(() => sectionsToPm(initial.sections), [initial.sections]);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false, code: false, strike: false, horizontalRule: false, link: false, underline: false }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: "Begin met een kop (hoofdstuk) en schrijf daaronder de tekst..." }),
    ],
    content: content as unknown as Record<string, unknown>,
    editorProps: { attributes: { class: "asbesthub-editor focus:outline-none", spellcheck: "true", lang: "nl" } },
  });

  function submit() {
    if (!editor) return;
    if (title.trim().length < 3) {
      toast.error("Geef een titel van minimaal 3 tekens.");
      return;
    }
    const sections = pmToSections(editor.getJSON() as unknown as PmNode);
    if (sections.length === 0 || sections.every((s) => s.blocks.length === 0)) {
      toast.error("Het document heeft nog geen inhoud.");
      return;
    }
    start(async () => {
      const res = await save({ type, title: title.trim(), subtitle: subtitle.trim() || null, summary: summary.trim() || null, sections, changeNote: changeNote.trim() || null });
      if (res.ok) {
        toast.success(isNewVersion ? "Nieuwe versie opgeslagen (docx en pdf gerenderd)" : "Document opgeslagen (docx en pdf gerenderd)");
        router.push(res.data.href);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
      <div className="rounded-lg border bg-muted/40">
        {editor ? <Toolbar editor={editor} /> : null}
        <div className="overflow-x-auto px-2 py-6 md:px-6">
          <div className="mx-auto min-h-[1000px] w-full max-w-[820px] rounded-sm border bg-white px-10 py-12 shadow-md md:px-16 md:py-16">
            <div className="mb-8 flex items-center justify-between border-b pb-2 font-mono text-[10px] text-muted-foreground">
              <span>{organizationName}</span>
              <span>{reference ?? ""}</span>
            </div>
            <textarea value={title} onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))} placeholder="Titel van het document" aria-label="Titel" rows={2} className="mb-1 w-full resize-none border-0 bg-transparent font-heading text-3xl leading-tight font-semibold outline-none placeholder:text-muted-foreground/50" />
            <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Ondertitel (optioneel)" aria-label="Ondertitel" className="mb-4 w-full border-0 bg-transparent text-base text-muted-foreground outline-none placeholder:text-muted-foreground/50" />
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Samenvatting (optioneel, verschijnt in een kader bovenaan het document)" aria-label="Samenvatting" rows={3} className="mb-6 w-full resize-y rounded-md bg-muted/60 p-3 text-sm outline-none placeholder:text-muted-foreground/60" />
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
      <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <div className="space-y-3 rounded-lg border bg-background p-4">
          <div className="space-y-1.5">
            <Label htmlFor="doc-type">Documenttype</Label>
            <select id="doc-type" value={type} onChange={(e) => setType(e.target.value)} disabled={typeLocked} className="border-input flex h-9 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-60">
              {typeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {isNewVersion ? (
            <div className="space-y-1.5">
              <Label htmlFor="doc-note">Wijzigingsnotitie</Label>
              <Textarea id="doc-note" rows={3} value={changeNote} onChange={(e) => setChangeNote(e.target.value)} placeholder="Wat is er veranderd in deze versie?" />
            </div>
          ) : null}
          <Button className="w-full" disabled={pending || !editor} onClick={submit}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} {isNewVersion ? "Opslaan als nieuwe versie" : "Document opslaan"}
          </Button>
          <Button variant="ghost" className="w-full" disabled={pending} onClick={() => router.push(backHref)}>
            Annuleren
          </Button>
        </div>
        <div className="rounded-lg border bg-background p-4 text-xs text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">Zo werkt het</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Kop 1 = hoofdstuk, kop 2 en 3 = paragrafen. Tekst vóór de eerste kop wordt de inleiding.</li>
            <li>Vet, cursief, opsommingen, genummerde lijsten, kaders en tabellen komen terug in docx en pdf.</li>
            <li>Opslaan maakt een nieuwe versie met verschil ten opzichte van de vorige; het document blijft een concept tot accordering.</li>
            <li>Sneltoetsen: Ctrl+B vet, Ctrl+I cursief, Ctrl+Z ongedaan maken.</li>
          </ul>
        </div>
        <div className="rounded-lg border bg-background p-4 text-xs">
          <Label htmlFor="doc-ref">Kenmerk</Label>
          <Input id="doc-ref" value={reference ?? ""} readOnly className="mt-1 font-mono" />
        </div>
      </aside>
    </div>
  );
}
