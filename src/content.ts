// Marketing copy. Every string here is about the product we actually built —
// no invented customer counts, logos or testimonials.

export const brand = {
  name: 'Lumo',
  tagline: 'One agent engine. Every agent you need.',
}

export const nav = {
  links: [
    { label: 'Platform', href: '#platform' },
    { label: 'How it works', href: '#how' },
    { label: 'Agents', href: '#agents' },
    { label: 'Pricing', href: '#pricing' },
  ],
  signIn: { label: 'Sign in', href: '/login' },
  cta: { label: 'Open the studio', href: '/signup' },
}

export const hero = {
  badge: 'Agent builder · Phase 1 is live',
  title: ['Describe the work.', 'Deploy an'],
  highlight: 'agent.',
  description:
    'Lumo turns a plain-language description into a configured AI agent: its own instructions, tools, knowledge, memory and approval rules. One engine runs them all, in your private workspace.',
  primary: { label: 'Build your first agent', href: '/signup' },
  secondary: { label: 'Try the demo workspace', href: '/login' },
  footnote: 'Free plan includes one agent. The demo needs no setup.',
}

export const features = {
  eyebrow: 'One engine, not a catalogue of bots',
  title: 'Agents are configuration, not separate apps',
  description:
    'Every agent gets the same runtime. What changes is what you tell it, what it can reach and what it is allowed to do.',
  items: [
    {
      key: 'engine',
      title: 'A single agent engine',
      description: 'Instructions, model, memory, knowledge and tools are read per turn. Add a thousand agents without a thousand codebases.',
      span: 2,
    },
    {
      key: 'knowledge',
      title: 'Grounded in your documents',
      description: 'Upload catalogues, policies, price lists or course material. Answers cite the passage they came from.',
      span: 1,
    },
    {
      key: 'tools',
      title: 'Tools with guardrails',
      description: 'Email, search, sheets, calendar and browser. External actions wait for approval when you say so.',
      span: 1,
    },
    {
      key: 'isolation',
      title: 'Private by construction',
      description: 'Each customer gets its own workspace. Every query is scoped, so no agent can reach another tenant.',
      span: 2,
    },
  ],
}

export const steps = {
  eyebrow: 'How it works',
  title: 'From a sentence to a working agent',
  items: [
    { title: 'Create a workspace', description: 'Sign up as an individual, business or enterprise. Your agents, documents and conversations stay inside it.' },
    { title: 'Pick a category', description: 'Business, sales, marketing, executive, support, research, people, finance, education, social, personal — or custom.' },
    { title: 'Describe the job', description: 'Say what you need in ordinary language. The builder extracts the role, tasks, tools, audience and approval rules.' },
    { title: 'Correct the configuration', description: 'Every inferred field is editable. Add tools, edit tasks and choose whether work runs automatically or waits for you.' },
    { title: 'Teach it your business', description: 'Upload the documents that define the truth. The agent retrieves the right passages and cites them.' },
    { title: 'Test, then deploy', description: 'Chat with it first. Deploy to a website widget, Telegram, an internal assistant or the API when it behaves.' },
  ],
}

export const useCases = {
  eyebrow: 'Built for real work',
  title: 'One platform, very different agents',
  items: [
    {
      title: 'Manufacturing',
      subtitle: 'Supplier and market desk',
      prompt:
        'I need an agent that researches competitors, checks product prices, emails suppliers, drafts quotations and reports market changes.',
      outputs: ['Researches competitors', 'Drafts quotations', 'Watches supplier lead times'],
      tone: 'approval' as const,
      hue: 24,
    },
    {
      title: 'Marketing agency',
      subtitle: 'Campaign and social desk',
      prompt:
        'Build an agent that plans campaigns, writes LinkedIn and Instagram posts, prepares a posting schedule and reports engagement weekly.',
      outputs: ['Plans campaigns', 'Adapts copy per channel', 'Summarises engagement'],
      tone: 'approval' as const,
      hue: 340,
    },
    {
      title: 'Founder',
      subtitle: 'Executive assistant',
      prompt:
        'I want an executive assistant who manages my inbox, schedules meetings, organises documents and reminds me about important tasks.',
      outputs: ['Triages the inbox', 'Proposes meeting slots', 'Preps a morning briefing'],
      tone: 'approval' as const,
      hue: 275,
    },
  ],
}

export const metrics = [
  { value: 1, label: 'agent engine for every agent' },
  { value: 12, label: 'agent categories, plus custom' },
  { value: 13, label: 'tools in the library' },
  { value: 6, label: 'deployment channels' },
]

export const pricing = {
  eyebrow: 'Pricing',
  title: 'Start free. Pay for agents, not seats.',
  description: 'Prices in Ethiopian Birr. Proposed starting prices, not validated market rates — expect them to move.',
  yearlyNote: 'Two months free',
}

export const faq = {
  title: 'Questions, answered',
  items: [
    {
      q: 'Is this a chatbot builder or something else?',
      a: 'It builds agents that do work. Each one has a role, a task list, tools, private knowledge, long-term memory and an approval policy. Chat is how you direct it, not the product.',
    },
    {
      q: 'How does the builder turn my description into an agent?',
      a: 'It reads the sentence for a role, category, tasks, tools, audience and autonomy, then writes the instruction set. The wizard shows every inference, and you can change any field before saving.',
    },
    {
      q: 'Do I need an OpenAI key?',
      a: 'No. Each agent runs on the built-in Lumo Core engine with your documents as context. You can point an agent at OpenAI or Z.ai later from Settings when a key is configured.',
    },
    {
      q: 'Can one customer see another customer’s agents?',
      a: 'No. Every account gets its own workspace, and every API query is scoped to the signed-in workspace. Knowledge, memory, conversations and tasks are separate rows with workspace ownership.',
    },
    {
      q: 'What happens before an email is sent?',
      a: 'Agents in approval mode prepare the draft and create a task. Nothing leaves the workspace until you approve it. Automatic agents still log every action to the activity feed.',
    },
    {
      q: 'What can agents read?',
      a: 'PDF, Word, Excel, CSV, Markdown and plain text. The upload pipeline extracts text, chunks it and indexes it for retrieval, so answers can cite the source document.',
    },
  ],
}

export const cta = {
  title: 'Build the agent you actually need',
  description: 'Describe it, correct the configuration, give it your documents and test it against real work.',
  primary: { label: 'Start free', href: '/signup' },
  secondary: { label: 'Explore the demo', href: '/login' },
  footnote: 'No card required · Free plan includes one agent',
}

export const footer = {
  blurb: 'A universal AI agent builder. Describe the work, configure the agent, deploy it with guardrails.',
  columns: [
    { title: 'Product', links: [
      { label: 'Platform', href: '/#platform' },
      { label: 'Agent categories', href: '/#agents' },
      { label: 'Templates', href: '/app/templates' },
      { label: 'Pricing', href: '/#pricing' },
    ] },
    { title: 'Studio', links: [
      { label: 'My agents', href: '/app/agents' },
      { label: 'Knowledge base', href: '/app/knowledge' },
      { label: 'Integrations', href: '/app/integrations' },
      { label: 'Automations', href: '/app/automations' },
    ] },
    { title: 'Company', links: [
      { label: 'About', href: '/#how' },
      { label: 'Contact', href: 'mailto:hello@lumo.et' },
      { label: 'Careers', href: '/#how' },
    ] },
    { title: 'Account', links: [
      { label: 'Sign in', href: '/login' },
      { label: 'Create account', href: '/signup' },
      { label: 'Settings', href: '/app/settings' },
    ] },
  ],
  legal: `© ${new Date().getFullYear()} Lumo. Built for Ethiopian and global teams.`,
}
