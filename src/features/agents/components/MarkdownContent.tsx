import Markdown from "react-markdown";

interface MarkdownContentProps {
  readonly content: string;
}

function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="select-text text-sm leading-relaxed prose-invert prose-sm max-w-none">
      <Markdown
        components={{
          // Style code blocks
          pre: ({ children }) => (
            <pre className="my-1.5 overflow-x-auto rounded bg-muted/50 p-2 text-xs">
              {children}
            </pre>
          ),
          code: ({ children, className }) => {
            // Inline code vs block code
            if (className) {
              return <code className="text-xs">{children}</code>;
            }
            return (
              <code className="rounded bg-muted/50 px-1 py-0.5 text-xs font-mono">
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
              className="text-blue-400 underline decoration-blue-400/30 hover:decoration-blue-400"
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
            <blockquote className="my-1 border-l-2 border-muted-foreground/30 pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}

export { MarkdownContent };
