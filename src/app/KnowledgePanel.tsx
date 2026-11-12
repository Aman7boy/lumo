import { FileText, Link2, Loader2, Plus, Search, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '../components/Button'
import { api, errorMessage } from '../lib/api'
import { bytes, formatDate } from '../lib/format'
import { Link } from '../lib/router'
import type { KnowledgeDoc } from '../shared/types'
import { Badge, Card, CardHeader, EmptyState, Field, Modal, TextArea, TextInput, useToast } from './ui'
import { useApi } from './useApi'

export function KnowledgePanel({
  agentId,
  agentName,
  title = 'Knowledge base',
  description,
}: {
  agentId?: string
  agentName?: string
  title?: string
  description?: string
}) {
  const path = agentId ? `/api/knowledge?agentId=${agentId}` : '/api/knowledge'
  const { data, loading, error, reload } = useApi<KnowledgeDoc[]>(path)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteBody, setNoteBody] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeDoc | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<Array<{ title: string; content: string; score: number }> | null>(null)
  const [urlOpen, setUrlOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [importingUrl, setImportingUrl] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  useEffect(() => {
    setResults(null)
  }, [path])

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return
    const file = files[0]
    if (file.size > 4 * 1024 * 1024) {
      setUploadError('Files are limited to 4 MB in this build.')
      return
    }
    setUploading(true)
    setUploadError(null)
    try {
      const form = new FormData()
      form.set('file', file)
      if (agentId) form.set('agentId', agentId)
      await api.upload<KnowledgeDoc>('/api/knowledge', form)
      toast.push(`${file.name} indexed`)
      reload()
    } catch (cause) {
      setUploadError(errorMessage(cause))
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function saveNote() {
    if (noteTitle.trim().length < 2 || noteBody.trim().length < 20) return
    setSavingNote(true)
    try {
      await api.post('/api/knowledge/text', { title: noteTitle.trim(), content: noteBody.trim(), agentId })
      toast.push('Note indexed')
      setNoteOpen(false)
      setNoteTitle('')
      setNoteBody('')
      reload()
    } catch (cause) {
      toast.push(errorMessage(cause), 'error')
    } finally {
      setSavingNote(false)
    }
  }

  async function importUrl() {
    if (!/^https?:\/\//i.test(url.trim())) {
      setUrlError('Enter a full http:// or https:// address.')
      return
    }
    setImportingUrl(true)
    setUrlError(null)
    try {
      await api.post('/api/knowledge/url', { url: url.trim(), agentId })
      toast.push('Website indexed')
      setUrlOpen(false)
      setUrl('')
      reload()
    } catch (cause) {
      setUrlError(errorMessage(cause))
    } finally {
      setImportingUrl(false)
    }
  }

  async function remove() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/api/knowledge/${deleteTarget.id}`)
      toast.push('Document removed')
      setDeleteTarget(null)
      reload()
    } catch (cause) {
      toast.push(errorMessage(cause), 'error')
    } finally {
      setDeleting(false)
    }
  }

  async function search() {
    if (query.trim().length < 2) return
    setSearching(true)
    setResults(null)
    try {
      const found = await api.post<Array<{ title: string; content: string; score: number }>>('/api/knowledge/search', {
        query: query.trim(),
        agentId,
      })
      setResults(found)
    } catch (cause) {
      toast.push(errorMessage(cause), 'error')
    } finally {
      setSearching(false)
    }
  }

  const docs = data ?? []

  return (
    <>
      <Card>
        <CardHeader
          title={title}
          description={description ?? (agentName ? `Documents ${agentName} can cite. Workspace documents are visible to every agent.` : 'Workspace documents are visible to every agent. Agent-only documents stay scoped.')}
          action={
            <div className="flex gap-1.5">
              <Button variant="ghost" className="h-8 px-2.5 text-[11.5px]" onClick={() => { setUrlOpen(true); setUrlError(null) }}>
                <Link2 className="size-3.5" /> URL
              </Button>
              <Button variant="ghost" className="h-8 px-2.5 text-[11.5px]" onClick={() => setNoteOpen(true)}>
                <Plus className="size-3.5" /> Note
              </Button>
              <Button variant="secondary" className="h-8 px-2.5 text-[11.5px]" onClick={() => inputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="animate-spin" /> : <Upload className="size-3.5" />}
                Upload
              </Button>
            </div>
          }
        />
        <input ref={inputRef} type="file" accept=".pdf,.docx,.xlsx,.csv,.txt,.md,.json,.html" className="hidden" onChange={(event) => upload(event.target.files)} />

        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            void upload(event.dataTransfer.files)
          }}
          className={`m-4 rounded-[10px] border border-dashed px-4 py-5 text-center transition-colors ${dragging ? 'border-accent/60 bg-accent/[0.05]' : 'border-line'}`}
        >
          <p className="text-[12px] text-muted">
            Drop a PDF, Word, Excel, CSV or text file here, or{' '}
            <button type="button" onClick={() => inputRef.current?.click()} className="text-accent hover:text-accent-2">
              choose one
            </button>
            .
          </p>
          <p className="mt-1 text-[10.5px] text-faint">Text is extracted, chunked and indexed per workspace. Original files stay in object storage.</p>
          {uploadError && <p className="mt-2 text-[11px] text-rose-300">{uploadError}</p>}
        </div>

        <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
          <span className="text-[11px] text-faint">
            {docs.length} document{docs.length === 1 ? '' : 's'} · {docs.reduce((total, doc) => total + doc.chunks, 0)} passages
          </span>
          <button type="button" onClick={() => setSearchOpen((value) => !value)} className="inline-flex items-center gap-2 text-[11px] text-muted hover:text-fg">
            <Search className="size-3" /> Test retrieval
          </button>
        </div>

        {searchOpen && (
          <div className="border-t border-line px-4 py-3">
            <div className="flex gap-2">
              <TextInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void search()
                }}
                placeholder="e.g. What is the price of P-28 preforms?"
                className="h-8 text-[11.5px]"
              />
              <Button variant="secondary" className="h-8 px-3 text-[11.5px]" onClick={search} disabled={searching || query.trim().length < 2}>
                {searching ? <Loader2 className="animate-spin" /> : 'Search'}
              </Button>
            </div>
            {results && (
              <div className="mt-2.5 flex flex-col gap-2">
                {results.length === 0 ? (
                  <p className="text-[11.5px] text-muted">No passage scored above zero. An agent would say it does not know.</p>
                ) : (
                  results.map((result, index) => (
                    <div key={index} className="rounded-[8px] bg-white/[0.03] p-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-medium">{result.title}</p>
                        <span className="text-[9.5px] text-faint">score {result.score}</span>
                      </div>
                      <p className="mt-1 text-[10.5px] leading-relaxed text-muted">{result.content.slice(0, 260)}…</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {loading && !data ? (
          <p className="border-t border-line px-4 py-6 text-center text-[12px] text-muted">Loading documents…</p>
        ) : error ? (
          <p className="border-t border-line px-4 py-6 text-center text-[12px] text-rose-300">{error}</p>
        ) : docs.length === 0 ? (
          <div className="border-t border-line p-4">
            <EmptyState
              icon={<FileText className="size-5" />}
              title={agentId ? `${agentName ?? 'This agent'} has no documents` : 'No documents yet'}
              description="Upload the price list, policy, catalogue or handbook that answers the questions your agent will be asked. Without a source, it will say it does not know."
              className="border-0 py-6"
            />
          </div>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {docs.map((doc) => (
              <li key={doc.id} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-[8px] bg-white/[0.05] text-muted">
                  <FileText className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[12px] font-medium">{doc.title}</p>
                    <Badge tone={doc.agentId ? 'accent' : 'neutral'}>{doc.agentId ? doc.agentName ?? 'Agent' : 'Workspace'}</Badge>
                  </div>
                  <p className="mt-0.5 text-[10.5px] text-faint">
                    {doc.filename} · {bytes(doc.size)} · {doc.chunks} passages · {formatDate(doc.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Delete ${doc.title}`}
                  onClick={() => setDeleteTarget(doc)}
                  className="mt-0.5 grid size-7 place-items-center rounded-[7px] text-faint transition-colors hover:bg-white/[0.05] hover:text-rose-300"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-2 px-1 text-[10.5px] text-faint">
        Need a document every agent can use? Upload it from the <Link href="/app/knowledge" className="text-accent hover:text-accent-2">workspace knowledge base</Link>.
      </p>

      <Modal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        title="Add a knowledge note"
        description="Useful for facts that do not live in a file: payment terms, escalation rules, tone guidance."
        footer={
          <>
            <Button variant="ghost" onClick={() => setNoteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveNote} disabled={savingNote || noteTitle.trim().length < 2 || noteBody.trim().length < 20}>
              {savingNote ? <Loader2 className="animate-spin" /> : null} Index note
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Title">
            <TextInput value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} placeholder="e.g. Delivery and payment terms" />
          </Field>
          <Field label="Content" hint="At least a paragraph. The agent will cite the title.">
            <TextArea value={noteBody} onChange={(event) => setNoteBody(event.target.value)} rows={7} placeholder="Write the facts exactly as they should be used." />
          </Field>
        </div>
      </Modal>

      <Modal
        open={urlOpen}
        onClose={() => setUrlOpen(false)}
        title="Import a website"
        description="Lumo fetches a public text page, extracts the readable content and indexes it for this agent or the workspace."
        footer={
          <>
            <Button variant="ghost" onClick={() => setUrlOpen(false)}>Cancel</Button>
            <Button onClick={importUrl} disabled={importingUrl || !/^https?:\/\//i.test(url.trim())}>
              {importingUrl ? <Loader2 className="animate-spin" /> : <Link2 />} Import URL
            </Button>
          </>
        }
      >
        <Field label="Title">
          <TextInput value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/pricing" />
        </Field>
        {urlError && <p className="mt-2 text-[11px] text-rose-300">{urlError}</p>}
        <p className="mt-2 text-[10.5px] leading-relaxed text-faint">Only the public page is stored. Pages behind a login or rendered only by JavaScript may return no readable text.</p>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Remove this document?"
        description={`${deleteTarget?.title ?? ''} and its ${deleteTarget?.chunks ?? 0} passages will be deleted. Agents will stop citing it.`}
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Keep it
            </Button>
            <Button onClick={remove} disabled={deleting}>
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />} Remove
            </Button>
          </>
        }
      >
        <p className="text-[12px] leading-relaxed text-muted">This cannot be undone. Upload the file again if you need it later.</p>
      </Modal>
    </>
  )
}
