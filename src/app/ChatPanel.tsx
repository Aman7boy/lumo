import { ArrowUp, Check, Copy, Loader2, MessageSquarePlus, Mic, Plus, ShieldCheck, Square, Volume2, Wrench } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '../components/Button'
import { api, errorMessage } from '../lib/api'
import { cx } from '../lib/cx'
import { formatShortDate } from '../lib/format'
import { Link, useNavigation } from '../lib/router'
import { categoryMap, statusTone, toolMap } from '../shared/catalog'
import type { Agent, ChatMessage, Conversation, ToolRun } from '../shared/types'
import { Markdown } from './Markdown'
import { Badge, Spinner } from './ui'

export function ChatPanel({ agent, onChanged }: { agent: Agent; onChanged?: () => void }) {
  const { query } = useNavigation()
  const conversationParam = query.get('conversation')
  const welcome = query.get('welcome') === '1'
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(conversationParam)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [engine, setEngine] = useState<'builtin' | 'openai' | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showWelcome, setShowWelcome] = useState(welcome)
  const scrollRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [speakingId, setSpeakingId] = useState<string | null>(null)

  const category = categoryMap[agent.category] ?? categoryMap.custom
  const starters = useMemo(
    () => (agent.tasks.length ? agent.tasks.slice(0, 3) : ['What can you do?', 'Summarise what you know', 'Draft an email for me']),
    [agent.tasks],
  )

  useEffect(() => {
    let alive = true
    api
      .get<Conversation[]>(`/api/conversations?agentId=${agent.id}`)
      .then((list) => {
        if (!alive) return
        setConversations(list)
        setActiveId((current) => {
          if (current && list.some((conversation) => conversation.id === current)) return current
          if (conversationParam && list.some((conversation) => conversation.id === conversationParam)) return conversationParam
          return list[0]?.id ?? null
        })
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [agent.id, conversationParam])

  useEffect(() => {
    if (!activeId) {
      setMessages([])
      return
    }
    let alive = true
    setLoadingHistory(true)
    api
      .get<{ messages: ChatMessage[] }>(`/api/conversations/${activeId}`)
      .then((data) => {
        if (!alive) return
        setMessages(data.messages)
      })
      .catch((cause) => {
        if (alive) setError(errorMessage(cause))
      })
      .finally(() => {
        if (alive) setLoadingHistory(false)
      })
    return () => {
      alive = false
    }
  }, [activeId])

  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, sending])

  async function send(text?: string) {
    const content = (text ?? draft).trim()
    if (!content || sending) return
    setDraft('')
    setError(null)
    setSending(true)
    setShowWelcome(false)

    const optimistic: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversationId: activeId ?? '',
      role: 'user',
      content,
      createdAt: Date.now(),
      toolRuns: [],
      sources: [],
    }
    setMessages((current) => [...current, optimistic])

    try {
      let conversationId = activeId
      if (!conversationId) {
        const created = await api.post<Conversation>('/api/conversations', { agentId: agent.id, title: content.slice(0, 60) })
        conversationId = created.id
        setActiveId(created.id)
        setConversations((current) => [created, ...current])
      }
      const reply = await api.post<{ message: ChatMessage; suggestions: string[]; engine: 'builtin' | 'openai'; title: string }>(
        `/api/conversations/${conversationId}/messages`,
        { content },
      )
      setMessages((current) => [...current.filter((message) => message.id !== optimistic.id), { ...optimistic, conversationId }, reply.message])
      setSuggestions(reply.suggestions)
      setEngine(reply.engine)
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, title: reply.title, updatedAt: Date.now(), messageCount: conversation.messageCount + 2, lastMessage: reply.message.content.slice(0, 120) }
            : conversation,
        ),
      )
      onChanged?.()
    } catch (cause) {
      setError(errorMessage(cause))
      setMessages((current) => current.filter((message) => message.id !== optimistic.id))
    } finally {
      setSending(false)
      composerRef.current?.focus()
    }
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported('audio/webm') ? { mimeType: 'audio/webm' } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data)
      }
      recorder.onstop = async () => {
        setRecording(false)
        stream.getTracks().forEach((track) => track.stop())
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        if (blob.size < 1000) return
        setTranscribing(true)
        try {
          const form = new FormData()
          form.append('audio', blob, 'recording.webm')
          form.append('language', agent.voiceLanguage)
          const result = await api.upload<{ text: string; provider: string }>('/api/voice/transcribe', form)
          if (result.text) {
            setDraft((current) => (current ? `${current} ${result.text}` : result.text))
            composerRef.current?.focus()
          } else {
            setError('No speech was recognised in that recording.')
          }
        } catch (cause) {
          setError(errorMessage(cause))
        } finally {
          setTranscribing(false)
        }
      }
      recorder.start()
      recorderRef.current = recorder
      setRecording(true)
      setError(null)
    } catch (cause) {
      setError(`Microphone unavailable: ${errorMessage(cause)}`)
    }
  }

  async function speak(messageId: string, content: string) {
    if (speakingId === messageId) {
      audioRef.current?.pause()
      setSpeakingId(null)
      return
    }
    audioRef.current?.pause()
    setSpeakingId(messageId)
    try {
      const response = await fetch('/api/voice/speak', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: content.replace(/[*_#>`]/g, '').replace(/\s+/g, ' ').slice(0, 1800),
          language: agent.voiceLanguage,
          voice: agent.ttsVoice ?? undefined,
        }),
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(payload?.error ?? 'Speech is unavailable.')
      }
      const url = URL.createObjectURL(await response.blob())
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        URL.revokeObjectURL(url)
        setSpeakingId(null)
      }
      await audio.play()
    } catch (cause) {
      setError(errorMessage(cause))
      setSpeakingId(null)
    }
  }

  async function newConversation() {
    setActiveId(null)
    setMessages([])
    setSuggestions([])
    setError(null)
    setShowWelcome(false)
    composerRef.current?.focus()
  }

  const empty = messages.length === 0 && !loadingHistory

  return (
    <div className="grid gap-3 lg:grid-cols-[212px_1fr]">
      <aside className="hidden flex-col gap-2 lg:flex">
        <Button variant="secondary" className="h-8 justify-start px-2.5 text-[11.5px]" onClick={newConversation}>
          <MessageSquarePlus className="size-3.5" /> New conversation
        </Button>
        <div className="depth relative flex min-h-0 flex-1 flex-col rounded-card-sm bg-surface p-1.5">
          <p className="px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-faint">History</p>
          {conversations.length === 0 ? (
            <p className="px-2 py-2 text-[10.5px] leading-snug text-faint">Conversations you start here appear in this list.</p>
          ) : (
            <ul className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(conversation.id)}
                    className={cx(
                      'w-full rounded-[7px] px-2 py-1.5 text-left transition-colors',
                      activeId === conversation.id ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]',
                    )}
                  >
                    <span className="block truncate text-[11.5px] text-fg/85">{conversation.title}</span>
                    <span className="mt-0.5 block text-[9.5px] text-faint">
                      {formatShortDate(conversation.updatedAt)} · {conversation.messageCount} messages
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <div className="depth relative flex h-[calc(100vh-220px)] min-h-[520px] flex-col rounded-card-sm bg-surface">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-3">
          <span className="grid size-6 place-items-center rounded-[7px] text-[10px] font-semibold text-black/75" style={{ background: category.color }}>
            {agent.name[0]}
          </span>
          <span className="text-[12px] font-medium">{agent.name}</span>
          <Badge tone={agent.status === 'deployed' ? 'success' : 'info'}>{agent.status === 'deployed' ? 'Live' : agent.status}</Badge>
          <span className="hidden text-[10px] text-faint sm:inline">
            {agent.stats.knowledgeDocs} docs in scope · {agent.autonomy === 'approval' ? 'approval before external actions' : 'acts automatically'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span
              className="hidden items-center gap-1 rounded-[6px] bg-white/[0.04] px-1.5 py-0.5 text-[9.5px] text-muted sm:inline-flex"
              title={engine === 'openai' ? 'Answered by the configured external model' : 'Grounded composition from your documents'}
            >
              <span className={cx('size-1.5 rounded-full', engine === 'openai' ? 'bg-emerald-400' : 'bg-accent-2')} />
              {engine === 'openai' ? 'Model' : 'Lumo Core'}
            </span>
            <button type="button" onClick={newConversation} className="grid size-7 place-items-center rounded-[7px] text-muted hover:bg-white/[0.06] hover:text-fg lg:hidden" aria-label="New conversation">
              <Plus className="size-3.5" />
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
          {loadingHistory ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[12px] text-muted">
              <Spinner /> Loading conversation…
            </div>
          ) : empty ? (
            <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center text-center">
              <span className="grid size-12 place-items-center rounded-[15px] text-[18px] font-semibold text-black/75" style={{ background: `linear-gradient(135deg, ${category.color}, ${category.color}aa)` }}>
                {agent.name[0]}
              </span>
              <h2 className="mt-3 text-[18px] font-semibold tracking-tight">Talk to {agent.name}</h2>
              <p className="mt-1.5 max-w-sm text-[12px] leading-relaxed text-muted">
                {agent.tagline}. It answers from your documents, says what it cannot find, and {agent.autonomy === 'approval' ? 'prepares external actions for approval.' : 'logs every action it takes.'}
              </p>
              {showWelcome && (
                <div className="mt-4 w-full rounded-[9px] bg-emerald-400/[0.07] px-3 py-2 text-left text-[11.5px] leading-relaxed text-emerald-200/90">
                  <Check className="mr-1 inline size-3" /> Configuration saved. This is the first real test: ask something only your documents can answer.
                </div>
              )}
              <div className="mt-5 grid w-full gap-1.5">
                {starters.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => send(starter)}
                    className="rounded-[8px] border border-line px-3 py-2 text-left text-[11.5px] text-fg/80 transition-colors hover:border-accent/30 hover:bg-white/[0.03]"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {messages.map((message) => (
                <Message
                  key={message.id}
                  message={message}
                  agent={agent}
                  speaking={speakingId === message.id}
                  onSpeak={agent.voiceEnabled && message.role === 'assistant' ? () => speak(message.id, message.content) : undefined}
                />
              ))}
              {sending && (
                <div className="flex items-center gap-2 text-[11.5px] text-muted">
                  <span className="grid size-6 place-items-center rounded-[8px] text-[10px] font-semibold text-black/75" style={{ background: category.color }}>
                    {agent.name[0]}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-[9px] bg-white/[0.04] px-3 py-2">
                    <Loader2 className="size-3 animate-spin" /> Working through your documents…
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-line p-2.5 sm:p-3">
          {error && <p className="mb-2 rounded-[8px] bg-rose-400/10 px-2.5 py-1.5 text-[11px] text-rose-300">{error}</p>}
          {suggestions.length > 0 && (
            <div className="scrollbar-none mb-2 flex gap-1 overflow-x-auto pb-0.5">
              {suggestions.slice(0, 3).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  className="shrink-0 rounded-[6px] border border-line px-2 py-1 text-[10.5px] text-muted transition-colors hover:border-accent/30 hover:text-fg"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-[11px] border border-line-strong bg-bg/50 p-1.5 focus-within:border-accent/50">
            {agent.voiceEnabled && (
              <button
                type="button"
                onClick={toggleRecording}
                disabled={transcribing || sending}
                aria-label={recording ? 'Stop recording' : 'Record a voice message'}
                className={cx(
                  'mb-0.5 grid size-8 shrink-0 place-items-center rounded-[8px] border transition-colors disabled:opacity-40',
                  recording ? 'border-rose-400/40 bg-rose-400/15 text-rose-300' : 'border-line text-muted hover:text-fg',
                )}
              >
                {transcribing ? <Loader2 className="size-3.5 animate-spin" /> : recording ? <Square className="size-3" /> : <Mic className="size-3.5" />}
              </button>
            )}
            <textarea
              ref={composerRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void send()
                }
              }}
              rows={1}
              placeholder={`Message ${agent.name}…`}
              className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[12.5px] leading-relaxed outline-none placeholder:text-faint"
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={!draft.trim() || sending}
              aria-label="Send message"
              className="grid size-8 shrink-0 place-items-center rounded-[8px] bg-fg text-bg transition-opacity disabled:opacity-40"
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            </button>
          </div>
          <p className="mt-1 px-1 text-[9.5px] text-faint">
            Enter to send · Shift + Enter for a new line · {agent.autonomy === 'approval' ? 'external actions wait for approval' : 'actions are logged in Activity'}
          </p>
        </div>
      </div>
    </div>
  )
}

function Message({ message, agent, onSpeak, speaking }: { message: ChatMessage; agent: Agent; onSpeak?: () => void; speaking?: boolean }) {
  const [copied, setCopied] = useState(false)
  const toolRuns = message.toolRuns ?? []
  const sources = message.sources ?? []

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[12px] rounded-br-[4px] bg-white/[0.07] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-fg/90">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    )
  }

  const awaiting = toolRuns.some((run) => run.status === 'awaiting_approval')

  return (
    <div className="group flex gap-2.5">
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-[8px] text-[10px] font-semibold text-black/75" style={{ background: (categoryMap[agent.category] ?? categoryMap.custom).color }}>
        {agent.name[0]}
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[11.5px] font-medium">{agent.name}</span>
          <span className="text-[9.5px] text-faint">
            {new Date(message.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard?.writeText(message.content)
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1500)
            }}
            className="ml-auto text-faint opacity-0 transition-opacity hover:text-fg group-hover:opacity-100"
            aria-label="Copy reply"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          </button>
          {onSpeak && (
            <button
              type="button"
              onClick={onSpeak}
              className={cx('text-faint transition-colors hover:text-fg', speaking && 'text-accent')}
              aria-label={speaking ? 'Stop reading aloud' : 'Read reply aloud'}
            >
              {speaking ? <Square className="size-3" /> : <Volume2 className="size-3" />}
            </button>
          )}
        </div>

        <div className="rounded-[12px] rounded-tl-[4px] bg-white/[0.03] px-3.5 py-3">
          <Markdown text={message.content} />

          {toolRuns.length > 0 && (
            <div className="mt-3 flex flex-col gap-1 border-t border-line pt-2.5">
              {toolRuns.map((run, index) => (
                <ToolRunRow key={index} run={run} />
              ))}
            </div>
          )}

          {sources.length > 0 && (
            <details className="mt-2.5 rounded-[8px] bg-black/20 px-2.5 py-2">
              <summary className="cursor-pointer text-[10.5px] text-muted">
                {sources.length} source{sources.length === 1 ? '' : 's'} cited
              </summary>
              <ul className="mt-2 flex flex-col gap-2">
                {sources.map((source, index) => (
                  <li key={index} className="border-l border-accent/30 pl-2">
                    <p className="text-[10.5px] font-medium text-fg/85">{source.title}</p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-faint">{source.snippet}</p>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {awaiting && (
            <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[8px] bg-amber-400/[0.08] px-2.5 py-2 text-[10.5px] text-amber-200/90">
              <ShieldCheck className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1">Nothing external has happened yet.</span>
              <Link href="/app/tasks" className="shrink-0 font-medium text-amber-200 hover:text-amber-100">
                Review in Tasks →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ToolRunRow({ run }: { run: ToolRun }) {
  const tone = statusTone[run.status]
  return (
    <div className="flex items-start gap-2 text-[10px]" title={run.detail}>
      <Wrench className="mt-0.5 size-3 shrink-0 text-faint" />
      <span className="min-w-0 flex-1 text-[10.5px] text-muted">
        <span className="text-fg/75">{toolMap[run.tool]?.name ?? run.tool}</span> · {run.action}
        <span className="block text-[9.5px] text-faint">{run.detail}</span>
      </span>
      <span className={cx('shrink-0 rounded-[5px] px-1.5 py-0.5 text-[9px]', tone.className)}>{tone.label}</span>
    </div>
  )
}
