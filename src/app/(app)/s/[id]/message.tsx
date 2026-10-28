"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export function Message({
  role,
  content,
  meta,
  index,
}: {
  role: string;
  content: string;
  meta?: string | null;
  index: number;
}) {
  const isUser = role === "user";
  let imageIds: string[] = [];
  try {
    const parsed = meta ? (JSON.parse(meta) as { imageIds?: string[] }) : null;
    if (Array.isArray(parsed?.imageIds)) imageIds = parsed.imageIds.filter((id) => typeof id === "string");
  } catch {}
  return (
    <article
      className={cn("animate-fade-up flex flex-col", isUser ? "items-end" : "items-stretch")}
      style={{ animationDelay: `${Math.min(index, 6) * 30}ms` }}
    >
      <p className={cn("type-label mb-2", isUser ? "text-primary" : "text-text-tertiary")}>{isUser ? "You" : "ijra"}</p>
      {isUser ? (
        <div className="max-w-[85%] rounded-xl border bg-surface-2 px-4 py-3">
          {imageIds.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {imageIds.map((id) => (
                <img key={id} src={`/api/images/${id}`} alt="" className="size-20 rounded-lg border object-cover" />
              ))}
            </div>
          )}
          <div className="text-base leading-6 break-words whitespace-pre-wrap">{content}</div>
        </div>
      ) : (
        <div className="border-l border-border pl-4">
          <Markdown text={content} />
        </div>
      )}
    </article>
  );
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-base leading-6 break-words [&_a]:break-all [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_code]:rounded-sm [&_code]:bg-surface-2 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_h1,h2,h3]:text-lg [&_h1,h2,h3]:font-medium [&_h1,h2,h3]:tracking-[-0.01em] [&_li]:ml-4 [&_ol]:list-decimal [&_p]:m-0 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:bg-surface-1 [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-medium [&_ul]:list-disc">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
