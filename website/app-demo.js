/** Full TORCH app UI — matches Electron renderer layout */

export class TorchMiniApp {
  constructor(container, { compact = false, showMetrics = true, startIdle = false } = {}) {
    this.container = container
    this.compact = compact
    this.showMetrics = showMetrics
    this.startIdle = startIdle
    this.messagesEl = null
    this.statusEl = null
    this.inputEl = null
    this.feedEl = null
    this.typingEl = null
    this.messages = new Map()
    this._build()
  }

  _build() {
    const metricsHtml = this.showMetrics ? `
      <div class="cmd-metrics">
        <div class="cmd-metric"><div class="cmd-metric__label">Tasks</div><div class="cmd-metric__value">12</div></div>
        <div class="cmd-metric"><div class="cmd-metric__label">Time saved</div><div class="cmd-metric__value">3.2h</div></div>
        <div class="cmd-metric"><div class="cmd-metric__label">Actions</div><div class="cmd-metric__value">48</div></div>
        <div class="cmd-metric"><div class="cmd-metric__label">Success</div><div class="cmd-metric__value">94%</div></div>
      </div>` : ''

    const idleHtml = this.startIdle ? `
      <div class="cmd-idle" data-idle>
        <div class="torch-wordmark torch-wordmark--sm">
          <div class="torch-wordmark__frame">
            <span class="torch-wordmark__corner torch-wordmark__corner--tl"></span>
            <span class="torch-wordmark__word">TORCH</span>
            <span class="torch-wordmark__corner torch-wordmark__corner--br"></span>
          </div>
        </div>
        <p class="cmd-idle__title">Command Center</p>
        <p class="cmd-idle__subtitle">Tell TORCH what to do, or pick a suggestion below.</p>
        <div class="cmd-suggestions">
          <div class="cmd-suggestion" data-sug="0"><div><div class="cmd-suggestion__title">Find a file</div><div class="cmd-suggestion__desc">Search folders and open what you need</div></div></div>
          <div class="cmd-suggestion" data-sug="1"><div><div class="cmd-suggestion__title">Draft an email</div><div class="cmd-suggestion__desc">Compose and review before sending</div></div></div>
          <div class="cmd-suggestion" data-sug="2"><div><div class="cmd-suggestion__title">Summarize a document</div><div class="cmd-suggestion__desc">Get key points fast</div></div></div>
          <div class="cmd-suggestion" data-sug="3"><div><div class="cmd-suggestion__title">Open an app</div><div class="cmd-suggestion__desc">Launch and navigate your desktop</div></div></div>
        </div>
      </div>` : ''

    this.container.innerHTML = `
      <div class="torch-app-window ${this.compact ? 'torch-app-window--compact' : ''}">
        <div class="torch-app-window__bar">
          <div class="torch-app-window__dots"><i></i><i></i><i></i></div>
          <div class="torch-app-window__url">TORCH — Desktop Agent</div>
        </div>
        <div class="torch-app-window__body">
          <div class="app-shell">
            <aside class="sidebar">
              <div class="sidebar-header">
                <div class="torch-wordmark torch-wordmark--sm torch-wordmark--sidebar">
                  <div class="torch-wordmark__frame">
                    <span class="torch-wordmark__corner torch-wordmark__corner--tl"></span>
                    <span class="torch-wordmark__word">TORCH</span>
                    <span class="torch-wordmark__corner torch-wordmark__corner--br"></span>
                  </div>
                </div>
              </div>
              <div class="sidebar-body">
                <div class="sidebar-section-label">Menu</div>
                <div class="sidebar-nav-item active">Chat</div>
                <div class="sidebar-nav-item">History</div>
                <div class="sidebar-nav-item">Skills</div>
                <div class="sidebar-section-label">Shortcuts</div>
                <div class="sidebar-nav-item">Check my emails</div>
                <div class="sidebar-nav-item">Find a file</div>
              </div>
              <div class="sidebar-footer">
                <div class="sidebar-user__avatar">A</div>
                <span>Alex</span>
              </div>
            </aside>
            <div class="app-main">
              <div class="topbar">
                <div>
                  <div class="topbar-title">Command Center</div>
                  <div class="topbar-sub">Desktop agent</div>
                </div>
                <div class="topbar-pills">
                  <span class="topbar-pill"><span class="topbar-dot"></span> <span data-status>Ready</span></span>
                  <span class="topbar-pill">Private</span>
                </div>
              </div>
              <div class="cmd-page">
                ${metricsHtml}
                <div class="cmd-main">
                  <div class="cmd-feed" data-feed>
                    ${idleHtml}
                  </div>
                  <div class="cmd-input-bar">
                    <div class="cmd-input-box">
                      <div class="cmd-input-row">
                        <div class="cmd-input-text placeholder" data-input>Tell TORCH what to do…</div>
                        <button type="button" class="cmd-input-send" tabindex="-1">↑</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
    this.messagesEl = this.container.querySelector('[data-feed]')
    this.statusEl = this.container.querySelector('[data-status]')
    this.inputEl = this.container.querySelector('[data-input]')
    this.idleEl = this.container.querySelector('[data-idle]')
    this._idleHtml = this.messagesEl?.innerHTML ?? ''
  }

  clearIdle() {
    if (this.idleEl) {
      this.idleEl.remove()
      this.idleEl = null
    }
  }

  highlightSuggestion(index) {
    this.container.querySelectorAll('.cmd-suggestion').forEach((el, i) => {
      el.classList.toggle('highlight', i === index)
    })
  }

  fullReset() {
    this.messages.clear()
    this.hideApproval()
    this.showTyping(false)
    if (this.messagesEl) {
      this.messagesEl.innerHTML = this._idleHtml || ''
      this.idleEl = this.messagesEl.querySelector('[data-idle]')
    }
    this.container.querySelectorAll('.cmd-suggestion').forEach((el) => el.classList.remove('highlight'))
    this.setInput('Tell TORCH what to do…', true)
    this.setStatus('Ready')
  }

  reset() {
    this.fullReset()
  }

  setStatus(text) {
    if (this.statusEl) this.statusEl.textContent = text
  }

  setInput(text, placeholder = false) {
    if (!this.inputEl) return
    this.inputEl.textContent = text
    this.inputEl.classList.toggle('placeholder', placeholder || text.includes('Tell TORCH'))
  }

  showTyping(show) {
    if (this.typingEl) this.typingEl.remove()
    this.typingEl = null
    if (show) {
      this.typingEl = document.createElement('div')
      this.typingEl.className = 'cmd-typing'
      this.typingEl.innerHTML = '<span class="typing-square"></span><span class="typing-square"></span><span class="typing-square"></span> Thinking…'
      this.messagesEl.appendChild(this.typingEl)
      this.scrollFeed()
    }
  }

  addUserMessage(text) {
    this.clearIdle()
    const el = document.createElement('div')
    el.className = 'chat-user-wrap'
    el.innerHTML = `<div class="chat-user-bubble">${esc(text)}</div>`
    this.messagesEl.appendChild(el)
    this.scrollFeed()
  }

  addAgentMessage(msgId, content, steps) {
    const el = document.createElement('div')
    el.dataset.msgId = msgId
    el.innerHTML = `
      <div class="chat-agent-card">
        <div class="chat-agent-header">
          <div class="chat-agent-avatar">✦</div>
          <span class="chat-agent-name">TORCH</span>
        </div>
        <p class="chat-agent-body">${esc(content)}</p>
        <div class="step-list" data-steps></div>
      </div>
    `
    const stepsEl = el.querySelector('[data-steps]')
    steps.forEach((s) => {
      const row = document.createElement('div')
      row.dataset.stepId = s.id
      row.dataset.step = JSON.stringify(s)
      row.innerHTML = stepHtml(s)
      stepsEl.appendChild(row)
    })
    this.messagesEl.appendChild(el)
    this.messages.set(msgId, el)
    this.scrollFeed()
  }

  updateStep(msgId, stepId, patch) {
    const msgEl = this.messages.get(msgId)
    if (!msgEl) return
    const stepEl = msgEl.querySelector(`[data-step-id="${stepId}"]`)
    if (!stepEl) return
    const data = { ...JSON.parse(stepEl.dataset.step || '{}'), ...patch }
    stepEl.dataset.step = JSON.stringify(data)
    stepEl.innerHTML = stepHtml(data)
    this.scrollFeed()
  }

  showApproval(msgId, summary) {
    this.hideApproval()
    const msgEl = this.messages.get(msgId)
    if (!msgEl) return
    const card = msgEl.querySelector('.chat-agent-card')
    const approval = document.createElement('div')
    approval.className = 'approval-card'
    approval.dataset.approval = '1'
    approval.innerHTML = `
      <div class="approval-card__head">⚠ Awaiting your approval</div>
      <div class="approval-card__body">${esc(summary)}</div>
      <div class="approval-card__actions">
        <button type="button" class="btn-approve">Approve</button>
        <button type="button">Edit</button>
        <button type="button">Cancel</button>
      </div>
    `
    card.appendChild(approval)
    this.scrollFeed()
  }

  hideApproval() {
    this.container.querySelectorAll('[data-approval]').forEach((el) => el.remove())
  }

  scrollFeed() {
    if (this.messagesEl) this.messagesEl.scrollTop = this.messagesEl.scrollHeight
  }
}

function stepHtml(step) {
  const cls = step.status === 'active' || step.status === 'hitl_required' ? 'step-row step-row--active'
    : step.status === 'done' ? 'step-row step-row--done' : 'step-row'
  const icon = step.status === 'active' || step.status === 'hitl_required' ? '◌'
    : step.status === 'done' ? '✓' : '○'
  let html = `<div class="${cls}"><span class="step-row__icon">${icon}</span><span>${esc(step.label)}</span></div>`
  if (step.result && (step.status === 'done' || step.status === 'active')) {
    html += `<div class="step-preview">↳ ${esc(String(step.result).slice(0, 90))}</div>`
  }
  return html
}

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
