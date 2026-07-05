/** Demo scenarios — each section uses a unique scenario key */

export const SCENARIOS = {
  /** Hero full-page showcase */
  hero: {
    userCommand: 'Find and summarize my latest report',
    reply: "On it. I'll search your files and put together a short summary.",
    steps: [
      { label: 'Looking for your file...', tool: 'find_file', result: 'Found Sales_Report_Q2.pdf in Documents' },
      { label: 'Reading your document...', tool: 'read_pdf', result: '38 pages · revenue up 18% quarter over quarter' },
      { label: 'Writing your summary', tool: 'gemini', result: 'Summary ready in Command Center' }
    ]
  },
  /** Feature: pick a suggestion card */
  suggestions: {
    userCommand: 'Find my latest report in Documents',
    reply: "I'll search your folders and open what you need.",
    pickSuggestion: 0,
    steps: [
      { label: 'Looking for your file...', tool: 'find_file', result: 'Found 3 matching files' },
      { label: 'Opening the most recent report', tool: 'read_pdf', result: 'Sales_Report_Q2.pdf opened' }
    ]
  },
  files: {
    userCommand: 'Pull the key numbers from my Q2 sales report',
    reply: 'Searching your Documents folder now.',
    steps: [
      { label: 'Looking for your file...', tool: 'find_file', result: 'Found: Documents/Reports/Sales_Report_Q2.pdf' },
      { label: 'Reading your spreadsheet...', tool: 'read_pdf', result: 'Revenue $4.2M · 23 new clients · churn 2.1%' },
      { label: 'Highlighting the numbers you asked for', tool: 'gemini', result: 'Key metrics copied to your reply' }
    ]
  },
  web: {
    userCommand: 'What are the top AI headlines today?',
    reply: 'Searching the web and reading the latest articles for you.',
    steps: [
      { label: 'Opening your browser...', tool: 'open_browser', result: 'Browser ready' },
      { label: 'Searching for today\'s AI news', tool: 'search_web', result: '10 results found' },
      { label: 'Summarizing the top stories', tool: 'search_web', result: '3 headlines with short summaries' }
    ]
  },
  email: {
    userCommand: 'Send a weekly update to my team',
    reply: "I've drafted the email. Review it below — nothing sends until you approve.",
    steps: [
      { label: 'Drafting your email', tool: 'gemini', result: 'To: team@company.com · Subject: Weekly update' },
      { label: 'Ready to send your email', tool: 'send_email', hitl: true }
    ]
  },
  voice: {
    userCommand: 'Hey TORCH, open my project folder',
    reply: 'Opening your apps and getting you to the right place.',
    steps: [
      { label: 'Listening...', tool: 'voice', result: 'Command understood' },
      { label: 'Opening VS Code', tool: 'open_app', result: 'VS Code launched' },
      { label: 'Opening your project folder', tool: 'open_app', result: 'Folder ready' }
    ]
  }
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function uid() {
  return crypto.randomUUID?.() ?? String(Math.random()).slice(2)
}

export class DemoRunner {
  constructor(app) {
    this.app = app
    this.running = false
    this.abort = false
  }

  stop() {
    this.abort = true
    this.running = false
  }

  async run(scenarioKey, { autoApproveHitl = true, loop = false, pauseOnApproval = false } = {}) {
    if (this.running) this.stop()
    await delay(50)
    this.abort = false
    this.running = true

    do {
      const scenario = SCENARIOS[scenarioKey]
      if (!scenario) { this.running = false; return }

      this.app.fullReset()
      await delay(500)
      if (this.abort) break

      if (scenario.pickSuggestion !== undefined) {
        this.app.highlightSuggestion(scenario.pickSuggestion)
        await delay(700)
        if (this.abort) break
      }

      this.app.setStatus('Ready')
      this.app.setInput(scenario.userCommand)
      await delay(500)

      this.app.addUserMessage(scenario.userCommand)
      this.app.setInput('', true)
      this.app.setStatus('Thinking')
      this.app.showTyping(true)
      await delay(800)
      if (this.abort) break

      this.app.showTyping(false)
      const msgId = uid()
      const steps = scenario.steps.map((s) => ({
        id: uid(),
        label: s.label,
        status: 'pending',
        result: s.result,
        hitl: s.hitl
      }))

      this.app.addAgentMessage(msgId, scenario.reply, steps)
      this.app.setStatus('Working')

      for (let i = 0; i < steps.length; i++) {
        if (this.abort) break
        const step = steps[i]
        this.app.updateStep(msgId, step.id, { status: 'active' })
        await delay(900 + Math.random() * 500)
        if (this.abort) break

        if (step.hitl) {
          this.app.updateStep(msgId, step.id, { status: 'hitl_required' })
          this.app.setStatus('Awaiting approval')
          this.app.showApproval(msgId, 'Send weekly update to team@company.com?')
          if (pauseOnApproval && !autoApproveHitl) {
            this.running = false
            return
          }
          await delay(pauseOnApproval ? 2800 : 1600)
          if (this.abort) break
          this.app.hideApproval()
          this.app.updateStep(msgId, step.id, { status: 'done', result: 'Email sent to your team' })
        } else {
          this.app.updateStep(msgId, step.id, { status: 'done', result: step.result })
        }
      }

      this.app.setStatus('Ready')
      await delay(loop ? 3000 : 600)
    } while (loop && !this.abort)

    this.running = false
  }
}
