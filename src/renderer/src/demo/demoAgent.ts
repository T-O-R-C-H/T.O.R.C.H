/**
 * TORCH Demo Agent — Simulates agent execution for showcase mode.
 * No backend connection required. Runs entirely in the browser.
 */

import { useTorchStore, type Step } from '../store/torchStore'
import { formatAgentContent } from '../utils/plainLanguage'
import { streamMessageContent } from '../utils/streamContent'

function uuid(): string {
  return crypto.randomUUID()
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function makeStep(label: string, tool: string, requiresApproval = false): Step {
  return {
    id: uuid(),
    label,
    tool,
    args: {},
    status: 'pending',
    requiresApproval,
  }
}

const SCENARIOS: Record<string, { reply: string; steps: { label: string; tool: string; result?: string; hitl?: boolean }[] }> = {
  file: {
    reply: "On it. I'll search your files and summarize what I find.",
    steps: [
      { label: 'Scanning Documents for recent files', tool: 'find_file', result: 'Found 14 files modified in the last 7 days' },
      { label: 'Reading Sales_Report_Q2.pdf', tool: 'read_pdf', result: 'Sales Report Q2 2026\n\nRevenue: $4.2M (+18% QoQ)\nNew clients: 23\nTop region: North America (62%)\nChurn rate: 2.1% (down from 3.4%)' },
      { label: 'Generating executive summary', tool: 'gemini', result: 'Summary generated and copied to clipboard.' },
    ],
  },
  web: {
    reply: "Got it. Searching the web for the latest headlines.",
    steps: [
      { label: 'Opening browser', tool: 'open_browser', result: 'Browser launched' },
      { label: 'Searching for AI news today', tool: 'search_web', result: 'Retrieved 10 results' },
      { label: 'Reading top articles', tool: 'search_web', result: 'Top AI Headlines\n\n1. Google DeepMind unveils Gemini 3.0 Ultra\n2. OpenAI launches GPT-5 turbo with reasoning chains\n3. EU passes landmark AI Safety Act amendment' },
    ],
  },
  email: {
    reply: "I'll draft that email for you. You'll need to approve before I send.",
    steps: [
      { label: 'Drafting email', tool: 'gemini', result: 'To: team@company.com\nSubject: Weekly Progress Update\n\nHi team,\n\nHere is a quick summary of this week\'s progress:\n• Completed 3 client deliverables\n• Sprint velocity up 12%\n• Next week: focus on Q3 planning\n\nBest,\nTORCH' },
      { label: 'Sending email', tool: 'send_email', hitl: true },
    ],
  },
}

function matchScenario(command: string): string | null {
  const lower = command.toLowerCase()
  if (lower.includes('file') || lower.includes('find') || lower.includes('report') || lower.includes('document') || lower.includes('summarize'))
    return 'file'
  if (lower.includes('search') || lower.includes('web') || lower.includes('news') || lower.includes('browse') || lower.includes('research'))
    return 'web'
  if (lower.includes('email') || lower.includes('mail') || lower.includes('send') || lower.includes('draft'))
    return 'email'
  return null
}

export async function handleDemoCommand(command: string): Promise<void> {
  const store = useTorchStore.getState()
  const scenarioKey = matchScenario(command)

  if (!scenarioKey) {
    store.setAgentStatus('processing')
    await delay(500)
    const messageId = uuid()
    const helpText = formatAgentContent(
      "I'm running in demo mode, so there is no live backend connected.\n\nTry one of these:\n\n• Find and summarize my latest report\n• Search the web for AI news\n• Send an email to my team\n\nAdd your Gemini API key in Settings to unlock the full agent."
    )
    store.addMessage({
      id: messageId,
      role: 'torch',
      content: '',
      timestamp: Date.now(),
      steps: [],
      isStreaming: true,
    })
    await streamMessageContent(messageId, helpText)
    store.setAgentStatus('idle')
    return
  }

  const scenario = SCENARIOS[scenarioKey]
  const messageId = uuid()
  const steps: Step[] = scenario.steps.map((s) => makeStep(s.label, s.tool, s.hitl ?? false))

  store.setAgentStatus('processing')
  await delay(700)

  store.addMessage({
    id: messageId,
    role: 'torch',
    content: '',
    timestamp: Date.now(),
    steps,
    isStreaming: true,
  })

  store.setAgentStatus('executing')
  await streamMessageContent(messageId, formatAgentContent(scenario.reply))

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const stepDef = scenario.steps[i]

    store.updateStep(messageId, step.id, { status: 'active' })
    await delay(1200 + Math.random() * 800)

    if (stepDef.hitl) {
      store.updateStep(messageId, step.id, { status: 'hitl_required' })
      store.setAgentStatus('awaiting_approval')
      return
    }

    store.updateStep(messageId, step.id, {
      status: 'done',
      result: stepDef.result || 'Done',
    })
  }

  store.setAgentStatus('idle')
}

export function handleDemoApproval(messageId: string, stepId: string): void {
  const store = useTorchStore.getState()
  store.updateStep(messageId, stepId, { status: 'done', result: 'Email sent successfully to team@company.com' })
  store.setAgentStatus('idle')
}

export function handleDemoCancel(messageId: string, stepId: string): void {
  const store = useTorchStore.getState()
  store.updateStep(messageId, stepId, { status: 'failed', error: 'Cancelled by user' })
  store.setAgentStatus('idle')
}
