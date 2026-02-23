import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  readonly content: string;
}

function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="select-text text-sm leading-relaxed prose-invert prose-sm max-w-none">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Style code blocks
          pre: ({ children }) => (
            <pre className="my-1.5 overflow-x-auto rounded border border-border/30 bg-surface-raised p-2 text-xs">
              {children}
            </pre>
          ),
          code: ({ children, className }) => {
            // Inline code vs block code
            if (className) {
              return <code className="text-xs">{children}</code>;
            }
            return (
              <code className="rounded bg-surface-raised px-1 py-0.5 text-xs font-mono">
                {children}
              </code>
            );
          },
          // Lists
          ul: ({ children }) => (
            <ul className="my-1 ml-4 list-disc space-y-0.5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-1 ml-4 list-decimal space-y-0.5">{children}</ol>
          ),
          li: ({ children }) => <li className="text-sm">{children}</li>,
          // Paragraphs
          p: ({ children }) => <p className="my-1">{children}</p>,
          // Bold / italic
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-foreground underline decoration-foreground/30 hover:decoration-foreground/60"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          // Headings
          h1: ({ children }) => (
            <h1 className="my-2 text-base font-bold">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="my-1.5 text-sm font-bold">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="my-1 text-sm font-semibold">{children}</h3>
          ),
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="my-1 border-l-2 border-foreground/20 pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          // Tables (GFM)
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-muted-foreground/30">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-2 py-1 text-left font-semibold text-muted-foreground">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-t border-muted-foreground/10 px-2 py-1">{children}</td>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}

export { MarkdownContent };
