// The natural-language builder. It turns a free-form description into a real
// agent configuration: category, tools, tasks, audience, autonomy, knowledge
// requirements and a system instruction. Deterministic and inspectable — the
// wizard shows every inferred field so the user can correct it.

import { categories, categoryMap, tools, type CategoryDef } from '../shared/catalog'
import type { AgentBlueprint, Autonomy, ChannelKey } from '../shared/types'

const VERB_MAP: Record<string, string> = {
  researches: 'Research',
  research: 'Research',
  checks: 'Check',
  check: 'Check',
  monitors: 'Monitor',
  monitor: 'Monitor',
  tracks: 'Track',
  track: 'Track',
  communicates: 'Communicate with',
  communicate: 'Communicate with',
  contacts: 'Contact',
  contact: 'Contact',
  receives: 'Receive and triage',
  receive: 'Receive and triage',
  sends: 'Send',
  send: 'Send',
  drafts: 'Draft',
  draft: 'Draft',
  writes: 'Write',
  write: 'Write',
  prepares: 'Prepare',
  prepare: 'Prepare',
  creates: 'Create',
  create: 'Create',
  manages: 'Manage',
  manage: 'Manage',
  handles: 'Handle',
  handle: 'Handle',
  organises: 'Organise',
  organizes: 'Organise',
  organise: 'Organise',
  organize: 'Organise',
  schedules: 'Schedule',
  schedule: 'Schedule',
  books: 'Book',
  book: 'Book',
  reminds: 'Remind the user about',
  remind: 'Remind the user about',
  answers: 'Answer',
  answer: 'Answer',
  replies: 'Reply to',
  reply: 'Reply to',
  reports: 'Report',
  report: 'Report',
  summarises: 'Summarise',
  summarizes: 'Summarise',
  summarise: 'Summarise',
  summarize: 'Summarise',
  analyses: 'Analyse',
  analyzes: 'Analyse',
  analyse: 'Analyse',
  analyze: 'Analyse',
  finds: 'Find',
  find: 'Find',
  builds: 'Build',
  build: 'Build',
  plans: 'Plan',
  plan: 'Plan',
  reviews: 'Review',
  review: 'Review',
  screens: 'Screen',
  screen: 'Screen',
  categorises: 'Categorise',
  categorizes: 'Categorise',
  reconciles: 'Reconcile',
  reconcile: 'Reconcile',
  flags: 'Flag',
  flag: 'Flag',
  updates: 'Update',
  update: 'Update',
  follows: 'Follow up on',
  follow: 'Follow up on',
  teaches: 'Teach',
  teach: 'Teach',
  explains: 'Explain',
  explain: 'Explain',
  generates: 'Generate',
  generate: 'Generate',
  posts: 'Draft posts about',
  converts: 'Convert',
  qualifies: 'Qualify',
  keeps: 'Keep track of',
  alerts: 'Alert the user about',
  escalates: 'Escalate',
  fills: 'Fill',
  completes: 'Complete',
  extracts: 'Extract',
  collects: 'Collect',
  compares: 'Compare',
  labels: 'Label',
  scores: 'Score',
  responds: 'Respond to',
}

const NAME_POOL: Record<string, string[]> = {
  business: ['Atlas', 'Meridian', 'Operator'],
  sales: ['Pitch', 'Hunter', 'Nova'],
  marketing: ['Ember', 'Story', 'Amp'],
  executive: ['Vera', 'Chief', 'Ada'],
  support: ['Solace', 'Helpdesk', 'Iris'],
  research: ['Scout', 'Lens', 'Fathom'],
  people: ['Talent', 'Bridge', 'Mira'],
  finance: ['Ledger', 'Tally', 'Coin'],
  education: ['Mentor', 'Tutor', 'Kite'],
  social: ['Buzz', 'Echo', 'Postbox'],
  personal: ['Aide', 'Daylight', 'Pip'],
  custom: ['Maker', 'Wildcard', 'Orion'],
}

const AUTONOMY_APPROVAL = /approv|review|check with me|confirm|ask (me|before)|permission|human|sign.?off|before sending|don't send/i
const AUTONOMY_AUTO = /automatic|on its own|without asking|auto-?pilot|hands.?free|by itself|independently/i

export interface BlueprintInput {
  description: string
  category?: string
  name?: string
  autonomy?: Autonomy
  tone?: string
  audience?: string
  model?: string
  tools?: string[]
  accountName?: string
}

function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function scoreCategory(text: string): Array<{ def: CategoryDef; score: number }> {
  const lower = text.toLowerCase()
  return categories
    .filter((c) => c.key !== 'custom')
    .map((def) => {
      let score = 0
      for (const keyword of def.keywords) {
        if (keyword.length <= 5 && !keyword.includes(' ')) {
          const re = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
          if (re.test(lower)) score += 2
        } else if (lower.includes(keyword)) {
          score += keyword.includes(' ') ? 3 : 2
        }
      }
      if (new RegExp(`\\b${def.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lower)) score += 4
      return { def, score }
    })
    .sort((a, b) => b.score - a.score)
}

function detectTools(description: string, category: CategoryDef): string[] {
  const lower = description.toLowerCase()
  const scores = new Map<string, number>()
  for (const tool of tools) {
    if (tool.status === 'soon') continue
    let score = 0
    for (const keyword of tool.keywords) {
      if (lower.includes(keyword)) score += keyword.length > 6 ? 2 : 1.5
    }
    if (lower.includes(tool.name.toLowerCase())) score += 3
    if (score > 0) scores.set(tool.key, score)
  }
  // Category defaults keep a sparse description useful.
  for (const tool of category.defaultTools) {
    scores.set(tool, (scores.get(tool) ?? 0) + 0.75)
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([, score]) => score >= 1)
    .slice(0, 6)
    .map(([key]) => key)
}

function toTask(clause: string): string | null {
  let text = normalise(clause)
    .replace(/^[,;:.\-–—\s]+/, '')
    .replace(/^(?:and|also|then|plus)\s+/i, '')
    .replace(
      /^(?:i (?:need|want|would like|am looking for)\s+(?:an?\s+)?(?:ai\s+)?(?:agent|assistant|bot)?\s*(?:that|who|which|to)?\s*)/i,
      '',
    )
    .replace(/^(?:build|create|make)\s+(?:me\s+)?(?:an?\s+)?(?:ai\s+)?(?:agent|assistant|bot)?\s*(?:that|who|which|to)?\s*/i, '')
    .replace(/^(?:an?\s+)?(?:ai\s+)?(?:agent|assistant|bot)\s+(?:that|who|which)\s+/i, '')
    .replace(/^(?:that|who|which|it|they)\s+/i, '')
    .replace(/^(?:he|she)\s+/i, '')
    .replace(/[.!?]+$/, '')
    .trim()

  if (!text) return null
  const words = text.split(' ')
  const first = words[0]?.toLowerCase().replace(/[^a-z]/g, '') ?? ''
  const mapped = VERB_MAP[first]
  if (mapped) {
    const rest = words.slice(1).join(' ')
    return normalise(`${mapped} ${rest}`)
      .replace(/\b(with|to|for)\s+\1\b/gi, '$1')
      .replace(/\s+/g, ' ')
      .slice(0, 110)
  }
  if (/^(?:help|support|assist)\b/i.test(text)) {
    return normalise(`Support ${text.replace(/^(?:help|support|assist)\s+(?:me\s+)?(?:with\s+)?/i, '')}`).slice(0, 110)
  }
  return null
}

function extractTasks(description: string, category: CategoryDef): string[] {
  const cleaned = description
    .replace(/\b(?:etc|and so on)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  const clauses = cleaned
    .split(/[,;.\n]|\band\b|\bthen\b|\bplus\b/i)
    .map((part) => part.trim())
    .filter(Boolean)

  const tasks: string[] = []
  for (const clause of clauses) {
    const task = toTask(clause)
    if (!task || task.split(' ').length < 2) continue
    if (/^(?:business|sales|marketing|executive|customer support|research|education|finance|custom)\b/i.test(task)) continue
    const key = task.toLowerCase().slice(0, 40)
    if (tasks.some((existing) => existing.toLowerCase().slice(0, 40) === key)) continue
    tasks.push(task)
    if (tasks.length >= 5) break
  }

  for (const fallback of category.defaultTasks) {
    if (tasks.length >= 4) break
    if (!tasks.some((task) => task.toLowerCase() === fallback.toLowerCase())) tasks.push(fallback)
  }
  return tasks.slice(0, 6)
}

function pickName(description: string, category: CategoryDef): string {
  const explicit = /(?:call(?:ed)? it|name it|named|called)\s+["“']?([A-Z][a-zA-Z0-9]{1,18})/.exec(description)
  if (explicit?.[1]) return explicit[1]
  const pool = NAME_POOL[category.key] ?? NAME_POOL.custom
  let hash = 0
  for (let i = 0; i < description.length; i += 1) hash = (hash * 31 + description.charCodeAt(i)) >>> 0
  return pool[hash % pool.length]
}

function knowledgeFor(category: CategoryDef, description: string): AgentBlueprint['knowledge'] {
  const lower = description.toLowerCase()
  const suggestions: AgentBlueprint['knowledge'] = []
  const add = (title: string, why: string) => {
    if (!suggestions.some((s) => s.title === title)) suggestions.push({ title, why })
  }

  if (category.key === 'business' || lower.includes('supplier')) {
    add('Product catalogue and price list', 'So prices and specifications come from your documents, never from the model.')
    add('Approved supplier list', 'Names, contacts and lead times for supplier conversations.')
  }
  if (category.key === 'sales') {
    add('Ideal customer profile and offer', 'Keeps outreach grounded in what you actually sell.')
    add('Case studies and proof points', 'Gives the agent material for personal, credible emails.')
  }
  if (category.key === 'executive' || lower.includes('email') || lower.includes('inbox')) {
    add('Writing style guide', 'Drafts sound like the person, not like a chatbot.')
    add('Priority contacts', 'Decides who gets a same-day reply.')
  }
  if (category.key === 'support') {
    add('Policies and product documentation', 'The only source of truth for customer answers.')
    add('Escalation rules', 'Tells the agent when a human must take over.')
  }
  if (category.key === 'research') {
    add('Tracked competitor list', 'Defines the universe the agent watches.')
    add('Positioning notes', 'Lets the brief explain why a change matters to you.')
  }
  if (category.key === 'people') add('Job descriptions and HR policy', 'Screening only against written criteria.')
  if (category.key === 'finance') add('Chart of accounts and ledger export', 'Categorisation rules and source rows.')
  if (category.key === 'education') add('Course material and learning outcomes', 'Lessons follow your curriculum.')
  if (category.key === 'social') add('Brand voice and content pillars', 'Keeps posts consistent across channels.')
  if (category.key === 'marketing') add('Brand guide and campaign history', 'No invented claims, consistent voice.')
  if (category.key === 'personal') add('Personal preferences and commitments', 'Context for reminders and planning.')

  add('Business policies', 'Rules the agent must follow before it acts.')
  return suggestions.slice(0, 4)
}

function channelsFor(category: CategoryDef, enabledTools: string[]): ChannelKey[] {
  const list: ChannelKey[] = ['internal', 'website']
  if (enabledTools.includes('telegram')) list.push('telegram')
  if (category.key === 'research' || category.key === 'custom') list.push('api')
  return list
}

export function generateBlueprint(input: BlueprintInput): AgentBlueprint {
  const description = normalise(input.description)
  if (description.length < 12) {
    throw new Error('DESCRIPTION_TOO_SHORT')
  }

  const ranked = scoreCategory(description)
  const top = ranked[0]
  const category =
    input.category && categoryMap[input.category]
      ? categoryMap[input.category]
      : top && top.score > 0
        ? top.def
        : categoryMap.custom
  const tasks = extractTasks(description, category)
  const enabledTools = input.tools?.length ? input.tools : detectTools(description, category)
  const name = (input.name?.trim() || pickName(description, category)).slice(0, 32)

  const impliedAutonomy: Autonomy =
    input.autonomy ??
    (AUTONOMY_APPROVAL.test(description)
      ? 'approval'
      : AUTONOMY_AUTO.test(description)
        ? 'auto'
        : ['finance', 'sales', 'business', 'support'].includes(category.key)
          ? 'approval'
          : 'auto')

  const audience = input.audience?.trim() || category.audience
  const tone = input.tone || (category.key === 'executive' ? 'concise' : category.key === 'education' ? 'warm' : 'professional')
  const model = input.model || 'core'
  const tagline = buildTagline(category, tasks)
  const instruction = buildInstructions({ name, category, tasks, audience, autonomy: impliedAutonomy, tone, enabledTools, accountName: input.accountName })

  const toolNames = enabledTools.map((key) => key)
  const summary = `${name} is a ${category.name.toLowerCase()} agent for ${audience.toLowerCase()}. It will ${tasks
    .slice(0, 3)
    .map((task) => task.charAt(0).toLowerCase() + task.slice(1))
    .join(', ')}. It uses ${toolNames.length} tool${toolNames.length === 1 ? '' : 's'} and ${
    impliedAutonomy === 'approval' ? 'asks for approval before external actions' : 'acts on routine work without asking'
  }.`

  const signals = ranked
    .filter((entry) => entry.score > 0)
    .slice(0, 2)
    .map((entry) => `${entry.def.name} signals matched`)
  if (AUTONOMY_APPROVAL.test(description)) signals.push('Approval language detected')
  if (AUTONOMY_AUTO.test(description)) signals.push('Automatic execution requested')
  if (enabledTools.includes('gmail')) signals.push('Email mentioned')
  if (enabledTools.includes('web_search')) signals.push('Research mentioned')
  if (tasks.length >= 4) signals.push(`${tasks.length} tasks parsed`)

  const followUps = [
    impliedAutonomy === 'approval'
      ? 'Which actions must always wait for your approval?'
      : 'Which actions should still ask before running?',
    `Which mailbox or account should ${name} use first?`,
    'What should the agent do when the answer is not in your documents?',
  ]

  const confidence = Math.max(
    35,
    Math.min(97, 40 + Math.min(description.split(' ').length, 45) + Math.min(tasks.length, 5) * 4 + (ranked[0]?.score ?? 0)),
  )

  return {
    name,
    category: category.key,
    tagline,
    instructions: input.description ? instruction : instruction,
    responsibilities: tasks.slice(0, 3),
    tasks,
    audience,
    autonomy: impliedAutonomy,
    tone,
    model,
    channels: channelsFor(category, enabledTools),
    tools: enabledTools,
    knowledge: knowledgeFor(category, description),
    summary,
    signals,
    followUps,
    confidence,
  }
}

function buildTagline(category: CategoryDef, tasks: string[]): string {
  const joined = tasks.slice(0, 2).join(' · ')
  if (joined.length >= 12) return joined.length > 62 ? `${joined.slice(0, 59)}…` : joined
  if (tasks[0]) {
    const first = tasks[0].replace(/^(Research|Check|Draft|Manage|Monitor|Track|Prepare)\s+/i, '').trim()
    if (first.length > 8) return `${first.charAt(0).toUpperCase()}${first.slice(1)}`.slice(0, 62)
  }
  return category.examples[0] ?? category.name
}

function buildInstructions(input: {
  name: string
  category: CategoryDef
  tasks: string[]
  audience: string
  autonomy: Autonomy
  tone: string
  enabledTools: string[]
  accountName?: string
}): string {
  const { name, category, tasks, audience, autonomy, tone, enabledTools, accountName } = input
  const toolText = enabledTools.length
    ? enabledTools
        .map((key) => tools.find((t) => t.key === key)?.name)
        .filter(Boolean)
        .join(', ')
    : 'no external tools'

  return `You are ${name}, a ${category.name.toLowerCase()} agent${accountName ? ` working for ${accountName}` : ''}. You work for ${audience}.

Primary responsibilities:
${tasks.map((task) => `- ${task}`).join('\n')}

How you work:
- Answer from the workspace knowledge base and tool results first. Name the document you used.
- If something is not in the knowledge base or a tool result, say what is missing. Never invent a price, date, person or commitment.
- ${
    autonomy === 'approval'
      ? 'Prepare external actions (email, messages, forms, bookings) as drafts and wait for approval before anything leaves the workspace.'
      : 'You may complete routine actions yourself, but record every action in the activity log and escalate anything irreversible.'
  }
- Keep replies ${tone}, structured and short enough to act on. Lead with the answer, then the detail.
- Your available tools are ${toolText}. If a task needs a tool you do not have, say which one you would need.
- Say plainly when you are unsure. A precise "I do not know" is better than a plausible guess.

Category guidance: ${category.blurb}`
}

export function blueprintFromTemplate(template: {
  name: string
  category: string
  tagline: string
  description: string
  tools: string[]
  autonomy: Autonomy
  tasks: string[]
  instructions: string
  audience: string
  color?: string
}): AgentBlueprint {
  const base = generateBlueprint({ description: template.description, category: template.category, tools: template.tools, autonomy: template.autonomy })
  return {
    ...base,
    name: template.name.split(' ')[0],
    tagline: template.tagline,
    tasks: template.tasks,
    responsibilities: template.tasks.slice(0, 3),
    instructions: template.instructions,
    audience: template.audience,
    tools: template.tools,
    autonomy: template.autonomy,
    knowledge: knowledgeFor(categoryMap[template.category] ?? categoryMap.custom, template.description),
  }
}
