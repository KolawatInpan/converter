import React, { useMemo, useRef, useState } from "react";
import { mergePdfApi } from "../api_caller/merge_pdf";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type PdfItem = {
  id: string;
  file: File;
};

function formatFileSize(size: number): string {
  const kb = size / 1024;
  const mb = kb / 1024;

  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  return `${kb.toFixed(2)} KB`;
}

function SortablePdfCard({
  item,
  index,
  onRemove,
}: {
  item: PdfItem;
  index: number;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`min-w-[220px] max-w-[220px] rounded-2xl border border-slate-700 bg-slate-950/80 p-4 shadow-lg shadow-black/20 ring-1 ring-white/5 ${
        isDragging ? "z-10 scale-[1.02] shadow-lg" : ""
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="mb-3 cursor-grab rounded-xl border border-dashed border-slate-600 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-300 active:cursor-grabbing"
      >
        Drag to reorder
      </div>

      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-sky-400">
            PDF #{index + 1}
          </div>
          <div className="mt-1 break-words text-sm font-medium text-slate-100">
            {item.file.name}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="rounded-lg px-2 py-1 text-xs font-medium text-rose-400 hover:bg-rose-500/10"
        >
          Remove
        </button>
      </div>

      <div className="rounded-xl bg-slate-900 p-3 text-xs text-slate-300">
        <div>Type: PDF</div>
        <div>Size: {formatFileSize(item.file.size)}</div>
      </div>
    </div>
  );
}

export default function MergePdf() {
  const [files, setFiles] = useState<PdfItem[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const sensors = useSensors(useSensor(PointerSensor));

  const ids = useMemo(() => files.map((item) => item.id), [files]);

  function addFiles(selectedFiles: FileList | null) {
    if (!selectedFiles) return;

    const pdfFiles = Array.from(selectedFiles).filter(
      (file) =>
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf")
    );

    if (pdfFiles.length === 0) return;

    const mapped: PdfItem[] = pdfFiles.map((file) => ({
      id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
      file,
    }));

    setFiles((prev) => [...prev, ...mapped]);
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    addFiles(event.target.files);
    event.target.value = "";
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingOver(false);
    addFiles(event.dataTransfer.files);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    setFiles((prev) => {
      const oldIndex = prev.findIndex((item) => item.id === active.id);
      const newIndex = prev.findIndex((item) => item.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function handleRemove(id: string) {
    setFiles((prev) => prev.filter((item) => item.id !== id));
  }

  async function handleMerge() {
    if (files.length < 2) {
      alert("Please upload at least 2 PDF files.");
      return;
    }

    try {
      setIsMerging(true);

      const orderedFiles = files.map((item) => item.file);
      const blob = await mergePdfApi(orderedFiles);

      const url = window.URL.createObjectURL(
        new Blob([blob], { type: "application/pdf" })
      );

      const link = document.createElement("a");
      link.href = url;
      link.download = "merged.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      alert("Merge failed.");
    } finally {
      setIsMerging(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(71,85,105,0.22),_transparent_32%),linear-gradient(180deg,_#1f2937_0%,_#111827_52%,_#030712_100%)] px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100">Merge PDF</h1>
          <p className="mt-2 text-sm text-slate-300">
            Upload PDF files, drag to reorder from left to right, then merge.
          </p>
        </div>

        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={handleDrop}
          className={`flex min-h-[260px] cursor-pointer items-center justify-center rounded-3xl border-2 border-dashed bg-slate-900/70 p-8 text-center shadow-xl shadow-black/20 ring-1 ring-white/5 transition ${
            isDraggingOver
              ? "border-sky-400 bg-slate-800/80"
              : "border-slate-600 hover:border-sky-400/80"
          }`}
        >
          <div>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 text-2xl ring-1 ring-slate-600/80">
              📄
            </div>
            <h2 className="text-xl font-semibold text-slate-100">
              Drop PDF files here
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              or click to select files
            </p>
            <p className="mt-4 text-xs text-slate-400">
              Merge order will follow left to right
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            onChange={handleInputChange}
            className="hidden"
          />
        </div>

        <div className="mt-8 rounded-3xl border border-slate-700/80 bg-slate-900/75 p-6 shadow-xl shadow-black/20 ring-1 ring-white/5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-100">
                File order
              </h3>
              <p className="text-sm text-slate-300">
                Final merge sequence is from left to right
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setFiles([])}
                disabled={files.length === 0 || isMerging}
                className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear all
              </button>

              <button
                type="button"
                onClick={handleMerge}
                disabled={files.length < 2 || isMerging}
                className="rounded-xl bg-sky-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isMerging ? "Merging..." : "Merge PDF"}
              </button>
            </div>
          </div>

          {files.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-600 bg-slate-800/60 px-6 py-12 text-center text-sm text-slate-400">
              No PDF files yet
            </div>
          ) : (
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <SortableContext
                items={ids}
                strategy={horizontalListSortingStrategy}
              >
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {files.map((item, index) => (
                    <SortablePdfCard
                      key={item.id}
                      item={item}
                      index={index}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  );
}