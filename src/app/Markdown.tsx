import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

export function Markdown({ text }: { text: string }) {
  // A deliberately small renderer: paragraphs, headings, lists, bold, italic,
  // inline code, fenced code blocks and links. Keeps the bundle small and the
  // output predictable. Not GitHub-flavoured beyond the basics.
  const blocks = parseBlocks(text)
  return (
    <div className="prose prose-invert max-w-none text-[13px] leading-relaxed">
      {blocks.map((block, index) => {
        if (block.type === 'code') {
          return <CodeBlock key={index} language={block.lang} code={block.code} />
        }
        if (block.type === 'heading') {
          return <h3 key={index} className="mt-4 mb-1.5 text-[14px] font-semibold text-fg/95">{renderInline(block.text)}</h3>
        }
        if (block.type === 'list') {
          return (
            <ul key={index} className="my-2 flex flex-col gap-1 pl-4">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="list-disc text-fg/85">{renderInline(item)}</li>
              ))}
            </ul>
          )
        }
        return <p key={index} className="my-1.5 whitespace-pre-wrap text-fg/85">{renderInline(block.text)}</p>
      })}
    </div>
  )
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="my-2 overflow-hidden rounded-[9px] border border-line bg-bg/60">
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5 text-[10.5px] text-faint">
        <span>{language || 'code'}</span>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard?.writeText(code)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
          }}
          className="text-faint hover:text-fg"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[11.5px] leading-relaxed text-fg/85">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function parseBlocks(text: string): Array<{ type: 'text' | 'heading' | 'list' | 'code'; text?: string; items?: string[]; lang?: string; code?: string }> {
  const lines = text.split('\n')
  const blocks: Array<{ type: 'text' | 'heading' | 'list' | 'code'; text?: string; items?: string[]; lang?: string; code?: string }> = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const code: string[] = []
      i += 1
      while (i < lines.length && !lines[i].startsWith('```')) {
        code.push(lines[i])
        i += 1
      }
      blocks.push({ type: 'code', lang, code: code.join('\n') })
      i += 1
      continue
    }
    if (line.startsWith('# ')) {
      blocks.push({ type: 'heading', text: line.slice(2) })
      i += 1
      continue
    }
    if (/^[-*]\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s/, ''))
        i += 1
      }
      blocks.push({ type: 'list', items })
      continue
    }
    if (line.trim() === '') {
      i += 1
      continue
    }
    const paragraph: string[] = []
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('```') && !/^[-*]\s/.test(lines[i]) && !lines[i].startsWith('# ')) {
      paragraph.push(lines[i])
      i += 1
    }
    blocks.push({ type: 'text', text: paragraph.join(' ') })
  }
  return blocks
}

function renderInline(text: string): ReactNode {
  // Tokenise on code spans and links first, then bold/italic on the remaining text.
  const tokens = text.split(/(`[^`]+`|\[[^\]]+\]\([^)]+\))/g)
  return tokens.map((token, index) => {
    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <code key={index} className="rounded bg-white/[0.08] px-1 py-0.5 text-[11.5px] text-accent-2">
          {token.slice(1, -1)}
        </code>
      )
    }
    const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (linkMatch) {
      return (
        <a key={index} href={linkMatch[2]} className="text-accent underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
          {linkMatch[1]}
        </a>
      )
    }
    const boldSplit = token.split(/\*\*([^*]+)\*\*/g)
    return boldSplit.map((part, boldIndex) =>
      boldIndex % 2 === 1 ? (
        <strong key={`${index}-${boldIndex}`} className="font-semibold text-fg/95">
          {part}
        </strong>
      ) : (
        part.split(/_([^_]+)_/g).map((italic, italicIndex) =>
          italicIndex % 2 === 1 ? (
            <em key={`${index}-${boldIndex}-${italicIndex}`} className="italic text-fg/90">
              {italic}
            </em>
          ) : (
            italic
          ),
        )
      ),
    )
  })
}
