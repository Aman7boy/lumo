// The platform catalogue: agent categories, the tool library, plans and
// starter templates. Shared by the Worker (blueprint generation, plan limits)
// and the React app (pickers, pricing, marketing sections).

import type { Autonomy, ChannelKey, PlanKey, ToolRun } from './types'

export interface CategoryDef {
  key: string
  name: string
  blurb: string
  icon: string
  examples: string[]
  color: string
  defaultTools: string[]
  defaultTasks: string[]
  audience: string
  keywords: string[]
}

export const categories: CategoryDef[] = [
  {
    key: 'business',
    name: 'Business',
    blurb: 'Run operations, coordinate suppliers and keep processes moving.',
    icon: 'Briefcase',
    examples: ['Business manager', 'Operations coordinator'],
    color: '#ff7a45',
    defaultTools: ['gmail', 'sheets', 'notifications', 'files'],
    defaultTasks: ['Summarise the state of operations', 'Draft supplier correspondence', 'Track recurring issues'],
    audience: 'Owners and operations teams',
    keywords: ['business', 'operations', 'supplier', 'procurement', 'inventory', 'manufactur', 'logistics', 'process', 'admin'],
  },
  {
    key: 'sales',
    name: 'Sales',
    blurb: 'Find leads, qualify them and keep follow-ups moving.',
    icon: 'TrendingUp',
    examples: ['Lead researcher', 'Sales assistant'],
    color: '#ffb547',
    defaultTools: ['gmail', 'web_search', 'sheets', 'calendar'],
    defaultTasks: ['Research target accounts', 'Draft outreach emails', 'Prepare follow-up lists'],
    audience: 'Sales teams and founders',
    keywords: ['sales', 'lead', 'prospect', 'outreach', 'pipeline', 'quotation', 'quote', 'crm', 'deal', 'cold email'],
  },
  {
    key: 'marketing',
    name: 'Marketing',
    blurb: 'Plan campaigns, write copy and keep channels consistent.',
    icon: 'Megaphone',
    examples: ['Marketing strategist', 'Campaign planner'],
    color: '#ff4d6d',
    defaultTools: ['web_search', 'sheets', 'gmail', 'notifications'],
    defaultTasks: ['Draft a campaign brief', 'Plan a content calendar', 'Summarise campaign results'],
    audience: 'Marketing teams and agencies',
    keywords: ['marketing', 'campaign', 'brand', 'copywriting', 'content', 'seo', 'advertis', 'newsletter', 'agency'],
  },
  {
    key: 'executive',
    name: 'Executive',
    blurb: 'Protect your calendar, inbox and attention.',
    icon: 'Crown',
    examples: ['Executive assistant', 'Personal secretary'],
    color: '#c084fc',
    defaultTools: ['gmail', 'calendar', 'notifications', 'files'],
    defaultTasks: ['Triage the inbox', 'Schedule and reschedule meetings', 'Prepare a daily briefing'],
    audience: 'Founders and executives',
    keywords: ['executive assistant', 'secretary', 'calendar', 'meeting', 'inbox', 'briefing', 'schedule', 'executive'],
  },
  {
    key: 'support',
    name: 'Customer support',
    blurb: 'Answer customers from your own policies and escalate the rest.',
    icon: 'LifeBuoy',
    examples: ['Support agent', 'Helpdesk triage'],
    color: '#38bdf8',
    defaultTools: ['gmail', 'telegram', 'files', 'notifications'],
    defaultTasks: ['Answer routine questions', 'Summarise open tickets', 'Escalate anything unresolved'],
    audience: 'Support and success teams',
    keywords: ['support', 'customer service', 'helpdesk', 'ticket', 'refund', 'complaint', 'faq', 'escalat'],
  },
  {
    key: 'research',
    name: 'Research',
    blurb: 'Gather sources, compare options and write cited briefs.',
    icon: 'Telescope',
    examples: ['Market researcher', 'Competitor analyst'],
    color: '#4ade80',
    defaultTools: ['web_search', 'browser', 'files', 'sheets'],
    defaultTasks: ['Collect sources', 'Compare competitors', 'Write a brief with citations'],
    audience: 'Strategy and research teams',
    keywords: ['research', 'competitor', 'analysis', 'analyse', 'benchmark', 'market', 'sources', 'intelligence', 'price check'],
  },
  {
    key: 'people',
    name: 'People and HR',
    blurb: 'Screen applicants, onboard hires and answer policy questions.',
    icon: 'Users',
    examples: ['Recruiter', 'HR assistant'],
    color: '#f472b6',
    defaultTools: ['gmail', 'files', 'calendar', 'notifications'],
    defaultTasks: ['Screen candidate applications', 'Draft interview schedules', 'Answer policy questions'],
    audience: 'People and operations teams',
    keywords: ['hr', 'recruit', 'hiring', 'candidate', 'onboard', 'vacancy', 'interview', 'policy', 'people'],
  },
  {
    key: 'finance',
    name: 'Finance',
    blurb: 'Reconcile records, draft reports and flag anomalies.',
    icon: 'Receipt',
    examples: ['Bookkeeper', 'Financial reporting'],
    color: '#34d399',
    defaultTools: ['sheets', 'files', 'database', 'notifications'],
    defaultTasks: ['Categorise transactions', 'Draft the monthly summary', 'Flag unusual spend'],
    audience: 'Finance teams and founders',
    keywords: ['finance', 'financ', 'account', 'bookkeep', 'invoice', 'expense', 'budget', 'reconcil', 'payroll'],
  },
  {
    key: 'education',
    name: 'Education',
    blurb: 'Teach a subject, plan lessons and assess progress.',
    icon: 'GraduationCap',
    examples: ['Tutor', 'Course designer'],
    color: '#a78bfa',
    defaultTools: ['files', 'web_search', 'calendar', 'notifications'],
    defaultTasks: ['Build a lesson plan', 'Explain concepts at the learner level', 'Set practice work'],
    audience: 'Students, teachers and training teams',
    keywords: ['teach', 'tutor', 'lesson', 'curriculum', 'student', 'learn', 'exam', 'training', 'course'],
  },
  {
    key: 'social',
    name: 'Social media',
    blurb: 'Plan posts, adapt copy per channel and report on engagement.',
    icon: 'Share2',
    examples: ['Social manager', 'Community assistant'],
    color: '#fb7185',
    defaultTools: ['web_search', 'sheets', 'notifications', 'browser'],
    defaultTasks: ['Draft a weekly post plan', 'Adapt copy to each channel', 'Summarise engagement'],
    audience: 'Social and community teams',
    keywords: ['social', 'instagram', 'twitter', 'linkedin', 'tiktok', 'post', 'community', 'engagement'],
  },
  {
    key: 'personal',
    name: 'Personal',
    blurb: 'A general assistant for your own work and life admin.',
    icon: 'Sparkles',
    examples: ['Personal assistant', 'Daily planner'],
    color: '#fbbf24',
    defaultTools: ['gmail', 'calendar', 'notifications', 'web_search'],
    defaultTasks: ['Plan the day', 'Track commitments', 'Draft personal correspondence'],
    audience: 'Individuals',
    keywords: ['personal', 'my day', 'remind', 'todo', 'habit', 'organise my', 'life admin', 'trip', 'travel'],
  },
  {
    key: 'custom',
    name: 'Custom',
    blurb: 'Anything that does not fit a category. Describe it and build it.',
    icon: 'Wand2',
    examples: ['Describe your own'],
    color: '#e2e8f0',
    defaultTools: ['files', 'web_search', 'notifications'],
    defaultTasks: ['Interpret the request', 'Draft a plan', 'Report back with next steps'],
    audience: 'Anyone with a specific job in mind',
    keywords: [],
  },
]

export const categoryMap = Object.fromEntries(categories.map((c) => [c.key, c])) as Record<string, CategoryDef>

export interface ToolDef {
  key: string
  name: string
  group: 'Communication' | 'Research' | 'Data' | 'Automation' | 'Interface'
  capability: string
  description: string
  icon: string
  status: 'available' | 'beta' | 'soon'
  fields: Array<{ key: string; label: string; placeholder: string }>
  keywords: string[]
}

export const tools: ToolDef[] = [
  {
    key: 'gmail',
    name: 'Gmail',
    group: 'Communication',
    capability: 'Read, draft and send emails',
    description: 'Connect a mailbox so the agent can triage inbound mail and prepare replies.',
    icon: 'Mail',
    status: 'available',
    fields: [{ key: 'address', label: 'Mailbox address', placeholder: 'team@company.com' }],
    keywords: ['email', 'mail', 'gmail', 'inbox', 'reply', 'respond', 'send', 'quotation', 'quote'],
  },
  {
    key: 'telegram',
    name: 'Telegram',
    group: 'Communication',
    capability: 'Send and receive messages',
    description: 'Give the agent a Telegram bot so people can talk to it from their phones.',
    icon: 'Send',
    status: 'available',
    fields: [{ key: 'botName', label: 'Bot username', placeholder: '@my_agent_bot' }],
    keywords: ['telegram', 'chat', 'message', 'bot', 'whatsapp'],
  },
  {
    key: 'browser',
    name: 'Browser',
    group: 'Automation',
    capability: 'Browse websites and complete forms',
    description: 'Playwright worker that opens pages, reads them and fills forms you approve.',
    icon: 'Globe',
    status: 'beta',
    fields: [{ key: 'allowedDomains', label: 'Allowed domains', placeholder: 'supplier.com, competitor.com' }],
    keywords: ['browser', 'website', 'scrape', 'form', 'portal', 'automate', 'browse'],
  },
  {
    key: 'web_search',
    name: 'Web search',
    group: 'Research',
    capability: 'Research information from the web',
    description: 'Search the web and return cited snippets instead of guesses.',
    icon: 'Search',
    status: 'available',
    fields: [{ key: 'provider', label: 'Search provider', placeholder: 'Brave, Tavily, Serper' }],
    keywords: ['search', 'web', 'research', 'google', 'news', 'market', 'competitor', 'online'],
  },
  {
    key: 'files',
    name: 'File reader',
    group: 'Data',
    capability: 'Read PDF, Word, Excel and text files',
    description: 'Parse uploaded documents into the agent knowledge base.',
    icon: 'FileText',
    status: 'available',
    fields: [],
    keywords: ['pdf', 'word', 'excel', 'document', 'file', 'catalogue', 'catalog', 'policy', 'contract'],
  },
  {
    key: 'database',
    name: 'Database',
    group: 'Data',
    capability: 'Retrieve and save structured records',
    description: 'Give the agent private tables for leads, suppliers or requests.',
    icon: 'Database',
    status: 'available',
    fields: [],
    keywords: ['database', 'record', 'table', 'store', 'save', 'crm', 'inventory', 'list'],
  },
  {
    key: 'calendar',
    name: 'Calendar',
    group: 'Automation',
    capability: 'Schedule and move meetings',
    description: 'Read availability and propose or book slots.',
    icon: 'CalendarDays',
    status: 'available',
    fields: [{ key: 'calendarId', label: 'Calendar', placeholder: 'primary' }],
    keywords: ['calendar', 'meeting', 'schedule', 'appointment', 'book', 'invite'],
  },
  {
    key: 'forms',
    name: 'Form filler',
    group: 'Automation',
    capability: 'Complete forms automatically',
    description: 'Fill repetitive order, tender or onboarding forms and stop for approval.',
    icon: 'ClipboardList',
    status: 'beta',
    fields: [{ key: 'targetForms', label: 'Forms to know', placeholder: 'Tender portal, supplier onboarding' }],
    keywords: ['form', 'fill', 'submit', 'tender', 'application', 'onboarding form'],
  },
  {
    key: 'sheets',
    name: 'Google Sheets',
    group: 'Data',
    capability: 'Read and update spreadsheets',
    description: 'Append rows, read ranges and keep a live pipeline sheet.',
    icon: 'Table2',
    status: 'available',
    fields: [{ key: 'sheetId', label: 'Spreadsheet link', placeholder: 'https://docs.google.com/...' }],
    keywords: ['sheet', 'spreadsheet', 'excel', 'csv', 'rows', 'tracker'],
  },
  {
    key: 'drive',
    name: 'Google Drive',
    group: 'Data',
    capability: 'List and open Drive files',
    description: 'Give the agent read access to the Drive account you connect. It still cannot download a file you did not authorize.',
    icon: 'HardDrive',
    status: 'available',
    fields: [],
    keywords: ['drive', 'file', 'folder', 'storage', 'document'],
  },
  {
    key: 'docs',
    name: 'Google Docs',
    group: 'Data',
    capability: 'Read Google Docs',
    description: 'Read the text and tables of documents in the connected Google account.',
    icon: 'FileText',
    status: 'available',
    fields: [],
    keywords: ['docs', 'google docs', 'document', 'write-up'],
  },
  {
    key: 'outlook',
    name: 'Microsoft Outlook',
    group: 'Communication',
    capability: 'Read and send Outlook mail',
    description: 'Connect a Microsoft 365 mailbox through the same account framework. Sends always need approval.',
    icon: 'Mail',
    status: 'available',
    fields: [],
    keywords: ['outlook', 'microsoft', 'office', 'email', 'mail'],
  },
  {
    key: 'onedrive',
    name: 'OneDrive',
    group: 'Data',
    capability: 'List OneDrive files',
    description: 'List files in the connected Microsoft 365 OneDrive.',
    icon: 'HardDrive',
    status: 'available',
    fields: [],
    keywords: ['onedrive', 'microsoft', 'file', 'storage'],
  },
  {
    key: 'excel',
    name: 'Microsoft Excel',
    group: 'Data',
    capability: 'Read Excel workbooks',
    description: 'Read used ranges from workbooks stored in the connected OneDrive.',
    icon: 'Table2',
    status: 'available',
    fields: [],
    keywords: ['excel', 'microsoft', 'spreadsheet', 'workbook'],
  },
  {
    key: 'documents',
    name: 'Document intelligence',
    group: 'Data',
    capability: 'Read scans, invoices and spreadsheets',
    description: 'Extract text and tables from uploads, generate XLSX and PDF outputs, and save reviewed records.',
    icon: 'ScanLine',
    status: 'available',
    fields: [],
    keywords: ['scan', 'invoice', 'ocr', 'pdf', 'excel', 'spreadsheet', 'extract'],
  },
  {
    key: 'voice',
    name: 'Voice',
    group: 'Interface',
    capability: 'Listen and respond by voice',
    description: 'Speech in, speech out through your own STT and TTS providers, with automatic failover.',
    icon: 'Mic',
    status: 'available',
    fields: [],
    keywords: ['voice', 'call', 'phone', 'speak', 'listen', 'audio'],
  },
  {
    key: 'notifications',
    name: 'Notifications',
    group: 'Interface',
    capability: 'Notify people about important events',
    description: 'Send digests, alerts and approval requests to the team.',
    icon: 'BellRing',
    status: 'available',
    fields: [{ key: 'channel', label: 'Notify where', placeholder: 'Email or Telegram' }],
    keywords: ['notify', 'notification', 'alert', 'remind', 'digest', 'report', 'update me'],
  },
  {
    key: 'api',
    name: 'Webhook and API',
    group: 'Automation',
    capability: 'Call your own systems',
    description: 'POST to an internal endpoint when the agent finishes a task.',
    icon: 'Webhook',
    status: 'beta',
    fields: [{ key: 'endpoint', label: 'Endpoint', placeholder: 'https://api.company.com/hook' }],
    keywords: ['api', 'webhook', 'integration', 'system', 'erp', 'endpoint'],
  },
]

export const toolMap = Object.fromEntries(tools.map((t) => [t.key, t])) as Record<string, ToolDef>

export interface PlanDef {
  key: PlanKey
  name: string
  price: number | null
  cadence: string
  agentLimit: number
  blurb: string
  features: string[]
  popular?: boolean
}

export const plans: PlanDef[] = [
  {
    key: 'free',
    name: 'Free',
    price: 0,
    cadence: 'forever',
    agentLimit: 1,
    blurb: 'Build and test one agent. No card required.',
    features: ['1 agent', 'Knowledge uploads', 'Conversation history', 'Website chatbot'],
  },
  {
    key: 'starter',
    name: 'Starter',
    price: 500,
    cadence: 'per month',
    agentLimit: 3,
    blurb: 'For individuals running a few jobs.',
    features: ['3 agents', 'All 12 categories', 'Tool library', 'Scheduled tasks', 'Telegram bot'],
  },
  {
    key: 'professional',
    name: 'Professional',
    price: 1500,
    cadence: 'per month',
    agentLimit: 10,
    blurb: 'For teams replacing repetitive work.',
    popular: true,
    features: ['10 agents', 'Per-agent memory', 'Browser automation', 'Approval workflows', 'Analytics'],
  },
  {
    key: 'business',
    name: 'Business',
    price: 5000,
    cadence: 'per month',
    agentLimit: 30,
    blurb: 'For companies running agents across departments.',
    features: ['30 agents', 'Workspace analytics', 'Priority execution', 'API deployment', 'Onboarding support'],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: null,
    cadence: 'custom',
    agentLimit: 200,
    blurb: 'Custom agents, integrations and deployment.',
    features: ['Custom agent development', 'Dedicated integrations', 'Private deployment', 'Data residency', 'Support SLA'],
  },
]

export const planMap = Object.fromEntries(plans.map((p) => [p.key, p])) as Record<PlanKey, PlanDef>

export const channels: Array<{ key: ChannelKey; name: string; description: string; icon: string }> = [
  { key: 'website', name: 'Website chatbot', description: 'Embed on your site', icon: 'MessageSquare' },
  { key: 'internal', name: 'Internal assistant', description: 'For your workspace only', icon: 'Users' },
  { key: 'telegram', name: 'Telegram bot', description: 'Talk from any device', icon: 'Send' },
  { key: 'api', name: 'Public API', description: 'Call the agent from your systems', icon: 'Braces' },
  { key: 'whatsapp', name: 'WhatsApp', description: 'Coming when the API allows', icon: 'MessageCircle' },
  { key: 'voice', name: 'Voice', description: 'On the roadmap', icon: 'Mic' },
]

export interface ModelProviderDef {
  key: string
  name: string
  baseUrl: string
  protocol: 'openai' | 'anthropic' | 'google'
  keyHint: string
  keyRequired: boolean
  models: Array<{ key: string; name: string }>
  custom?: boolean
}

// Every provider the builder can route an agent to. Everything except
// Anthropic and Gemini speaks the OpenAI chat-completions shape, which also
// covers OpenAI-compatible gateways and self-hosted servers.
export const modelProviders: ModelProviderDef[] = [
  {
    key: 'lumo',
    name: 'Lumo Core',
    baseUrl: '',
    protocol: 'openai',
    keyHint: 'No key needed',
    keyRequired: false,
    models: [{ key: 'core', name: 'Lumo Core (built in)' }],
  },
  {
    key: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    protocol: 'openai',
    keyHint: 'sk-…',
    keyRequired: true,
    models: [
      { key: 'gpt-4.1', name: 'GPT-4.1' },
      { key: 'gpt-4.1-mini', name: 'GPT-4.1 mini' },
      { key: 'gpt-4o', name: 'GPT-4o' },
      { key: 'gpt-4o-mini', name: 'GPT-4o mini' },
      { key: 'o3-mini', name: 'o3-mini' },
    ],
  },
  {
    key: 'anthropic',
    name: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    protocol: 'anthropic',
    keyHint: 'sk-ant-…',
    keyRequired: true,
    models: [
      { key: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
      { key: 'claude-opus-4-1', name: 'Claude Opus 4.1' },
      { key: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
    ],
  },
  {
    key: 'google',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    protocol: 'google',
    keyHint: 'AIza…',
    keyRequired: true,
    models: [
      { key: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { key: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { key: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    ],
  },
  {
    key: 'mistral',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    protocol: 'openai',
    keyHint: 'API key',
    keyRequired: true,
    models: [
      { key: 'mistral-large-latest', name: 'Mistral Large' },
      { key: 'mistral-small-latest', name: 'Mistral Small' },
      { key: 'codestral-latest', name: 'Codestral' },
    ],
  },
  {
    key: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    protocol: 'openai',
    keyHint: 'gsk_…',
    keyRequired: true,
    models: [
      { key: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
      { key: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B' },
      { key: 'moonshotai/kimi-k2-instruct', name: 'Kimi K2' },
    ],
  },
  {
    key: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    protocol: 'openai',
    keyHint: 'sk-…',
    keyRequired: true,
    models: [
      { key: 'deepseek-chat', name: 'DeepSeek Chat' },
      { key: 'deepseek-reasoner', name: 'DeepSeek Reasoner' },
    ],
  },
  {
    key: 'xai',
    name: 'xAI Grok',
    baseUrl: 'https://api.x.ai/v1',
    protocol: 'openai',
    keyHint: 'xai-…',
    keyRequired: true,
    models: [
      { key: 'grok-4', name: 'Grok 4' },
      { key: 'grok-3', name: 'Grok 3' },
      { key: 'grok-3-mini', name: 'Grok 3 mini' },
    ],
  },
  {
    key: 'cohere',
    name: 'Cohere',
    baseUrl: 'https://api.cohere.ai/compatibility/v1',
    protocol: 'openai',
    keyHint: 'API key',
    keyRequired: true,
    models: [
      { key: 'command-a-03-2025', name: 'Command A' },
      { key: 'command-r-plus-08-2024', name: 'Command R+' },
    ],
  },
  {
    key: 'together',
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    protocol: 'openai',
    keyHint: 'API key',
    keyRequired: true,
    models: [
      { key: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B Turbo' },
      { key: 'Qwen/Qwen2.5-72B-Instruct-Turbo', name: 'Qwen 2.5 72B Turbo' },
    ],
  },
  {
    key: 'fireworks',
    name: 'Fireworks AI',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    protocol: 'openai',
    keyHint: 'API key',
    keyRequired: true,
    models: [
      { key: 'accounts/fireworks/models/llama-v3p3-70b-instruct', name: 'Llama 3.3 70B' },
      { key: 'accounts/fireworks/models/deepseek-v3', name: 'DeepSeek V3' },
    ],
  },
  {
    key: 'cerebras',
    name: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    protocol: 'openai',
    keyHint: 'csk-…',
    keyRequired: true,
    models: [
      { key: 'llama-3.3-70b', name: 'Llama 3.3 70B' },
      { key: 'llama3.1-8b', name: 'Llama 3.1 8B' },
    ],
  },
  {
    key: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    protocol: 'openai',
    keyHint: 'sk-or-…',
    keyRequired: true,
    models: [
      { key: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5' },
      { key: 'openai/gpt-4.1', name: 'GPT-4.1' },
      { key: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    ],
  },
  {
    key: 'perplexity',
    name: 'Perplexity',
    baseUrl: 'https://api.perplexity.ai',
    protocol: 'openai',
    keyHint: 'pplx-…',
    keyRequired: true,
    models: [
      { key: 'sonar-pro', name: 'Sonar Pro' },
      { key: 'sonar', name: 'Sonar' },
    ],
  },
  {
    key: 'zai',
    name: 'Z.ai',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    protocol: 'openai',
    keyHint: 'API key',
    keyRequired: true,
    models: [
      { key: 'glm-4.6', name: 'GLM-4.6' },
      { key: 'glm-4.5', name: 'GLM-4.5' },
    ],
  },
  {
    key: 'azure',
    name: 'Azure OpenAI',
    baseUrl: 'https://YOUR-RESOURCE.openai.azure.com/openai/v1',
    protocol: 'openai',
    keyHint: 'Azure key',
    keyRequired: true,
    models: [
      { key: 'gpt-4.1', name: 'GPT-4.1 deployment' },
      { key: 'gpt-4o-mini', name: 'GPT-4o mini deployment' },
    ],
  },
  {
    key: 'ollama',
    name: 'Ollama / self-hosted',
    baseUrl: 'http://localhost:11434/v1',
    protocol: 'openai',
    keyHint: 'Optional for local servers',
    keyRequired: false,
    models: [
      { key: 'llama3.3', name: 'Llama 3.3' },
      { key: 'qwen2.5', name: 'Qwen 2.5' },
    ],
  },
  {
    key: 'custom',
    name: 'Custom provider',
    baseUrl: '',
    protocol: 'openai',
    keyHint: 'Your provider key',
    keyRequired: true,
    models: [],
    custom: true,
  },
]

export const providerMap = Object.fromEntries(modelProviders.map((p) => [p.key, p])) as Record<string, ModelProviderDef>

export function providerName(key: string | null | undefined): string {
  return providerMap[key ?? 'lumo']?.name ?? key ?? 'Lumo Core'
}

// Legacy shortlist kept for places that only need a model label.
export const models: Array<{ key: string; name: string; provider: string; note: string }> = modelProviders
  .filter((p) => p.key !== 'custom')
  .flatMap((p) => p.models.map((m) => ({ key: m.key, name: m.name, provider: p.name, note: p.key === 'lumo' ? 'Grounded reasoning, no API key needed' : `Runs on ${p.name}` })))

export const composioConnector = {
  key: 'composio',
  name: 'Composio',
  description: 'One connector for 100+ tools. Add your Composio project key once, then connect each tool through it.',
  docs: 'https://docs.composio.dev',
  defaultBaseUrl: 'https://backend.composio.dev',
}

// Composio toolkit slugs for the tools in the library. Used to label which
// external account an agent is allowed to act on.
export const composioToolkits: Record<string, string> = {
  gmail: 'gmail',
  telegram: 'telegram',
  browser: 'browserbase',
  web_search: 'tavily',
  files: 'googledrive',
  database: 'notion',
  calendar: 'googlecalendar',
  forms: 'typeform',
  sheets: 'googlesheets',
  voice: 'elevenlabs',
  notifications: 'slack',
  api: 'http',
}

export interface TemplateDef {
  id: string
  name: string
  category: string
  tagline: string
  description: string
  tools: string[]
  autonomy: Autonomy
  tasks: string[]
  instructions: string
  audience: string
  color: string
}

export const templates: TemplateDef[] = [
  {
    id: 'manufacturing-ops',
    name: 'Manufacturing operations agent',
    category: 'business',
    tagline: 'Suppliers, prices and market changes in one place',
    description:
      'I need an AI agent that researches competitors, checks product prices, communicates with suppliers, receives emails, sends quotations and reports market changes to me every week.',
    tools: ['gmail', 'web_search', 'sheets', 'files', 'notifications'],
    autonomy: 'approval',
    tasks: [
      'Monitor competitor product prices',
      'Draft supplier emails and quotations',
      'Summarise market changes weekly',
      'Keep the supplier and price sheet current',
    ],
    instructions:
      'You support a manufacturing business. Answer from the product catalogue and price list first, cite the document you used, and never invent a price. Prepare quotations for approval before anything leaves the workspace. Flag any price movement above the threshold the owner sets.',
    audience: 'Owner and operations team',
    color: '#ff7a45',
  },
  {
    id: 'sales-outreach',
    name: 'Sales development agent',
    category: 'sales',
    tagline: 'Research accounts and write outreach that gets replies',
    description:
      'Build me a sales assistant that researches target companies, finds decision makers, drafts personalised outreach emails, and keeps a follow-up pipeline in a spreadsheet.',
    tools: ['web_search', 'gmail', 'sheets', 'calendar'],
    autonomy: 'approval',
    tasks: ['Research target accounts', 'Draft personalised first emails', 'Schedule follow-ups', 'Update the pipeline sheet'],
    instructions:
      'Qualify every account before writing. Use only facts present in the research notes or the knowledge base. Keep outreach under 120 words, one clear ask, and no invented mutual connections. Every send needs approval.',
    audience: 'Founders and sales team',
    color: '#ffb547',
  },
  {
    id: 'executive-assistant',
    name: 'Executive assistant',
    category: 'executive',
    tagline: 'A quiet chief of staff for inbox and calendar',
    description:
      'I want an executive assistant who manages my emails, schedules meetings, organises documents and reminds me about important tasks.',
    tools: ['gmail', 'calendar', 'files', 'notifications'],
    autonomy: 'approval',
    tasks: ['Triage the inbox into reply, delegate and ignore', 'Propose meeting slots', 'Prepare a morning briefing', 'Track commitments I make'],
    instructions:
      'Protect the principal’s time. Be brief. Draft replies in their voice, never send without approval, and never double book. In every briefing put the three things that most need a decision first.',
    audience: 'One executive',
    color: '#c084fc',
  },
  {
    id: 'support-helpdesk',
    name: 'Customer support agent',
    category: 'support',
    tagline: 'Answers from your policies, escalates the rest',
    description:
      'Create a customer support agent that answers questions from our policies and product docs, drafts replies to customer emails, and escalates anything it is not sure about.',
    tools: ['gmail', 'telegram', 'files', 'notifications'],
    autonomy: 'auto',
    tasks: ['Answer routine questions from policies', 'Draft replies to customer emails', 'Escalate uncertain cases', 'Summarise the week’s tickets'],
    instructions:
      'Answer only from the knowledge base. If the answer is not there, say so and escalate to a human. Never promise refunds, timelines or discounts that are not written in policy. Cite the policy document in every answer.',
    audience: 'Customers and the support team',
    color: '#38bdf8',
  },
  {
    id: 'competitor-research',
    name: 'Competitor research analyst',
    category: 'research',
    tagline: 'Cited briefs, not confident guesses',
    description:
      'I need a research agent that tracks our competitors, compares their pricing and positioning, and sends me a cited brief every Monday.',
    tools: ['web_search', 'browser', 'files', 'notifications'],
    autonomy: 'auto',
    tasks: ['Collect competitor pages and pricing', 'Compare positioning and features', 'Write a weekly brief with citations', 'Flag changes since the last run'],
    instructions:
      'Cite a source URL for every claim. Separate observed facts from your interpretation. If a page cannot be read, say so instead of guessing. Keep the weekly brief under 400 words with a change log at the top.',
    audience: 'Strategy team',
    color: '#4ade80',
  },
  {
    id: 'recruiter',
    name: 'Recruitment coordinator',
    category: 'people',
    tagline: 'Screens, schedules and keeps candidates warm',
    description:
      'Build an HR assistant that screens applicants against the job description, drafts interview invitations, schedules interviews and keeps candidates updated.',
    tools: ['gmail', 'files', 'calendar', 'notifications'],
    autonomy: 'approval',
    tasks: ['Screen applications against the role', 'Draft interview invitations', 'Propose interview schedules', 'Keep candidates informed'],
    instructions:
      'Assess only against the written job description. Never infer protected characteristics. Summarise each candidate in five lines with evidence. Every rejection or offer needs human approval.',
    audience: 'Hiring manager and candidates',
    color: '#f472b6',
  },
  {
    id: 'bookkeeper',
    name: 'Bookkeeping assistant',
    category: 'finance',
    tagline: 'Clean records and a monthly summary',
    description:
      'I want a bookkeeping assistant that categorises transactions, reconciles receipts, flags unusual expenses and drafts a monthly financial summary.',
    tools: ['sheets', 'files', 'database', 'notifications'],
    autonomy: 'approval',
    tasks: ['Categorise transactions', 'Match receipts to entries', 'Flag unusual spend', 'Draft the monthly summary'],
    instructions:
      'Work only from the ledger and receipts provided. Never alter a transaction without approval. Round to two decimals, show the source row for every figure, and call out anything you could not reconcile.',
    audience: 'Owner and finance team',
    color: '#34d399',
  },
  {
    id: 'course-tutor',
    name: 'Course tutor',
    category: 'education',
    tagline: 'Teaches at the learner’s level',
    description:
      'Create a tutor that teaches our training material, builds lesson plans, explains concepts simply, sets practice work and tracks what each learner struggles with.',
    tools: ['files', 'web_search', 'calendar', 'notifications'],
    autonomy: 'auto',
    tasks: ['Build lesson plans from the material', 'Explain concepts at the learner’s level', 'Set and review practice work', 'Track weak topics'],
    instructions:
      'Teach from the course material first. Use one worked example before any abstract rule. Ask one checking question at the end of every explanation. Never shame a learner; name the next small step.',
    audience: 'Learners and trainers',
    color: '#a78bfa',
  },
  {
    id: 'social-manager',
    name: 'Social media manager',
    category: 'social',
    tagline: 'A week of posts, adapted per channel',
    description:
      'I want an agent that plans our social media posts, writes copy for LinkedIn, Instagram and Telegram, schedules them and reports on engagement.',
    tools: ['web_search', 'sheets', 'notifications', 'browser'],
    autonomy: 'approval',
    tasks: ['Draft a weekly post plan', 'Adapt copy per channel', 'Prepare a posting schedule', 'Summarise engagement weekly'],
    instructions:
      'Match the brand voice in the knowledge base. One idea per post, no hashtag stuffing. Always give a LinkedIn, Instagram and Telegram variant. Never publish without approval in this build.',
    audience: 'Marketing team',
    color: '#fb7185',
  },
]

export const statusTone: Record<ToolRun['status'], { label: string; className: string }> = {
  completed: { label: 'Completed', className: 'bg-emerald-400/10 text-emerald-300' },
  awaiting_approval: { label: 'Awaiting approval', className: 'bg-amber-400/10 text-amber-300' },
  needs_connection: { label: 'Needs connection', className: 'bg-sky-400/10 text-sky-300' },
  unavailable: { label: 'Unavailable', className: 'bg-white/[0.06] text-muted' },
}

export function planForAgentLimit(limit: number): PlanDef {
  return plans.find((p) => p.agentLimit === limit) ?? plans[0]
}
