// Provider-native model loop with real tool execution.
//
// The model only ever sees actions that pass four checks: the tool is enabled
// on this agent, an account is bound to this agent, the account belongs to this
// workspace, and the account's permission level covers the action. Every tool
// result is returned to the model so it can decide the next step. Mutating
// actions become approval tasks; sending always requires approval.

import { providerMap, toolMap } from '../shared/catalog'
import type { Agent, ToolRun, Workspace } from '../shared/types'
import { executeComposioTool, getComposioConfig, listComposioActions } from './composio'
import { modelSecretContext, openSecret } from './crypto'
import { executeNativeAction, loadNativeActions } from './native-tools'
import { logEvent, uid, type Env } from './store'

type Protocol = 'openai' | 'anthropic' | 'google'
type Permission = 'read' | 'draft' | 'send'

interface ModelTarget {
  apiKey: string
  baseUrl: string
  model: string
  protocol: Protocol
  provider: string
}

interface ActionParameterSchema {
  type?: string
  properties?: Record<string, unknown>
  required?: string[]
  [key: string]: unknown
}

interface AvailableAction {
  tool: string
  kind: 'composio' | 'native'
  accountId: string
  externalId: string
  accountLabel: string
  owner: string
  permission: Permission
  required: Permission
  action: string
  name: string
  description: string
  parameters: ActionParameterSchema
}

interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

const LEVELS: Record<Permission, number> = { read: 0, draft: 1, send: 2 }
const MAX_STEPS = 4
const MAX_TOOL_CALLS = 8
const MAX_RESULT_CHARS = 6000

// Action discovery is tenant-independent for the toolkit schema, but the key
// includes the account so disconnecting and reconnecting cannot reuse a stale
// grant. The cache is in-memory and expires quickly.
const actionCache = new Map<string, { at: number; actions: Awaited<ReturnType<typeof listComposioActions>> }>()
const ACTION_CACHE_MS = 5 * 60 * 1000

export function classifyActionPermission(action: string): Permission {
  const slug = action.toUpperCase()
  if (/(^|_)(SEND|REPLY|FORWARD|PUBLISH|TWEET|POST)(_|$)/.test(slug)) return 'send'
  if (
    /(^|_)(CREATE|UPDATE|DELETE|REMOVE|ADD|INSERT|APPEND|EDIT|MOVE|ARCHIVE|TRASH|LABEL|SET|CLEAR|UPLOAD|SCHEDULE|INVITE|COMMENT|SHARE|ASSIGN)(_|$)/.test(
      slug,
    )
  ) {
    return 'draft'
  }
  return 'read'
}

function normalizePermission(value: string): Permission {
  return value === 'send' || value === 'draft' ? value : 'read'
}

async function actionListFor(accountId: string, tool: string, env: Env, workspaceId: string) {
  const key = `${workspaceId}:${accountId}:${tool}`
  const cached = actionCache.get(key)
  if (cached && Date.now() - cached.at < ACTION_CACHE_MS) return cached.actions
  const config = await getComposioConfig(env.DB, env, workspaceId)
  if (!config) return []
  const actions = await listComposioActions(config, tool)
  actionCache.set(key, { at: Date.now(), actions })
  return actions
}

async function loadAvailableActions(
  env: Env,
  workspaceId: string,
  agent: Agent,
): Promise<{ actions: AvailableAction[]; runs: ToolRun[]; notes: string[] }> {
  const runs: ToolRun[] = []
  const notes: string[] = []
  if (!agent.tools.length) return { actions: [], runs, notes }

  const { results: bindings } = await env.DB.prepare(
    `SELECT ata.tool, ta.id, ta.label, ta.owner, ta.external_id, ta.permissions, ta.status
     FROM agent_tool_accounts ata
     JOIN tool_accounts ta ON ta.id = ata.account_id AND ta.tool = ata.tool
     WHERE ata.agent_id = ? AND ta.workspace_id = ?`,
  )
    .bind(agent.id, workspaceId)
    .all<any>()

  const selectedRows = await env.DB.prepare('SELECT tool, action FROM agent_tool_actions WHERE agent_id = ?')
    .bind(agent.id)
    .all<{ tool: string; action: string }>()
  const selected = new Set((selectedRows.results ?? []).map((row) => `${row.tool}:${row.action}`))

  const actions: AvailableAction[] = []
  for (const binding of bindings ?? []) {
    const tool = String(binding.tool)
    if (!agent.tools.includes(tool)) continue
    // OAuth (Google/Microsoft) accounts are native tools, not Composio ones.
    if (binding.via !== 'composio') continue
    if (binding.status !== 'connected' || !binding.external_id) {
      runs.push({
        tool,
        action: toolMap[tool]?.name ?? tool,
        status: 'needs_connection',
        detail: 'No live Composio account is bound to this agent.',
      })
      continue
    }
    const permission = normalizePermission(String(binding.permissions))
    let discovered: Awaited<ReturnType<typeof listComposioActions>> = []
    try {
      discovered = await actionListFor(String(binding.id), tool, env, workspaceId)
    } catch (error) {
      runs.push({
        tool,
        action: 'Discover actions',
        status: 'unavailable',
        detail: (error as Error).message.slice(0, 240),
      })
      continue
    }

    const explicit = [...selected].some((entry) => entry.startsWith(`${tool}:`))
    const candidates = explicit
      ? discovered.filter((action) => selected.has(`${tool}:${action.slug}`))
      : discovered.filter((action) => classifyActionPermission(action.slug) === 'read').slice(0, 10)

    if (!candidates.length) {
      notes.push(
        explicit
          ? `No selected ${toolMap[tool]?.name ?? tool} action is executable with the current account permission.`
          : `${toolMap[tool]?.name ?? tool} has no selected actions. Read-only actions are available by default.`,
      )
    }

    for (const action of discovered) {
      if (!candidates.some((candidate) => candidate.slug === action.slug)) continue
      const required = classifyActionPermission(action.slug)
      if (LEVELS[required] > LEVELS[permission]) {
        notes.push(
          `${action.name} needs ${required} permission; ${binding.label} only has ${permission}.`,
        )
        continue
      }
      actions.push({
        tool,
        kind: 'composio',
        accountId: String(binding.id),
        externalId: String(binding.external_id),
        accountLabel: String(binding.label),
        owner: String(binding.owner || binding.label),
        permission,
        required,
        action: action.slug,
        name: action.name,
        description: action.description,
        parameters: action.parameters,
      })
    }
  }

  // Native Google/Microsoft, database, document and voice tools. These share
  // the same authorization model and are merged into one tool list for the model.
  const native = await loadNativeActions(env, workspaceId, agent)
  notes.push(...native.notes)
  for (const entry of native.actions) {
    actions.push({
      tool: entry.tool,
      kind: 'native',
      accountId: entry.accountId,
      externalId: '',
      accountLabel: entry.accountLabel,
      owner: entry.owner,
      permission: entry.permission,
      required: entry.required,
      action: entry.action,
      name: entry.name,
      description: entry.description,
      parameters: entry.parameters as ActionParameterSchema,
    })
  }
  return { actions, runs, notes }
}

function modelToolName(slug: string): string {
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 64)
}

function actionSchema(action: AvailableAction): ActionParameterSchema {
  const schema = action.parameters
  if (schema && typeof schema === 'object' && (schema.type === 'object' || schema.properties)) {
    return { type: 'object', properties: schema.properties ?? {}, required: Array.isArray(schema.required) ? schema.required : [] }
  }
  return { type: 'object', properties: {} }
}

function toolDefinitions(actions: AvailableAction[], protocol: Protocol) {
  const definitions = actions.map((action) => ({
    name: modelToolName(action.action),
    description: `${action.name}. ${action.description}${action.accountId ? ` Acts as ${action.owner} (${action.accountLabel}).` : ''} Requires ${action.required} permission.`,
    parameters: actionSchema(action),
  }))
  if (protocol === 'openai') {
    return definitions.map((definition) => ({ type: 'function', function: definition }))
  }
  if (protocol === 'anthropic') {
    return definitions.map((definition) => ({
      name: definition.name,
      description: definition.description,
      input_schema: definition.parameters,
    }))
  }
  return [{ functionDeclarations: definitions }]
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value
}

function summarizeResult(data: unknown): string {
  const text = typeof data === 'string' ? data : JSON.stringify(data)
  return truncate(text.replace(/\s+/g, ' ').trim() || 'Completed with no returned data.', 360)
}

async function runAction(
  env: Env,
  workspaceId: string,
  agent: Agent,
  action: AvailableAction,
  args: Record<string, unknown>,
  toolRuns: ToolRun[],
): Promise<unknown> {
  // Re-check the grant at execution time; the model's tool call is untrusted.
  if (LEVELS[action.required] > LEVELS[action.permission]) {
    const run: ToolRun = {
      tool: action.tool,
      action: action.name,
      status: 'unavailable',
      detail: `Blocked: ${action.required} permission is required, but ${action.accountLabel} has ${action.permission}.`,
    }
    toolRuns.push(run)
    return { ok: false, error: run.detail }
  }

  const mustApprove =
    action.required === 'send' ||
    (agent.autonomy === 'approval' && action.required !== 'read') ||
    action.action === 'document_to_database'
  if (mustApprove) {
    const taskId = uid('tsk_')
    const title = `Approve ${action.name}: ${action.owner}`.slice(0, 140)
    await env.DB.prepare(
      'INSERT INTO tasks (id, workspace_id, agent_id, title, detail, status, tool, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
      .bind(
        taskId,
        workspaceId,
        agent.id,
        title,
        `Action: ${action.name}\nAccount: ${action.owner} (${action.accountLabel})\nArguments: ${truncate(JSON.stringify(args), 900)}`,
        'awaiting_approval',
        action.tool,
        JSON.stringify({
          execution: action.kind === 'native'
            ? {
                native: action.action,
                accountId: action.accountId,
                permission: action.required,
                arguments: args,
              }
            : {
                accountId: action.accountId,
                action: action.action,
                permission: action.required,
                arguments: args,
              },
        }),
        Date.now(),
      )
      .run()
    const run: ToolRun = {
      tool: action.tool,
      action: action.name,
      status: 'awaiting_approval',
      detail: `Prepared for ${action.owner}. Approval task ${taskId} must be completed before this runs.`,
    }
    toolRuns.push(run)
    await logEvent(env.DB, workspaceId, agent.id, 'tool', `Approval requested: ${action.name}`, `${action.owner} · ${action.action}`)
    return {
      ok: true,
      status: 'awaiting_approval',
      taskId,
      message: 'The action is queued for human approval and has not run. Tell the user what will happen after approval.',
    }
  }

  if (action.kind === 'native') {
    const result = await executeNativeAction(env, workspaceId, agent.id, action.action, args, action.accountId)
    const run: ToolRun = {
      tool: action.tool,
      action: action.name,
      status: result.ok ? 'completed' : 'unavailable',
      detail: result.ok ? summarizeResult(result.data) : truncate(result.error ?? 'The tool action failed.', 360),
    }
    toolRuns.push(run)
    await logEvent(env.DB, workspaceId, agent.id, 'tool', `${result.ok ? 'Executed' : 'Tool action failed'}: ${action.name}`, result.ok ? action.owner : result.error ?? null)
    return result.ok ? { ok: true, action: action.action, result: result.data } : { ok: false, action: action.action, error: run.detail }
  }

  const result = await executeComposioTool(env, workspaceId, { externalId: action.externalId }, action.action, args)
  if (!result.ok) {
    const run: ToolRun = {
      tool: action.tool,
      action: action.name,
      status: 'unavailable',
      detail: truncate(result.error ?? 'The tool action failed.', 360),
    }
    toolRuns.push(run)
    await logEvent(env.DB, workspaceId, agent.id, 'tool', `Tool action failed: ${action.name}`, result.error ?? null)
    return { ok: false, action: action.action, error: run.detail }
  }
  const run: ToolRun = {
    tool: action.tool,
    action: action.name,
    status: 'completed',
    detail: summarizeResult(result.data),
  }
  toolRuns.push(run)
  await logEvent(env.DB, workspaceId, agent.id, 'tool', `Executed: ${action.name}`, `${action.owner} · ${action.action}`)
  return { ok: true, action: action.action, result: result.data }
}

export async function resolveModelTarget(
  db: D1Database,
  env: Env,
  agent: Agent,
  workspace: Workspace,
): Promise<ModelTarget | null> {
  if (!agent.modelConnectionId) return null
  const row = await db
    .prepare('SELECT * FROM model_connections WHERE id = ? AND workspace_id = ?')
    .bind(agent.modelConnectionId, workspace.id)
    .first<any>()
  if (!row) return null
  const provider = providerMap[row.provider]
  const apiKey = await openSecret(env, row.api_key ?? '', modelSecretContext(workspace.id, row.id))
  if (!apiKey) return null
  return {
    apiKey,
    baseUrl: String(row.base_url ?? provider?.baseUrl ?? '').replace(/\/$/, ''),
    model: String(row.model ?? agent.model),
    protocol: (provider?.protocol ?? 'openai') as Protocol,
    provider: String(row.provider),
  }
}

export interface ModelLoopInput {
  env: Env
  agent: Agent
  workspace: Workspace
  question: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  system: string
  chunks: Array<{ title: string; content: string }>
  memory: Array<{ content: string; kind: string }>
  suggestions: string[]
}

export interface ModelLoopResult {
  content: string
  toolRuns: ToolRun[]
  engine: 'openai'
  modelName: string
}

export async function runModelToolLoop(input: ModelLoopInput): Promise<ModelLoopResult> {
  const { env, agent, workspace, question, history, system, chunks, memory } = input
  const target = await resolveModelTarget(env.DB, env, agent, workspace)
  if (!target) throw new Error('NO_PROVIDER')

  const { actions, runs, notes } = await loadAvailableActions(env, workspace.id, agent)
  const toolRuns: ToolRun[] = [...runs]
  const toolPrompt = actions.length
    ? `Authorized tools:\n${actions
        .map(
          (action) =>
            `- ${modelToolName(action.action)}: ${action.description} Account: ${action.owner} (${action.accountLabel}); permission ${action.permission}.`,
        )
        .join('\n')}`
    : 'No external tool actions are currently executable. Explain the missing connection or permission instead of pretending to act.'
  const noteBlock = notes.length ? `\nTool constraints:\n${notes.map((note) => `- ${note}`).join('\n')}` : ''
  const knowledgeBlock = chunks.length
    ? chunks.map((chunk) => `[${chunk.title}]\n${chunk.content}`).join('\n\n')
    : 'No matching knowledge passages were retrieved.'
  const memoryBlock = memory.length ? memory.map((item) => `- (${item.kind}) ${item.content}`).join('\n') : 'No saved memories.'
  const fullSystem = `${system}

Workspace: ${workspace.company}
Language: ${agent.language}
Response style: ${agent.responseStyle}
Autonomy: ${agent.autonomy === 'approval' ? 'prepare external writes for approval' : 'may execute authorized actions, but sends always need approval'}

${toolPrompt}${noteBlock}

Memory:
${memoryBlock}

Knowledge passages retrieved for this question:
${knowledgeBlock}

Rules:
- Use the supplied tools when the user asks you to act. Never invent a tool result.
- Only the supplied tools are authorized. Never claim an action succeeded unless a tool result says it did.
- Cite a knowledge document title when you use it. Never invent prices, dates or commitments.
- If an action is waiting for approval, say clearly that it has not run yet.
- Keep formatting light Markdown: short paragraphs, bullets, bold labels.`

  const toolMapByName = new Map(actions.map((action) => [modelToolName(action.action), action]))
  const defs = actions.length ? toolDefinitions(actions, target.protocol) : null
  const temperature = Number.isFinite(agent.temperature) ? Math.max(0, Math.min(1.5, agent.temperature)) : 0.3
  let content = ''

  if (target.protocol === 'anthropic') {
    content = await anthropicLoop(target, fullSystem, question, history, defs, toolMapByName, toolRuns, env, workspace.id, agent, temperature)
  } else if (target.protocol === 'google') {
    content = await googleLoop(target, fullSystem, question, history, defs, toolMapByName, toolRuns, env, workspace.id, agent, temperature)
  } else {
    content = await openaiLoop(target, fullSystem, question, history, defs, toolMapByName, toolRuns, env, workspace.id, agent, temperature)
  }

  return {
    content: content.trim() || 'The model returned an empty reply. No action was taken.',
    toolRuns,
    engine: 'openai',
    modelName: target.model,
  }
}

async function executeCalls(
  calls: ToolCall[],
  map: Map<string, AvailableAction>,
  toolRuns: ToolRun[],
  env: Env,
  workspaceId: string,
  agent: Agent,
): Promise<Array<{ name: string; payload: unknown }>> {
  const results: Array<{ name: string; payload: unknown }> = []
  for (const call of calls.slice(0, MAX_TOOL_CALLS)) {
    const action = map.get(call.name)
    if (!action) {
      toolRuns.push({
        tool: 'engine',
        action: call.name,
        status: 'unavailable',
        detail: 'The model requested a tool that is not authorized for this agent.',
      })
      results.push({ name: call.name, payload: { ok: false, error: 'Tool not authorized.' } })
      continue
    }
    const payload = await runAction(env, workspaceId, agent, action, call.arguments, toolRuns)
    results.push({ name: call.name, payload })
  }
  return results
}

async function providerError(response: Response, provider: string): Promise<Error> {
  const body = await response.text().catch(() => '')
  return new Error(`${provider} returned HTTP ${response.status}${body ? `: ${truncate(body.replace(/\s+/g, ' '), 280)}` : ''}`)
}

async function openaiLoop(
  target: ModelTarget,
  system: string,
  question: string,
  history: Array<{ role: string; content: string }>,
  defs: unknown,
  map: Map<string, AvailableAction>,
  toolRuns: ToolRun[],
  env: Env,
  workspaceId: string,
  agent: Agent,
  temperature: number,
): Promise<string> {
  const messages: any[] = [
    { role: 'system', content: system },
    ...history.slice(-8).map((message) => ({ role: message.role, content: message.content })),
    { role: 'user', content: question },
  ]
  let lastText = ''
  for (let step = 0; step < MAX_STEPS; step += 1) {
    const response = await fetch(`${target.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${target.apiKey}` },
      body: JSON.stringify({
        model: target.model,
        temperature,
        max_tokens: 1200,
        messages,
        ...(defs ? { tools: defs, tool_choice: 'auto' } : {}),
      }),
      signal: AbortSignal.timeout(45_000),
    })
    if (!response.ok) throw await providerError(response, providerMap[target.provider]?.name ?? 'Provider')
    const data = (await response.json()) as any
    const choice = data.choices?.[0]?.message
    if (!choice) throw new Error('The provider returned no message.')
    lastText = String(choice.content ?? '').trim()
    const calls: any[] = Array.isArray(choice.tool_calls) ? choice.tool_calls : []
    if (!calls.length) return lastText
    messages.push({ role: 'assistant', content: choice.content ?? null, tool_calls: calls })
    const normalized: ToolCall[] = calls.map((call, index) => ({
      id: String(call.id ?? `call_${step}_${index}`),
      name: String(call.function?.name ?? ''),
      arguments: parseArguments(call.function?.arguments),
    }))
    const results = await executeCalls(normalized, map, toolRuns, env, workspaceId, agent)
    for (let index = 0; index < normalized.length; index += 1) {
      messages.push({
        role: 'tool',
        tool_call_id: normalized[index].id,
        content: truncate(JSON.stringify(results[index]?.payload ?? { ok: false }), MAX_RESULT_CHARS),
      })
    }
  }
  return `${lastText}\n\n_Tool execution stopped after ${MAX_STEPS} model steps. Review the tool results above before continuing._`
}

async function anthropicLoop(
  target: ModelTarget,
  system: string,
  question: string,
  history: Array<{ role: string; content: string }>,
  defs: unknown,
  map: Map<string, AvailableAction>,
  toolRuns: ToolRun[],
  env: Env,
  workspaceId: string,
  agent: Agent,
  temperature: number,
): Promise<string> {
  const messages: any[] = [
    ...history.slice(-8).map((message) => ({ role: message.role, content: message.content })),
    { role: 'user', content: question },
  ]
  let lastText = ''
  for (let step = 0; step < MAX_STEPS; step += 1) {
    const response = await fetch(`${target.baseUrl}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': target.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: target.model,
        max_tokens: 1200,
        temperature,
        system,
        messages,
        ...(defs ? { tools: defs } : {}),
      }),
      signal: AbortSignal.timeout(45_000),
    })
    if (!response.ok) throw await providerError(response, 'Anthropic')
    const data = (await response.json()) as any
    const parts: any[] = Array.isArray(data.content) ? data.content : []
    lastText = parts.filter((part) => part.type === 'text').map((part) => part.text ?? '').join('\n').trim()
    const uses = parts.filter((part) => part.type === 'tool_use')
    if (!uses.length) return lastText
    messages.push({ role: 'assistant', content: parts })
    const calls: ToolCall[] = uses.map((part, index) => ({
      id: String(part.id ?? `tool_${step}_${index}`),
      name: String(part.name ?? ''),
      arguments: part.input && typeof part.input === 'object' ? part.input : {},
    }))
    const results = await executeCalls(calls, map, toolRuns, env, workspaceId, agent)
    messages.push({
      role: 'user',
      content: uses.map((_part, index) => ({
        type: 'tool_result',
        tool_use_id: calls[index].id,
        content: truncate(JSON.stringify(results[index]?.payload ?? { ok: false }), MAX_RESULT_CHARS),
      })),
    })
  }
  return `${lastText}\n\n_Tool execution stopped after ${MAX_STEPS} model steps. Review the tool results above before continuing._`
}

async function googleLoop(
  target: ModelTarget,
  system: string,
  question: string,
  history: Array<{ role: string; content: string }>,
  defs: unknown,
  map: Map<string, AvailableAction>,
  toolRuns: ToolRun[],
  env: Env,
  workspaceId: string,
  agent: Agent,
  temperature: number,
): Promise<string> {
  const contents: any[] = [
    ...history.slice(-8).map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    })),
    { role: 'user', parts: [{ text: question }] },
  ]
  let lastText = ''
  for (let step = 0; step < MAX_STEPS; step += 1) {
    const response = await fetch(
      `${target.baseUrl}/models/${encodeURIComponent(target.model)}:generateContent?key=${encodeURIComponent(target.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          ...(defs ? { tools: defs } : {}),
          generationConfig: { temperature, maxOutputTokens: 1200 },
        }),
        signal: AbortSignal.timeout(45_000),
      },
    )
    if (!response.ok) throw await providerError(response, 'Google Gemini')
    const data = (await response.json()) as any
    const parts: any[] = data.candidates?.[0]?.content?.parts ?? []
    lastText = parts.filter((part) => typeof part.text === 'string').map((part) => part.text).join('\n').trim()
    const calls: any[] = parts.filter((part) => part.functionCall)
    if (!calls.length) return lastText
    contents.push({ role: 'model', parts })
    const normalized: ToolCall[] = calls.map((part, index) => ({
      id: String(part.functionCall?.id ?? `call_${step}_${index}`),
      name: String(part.functionCall?.name ?? ''),
      arguments: part.functionCall?.args && typeof part.functionCall.args === 'object' ? part.functionCall.args : {},
    }))
    const results = await executeCalls(normalized, map, toolRuns, env, workspaceId, agent)
    contents.push({
      role: 'user',
      parts: normalized.map((call, index) => ({
        functionResponse: {
          name: call.name,
          response: { result: results[index]?.payload ?? { ok: false } },
        },
      })),
    })
  }
  return `${lastText}\n\n_Tool execution stopped after ${MAX_STEPS} model steps. Review the tool results above before continuing._`
}

function parseArguments(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object') return value as Record<string, unknown>
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  return {}
}
