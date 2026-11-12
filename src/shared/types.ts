// Domain types shared by the Worker API and the React app.

export type AccountType = 'individual' | 'business' | 'enterprise'
export type PlanKey = 'free' | 'starter' | 'professional' | 'business' | 'enterprise'
export type Autonomy = 'approval' | 'auto'
export type AgentStatus = 'draft' | 'testing' | 'deployed' | 'paused'
export type ChannelKey = 'website' | 'telegram' | 'api' | 'whatsapp' | 'internal' | 'voice'

export interface User {
  id: string
  email: string
  name: string
  accountType: AccountType
  role: 'user' | 'admin'
}

export interface Workspace {
  id: string
  name: string
  company: string
  plan: PlanKey
  accountType: AccountType
  createdAt: number
}

export interface AgentStats {
  conversations: number
  messages: number
  tasksCompleted: number
  tasksPending: number
  toolRuns: number
  knowledgeDocs: number
}

export interface Agent {
  id: string
  workspaceId: string
  name: string
  category: string
  tagline: string
  description: string
  instructions: string
  responsibilities: string[]
  tasks: string[]
  audience: string
  autonomy: Autonomy
  tone: string
  model: string
  modelProvider: string
  modelConnectionId: string | null
  language: string
  voiceEnabled: boolean
  voiceLanguage: string
  ttsVoice: string | null
  documentEnabled: boolean
  databaseWriteEnabled: boolean
  databaseSourceId: string | null
  avatar: string | null
  responseStyle: string
  temperature: number
  memoryEnabled: boolean
  executionMode: string
  purpose: string | null
  status: AgentStatus
  channels: ChannelKey[]
  tools: string[]
  createdAt: number
  updatedAt: number
  deployedAt: number | null
  stats: AgentStats
}

// The output of the natural-language builder, before an agent row exists.
export interface AgentBlueprint {
  name: string
  category: string
  tagline: string
  instructions: string
  responsibilities: string[]
  tasks: string[]
  audience: string
  autonomy: Autonomy
  tone: string
  model: string
  channels: ChannelKey[]
  tools: string[]
  knowledge: Array<{ title: string; why: string }>
  summary: string
  signals: string[]
  followUps: string[]
  confidence: number
}

export interface ModelConnection {
  id: string
  provider: string
  providerName: string
  label: string
  model: string
  baseUrl: string
  keyHint: string
  status: 'untested' | 'connected' | 'error'
  lastTestedAt: number | null
  lastError: string | null
  models: string[]
  isDefault: boolean
  createdAt: number
}

export interface ToolAccount {
  id: string
  tool: string
  label: string
  owner: string
  via: 'direct' | 'composio' | 'oauth'
  externalId: string | null
  permissions: 'read' | 'draft' | 'send'
  status: 'connected' | 'disconnected'
  createdAt: number
  updatedAt: number | null
}

export interface ToolAction {
  slug: string
  name: string
  description: string
  required: 'read' | 'draft' | 'send'
}

export interface ConnectedAccount {
  id: string
  provider: 'google' | 'microsoft'
  label: string
  email: string
  services: Array<{ tool: string; accountId: string; scopes: string[] }>
  scopes: string[]
  status: 'connected' | 'error' | 'revoked'
  permissions: 'read' | 'draft' | 'send'
  lastConnectedAt: number | null
  lastError: string | null
  connectedAt: number
}

export interface OAuthStatus {
  provider: 'google' | 'microsoft'
  configured: boolean
  source: 'platform' | 'workspace' | 'none'
  redirectUri: string
  scopes: Array<{ key: string; label: string; scopes: string[] }>
}

export interface DatabaseSource {
  id: string
  mode: 'managed' | 'external'
  provider: 'd1' | 'supabase' | 'postgres' | 'mysql' | 'custom_rest'
  label: string
  permissions: 'read' | 'write' | 'delete'
  status: 'untested' | 'connected' | 'error' | 'unsupported'
  lastTestedAt: number | null
  lastError: string | null
  configHint: string
  createdAt: number
}

export interface DatabaseRecord {
  id: string
  sourceId: string | null
  collection: string
  data: Record<string, unknown>
  createdBy: string | null
  createdAt: number
  updatedAt: number
}

export interface Backup {
  id: string
  kind: 'manual' | 'scheduled' | 'pre_restore'
  status: 'running' | 'completed' | 'failed' | 'restored'
  size: number
  checksum: string | null
  counts: Record<string, number>
  error: string | null
  createdAt: number
  completedAt: number | null
  restoredAt: number | null
}

export interface BackupSettings {
  schedule: 'manual' | 'daily' | 'weekly'
  retentionDays: number
  lastBackupAt: number | null
  nextBackupAt: number | null
}

export interface VoiceProvider {
  id: string
  kind: 'stt' | 'tts'
  provider: 'openai' | 'elevenlabs' | 'google' | 'deepgram'
  label: string
  model: string | null
  voice: string | null
  language: string
  priority: number
  status: 'untested' | 'connected' | 'error'
  keyHint: string
  lastTestedAt: number | null
  lastError: string | null
  createdAt: number
}

export interface VoiceUsageRow {
  id: number
  kind: 'stt' | 'tts'
  provider: string
  status: 'ok' | 'failed' | 'fallback'
  latencyMs: number
  characters: number
  error: string | null
  createdAt: number
}

export interface OcrProvider {
  id: string
  provider: 'openai' | 'google'
  label: string
  model: string | null
  priority: number
  status: 'untested' | 'connected' | 'error'
  keyHint: string
  lastTestedAt: number | null
  lastError: string | null
  createdAt: number
}

export interface ExtractedField {
  name: string
  value: string
  confidence: number
  source: string
}

export interface ExtractedTable {
  name: string
  columns: string[]
  rows: string[][]
}

export interface DocumentExtraction {
  documentType: string
  fields: ExtractedField[]
  tables: ExtractedTable[]
  totals: Array<{ label: string; value: string }>
  uncertain: Array<{ name: string; reason: string }>
  summary: string
  reviewed: boolean
}

export interface GeneratedFile {
  id: string
  kind: 'xlsx' | 'csv' | 'pdf' | 'audio'
  filename: string
  mime: string
  size: number
  createdAt: number
  downloadUrl: string
}

export interface DocumentRecord {
  id: string
  agentId: string | null
  filename: string
  mime: string
  size: number
  status: 'uploaded' | 'processing' | 'extracted' | 'needs_review' | 'ready' | 'failed'
  provider: string | null
  error: string | null
  characters: number
  extraction: DocumentExtraction | null
  files: GeneratedFile[]
  createdAt: number
  processedAt: number | null
}

export interface AgentToolAccount {
  tool: string
  accountId: string
  label: string
  owner: string
  via: 'direct' | 'composio' | 'oauth'
  permissions: 'read' | 'draft' | 'send'
}

export interface AgentDeployment {
  id: string
  agentId: string
  token: string
  allowedOrigins: string
  enabled: boolean
  createdAt: number
  shareUrl: string
  embedUrl: string
  apiUrl: string
}

export interface PublicAgent {
  name: string
  tagline: string
  category: string
  starters: string[]
  conversationId?: string
}

export interface AdminOverview {
  users: number
  workspaces: number
  agents: number
  conversations: number
  messages: number
  toolAccounts: number
  modelConnections: number
  integrationErrors: number
  recentAudit: Array<{ id: number; workspaceId: string; actorId: string; action: string; target: string | null; detail: string | null; createdAt: number }>
  tenants: Array<{ workspaceId: string; workspaceName: string; plan: PlanKey; ownerEmail: string; agents: number; conversations: number; createdAt: number }>
}

export interface ToolRun {
  tool: string
  action: string
  status: 'completed' | 'awaiting_approval' | 'needs_connection' | 'unavailable'
  detail: string
}

export interface ChatReply {
  message: ChatMessage
  toolRuns: ToolRun[]
  sources: Array<{ title: string; snippet: string }>
  suggestions: string[]
  engine: 'builtin' | 'openai'
  memoryWrites: string[]
}

export interface ChatMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
  toolRuns: ToolRun[]
  sources: Array<{ title: string; snippet: string }>
}

export interface Conversation {
  id: string
  agentId: string
  agentName?: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
  lastMessage?: string
}

export interface KnowledgeDoc {
  id: string
  workspaceId: string
  agentId: string | null
  agentName?: string | null
  title: string
  filename: string
  mime: string
  size: number
  chunks: number
  characters: number
  createdAt: number
}

export interface MemoryItem {
  id: string
  agentId: string
  content: string
  kind: 'fact' | 'preference' | 'instruction'
  createdAt: number
}

export interface AgentTask {
  id: string
  agentId: string
  agentName?: string
  title: string
  detail: string
  status: 'awaiting_approval' | 'open' | 'done' | 'cancelled'
  tool: string | null
  createdAt: number
  completedAt: number | null
}

export interface AgentEvent {
  id: number
  agentId: string
  agentName?: string
  kind: string
  summary: string
  detail: string | null
  createdAt: number
}

export interface Integration {
  tool: string
  status: 'connected' | 'disconnected'
  accountLabel: string | null
  connectedAt: number | null
}

export interface Automation {
  id: string
  agentId: string
  agentName?: string
  name: string
  prompt: string
  schedule: 'hourly' | 'daily' | 'weekly'
  enabled: boolean
  lastRunAt: number | null
  nextRunAt: number
  runCount: number
  createdAt: number
}

export interface Analytics {
  totals: {
    agents: number
    conversations: number
    messages: number
    toolRuns: number
    tasksDone: number
    tasksPending: number
    knowledgeDocs: number
    aiCalls: number
    tokens: number
  }
  daily: Array<{ day: string; messages: number; toolRuns: number }>
  tools: Array<{ tool: string; runs: number }>
  perAgent: Array<{ id: string; name: string; category: string; messages: number; toolRuns: number; tasks: number }>
  plan: { key: PlanKey; agentLimit: number }
}

export interface Overview {
  workspace: Workspace
  user: User
  agents: Agent[]
  activity: AgentEvent[]
  tasks: AgentTask[]
  usage: { agents: number; agentLimit: number; aiCalls: number; messages: number; knowledgeDocs: number }
  connectionCount: number
  engine: { provider: 'builtin' | 'openai'; model: string; externalConfigured: boolean }
}

export type ApiError = { error: string; hint?: string }

export interface ApiEnvelope<T> {
  data?: T
  error?: string
  hint?: string
}