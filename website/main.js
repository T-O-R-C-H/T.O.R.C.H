/* ═══════════════════════════════════════════════════════════════
   TORCH LANDING PAGE — Interactive Engine
   Handles: Simulator, Architecture Tabs, FAQ Accordion, Scroll FX
   ═══════════════════════════════════════════════════════════════ */

// ─── CONSTANTS ───

const SCENARIOS = {
  file: {
    command: 'find and summarize my latest Sales report',
    userMsg: 'Find and summarize my latest Sales report',
    thinkMsg: "On it. I'll search your filesystem and summarize what I find.",
    steps: [
      { label: 'Scanning ~/Documents for recent files', tool: 'find_file', delay: 1200 },
      { label: 'Reading Sales_Report_Q2.pdf (38 pages)', tool: 'read_pdf', delay: 1400 },
      { label: 'Generating executive summary with Gemini', tool: 'gemini', delay: 1000 },
    ],
    result: `<div class="chat-markdown">
      <p><strong>Sales Report Q2 2026 — Executive Summary</strong></p>
      <ul>
        <li>Revenue: <code>$4.2M</code> (+18% QoQ)</li>
        <li>New clients acquired: <strong>23</strong></li>
        <li>Top performing region: North America (62%)</li>
        <li>Churn rate: 2.1% (down from 3.4%)</li>
      </ul>
      <p>Summary generated and copied to clipboard.</p>
    </div>`,
    hitl: false,
  },
  web: {
    command: 'search the web for latest AI news headlines',
    userMsg: 'Search the web for the latest AI news headlines',
    thinkMsg: "Got it. Launching Playwright and scraping top results.",
    steps: [
      { label: 'Opening sandboxed Chromium via Playwright', tool: 'open_browser', delay: 1100 },
      { label: 'Searching Google for "AI news today"', tool: 'search_web', delay: 1300 },
      { label: 'Scraping and synthesizing top 3 articles', tool: 'scrape_web', delay: 1500 },
    ],
    result: `<div class="chat-markdown">
      <p><strong>Top AI Headlines — May 2026</strong></p>
      <ul>
        <li><strong>Google DeepMind unveils Gemini 3.0 Ultra</strong> — TechCrunch</li>
        <li><strong>OpenAI launches GPT-5 turbo with reasoning chains</strong> — The Verge</li>
        <li><strong>EU passes landmark AI Safety Act amendment</strong> — Reuters</li>
      </ul>
    </div>`,
    hitl: false,
  },
  email: {
    command: 'draft and send a weekly progress email to team',
    userMsg: 'Draft and send a weekly progress email to my team',
    thinkMsg: "I'll draft that email for you. You'll need to approve before I send.",
    steps: [
      { label: 'Drafting email content with Gemini', tool: 'gemini', delay: 1400 },
      { label: 'Sending email via Gmail SMTP', tool: 'send_email', delay: 0, hitl: true },
    ],
    draftResult: `<div class="chat-markdown">
      <p><strong>To:</strong> team@company.com</p>
      <p><strong>Subject:</strong> Weekly Progress Update</p>
      <pre><code>Hi team,

Here's a quick summary of this week's progress:
• Completed 3 client deliverables
• Sprint velocity up 12%
• Next week: focus on Q3 planning

Best,
TORCH</code></pre>
    </div>`,
    hitlCard: `<div class="sim-hitl-card">
      <div class="hitl-header">HUMAN-IN-THE-LOOP — APPROVAL REQUIRED</div>
      <div class="hitl-body">TORCH wants to send this email via Gmail SMTP to <strong>team@company.com</strong>. Do you authorize this action?</div>
      <div class="hitl-actions">
        <button class="btn-hitl-approve" onclick="resolveHITL(true)">APPROVE & SEND</button>
        <button class="btn-hitl-cancel" onclick="resolveHITL(false)">CANCEL</button>
      </div>
    </div>`,
    approvedResult: `<div class="chat-markdown"><p>✅ Email sent successfully to <strong>team@company.com</strong></p></div>`,
    cancelledResult: `<div class="chat-markdown"><p>❌ Email send cancelled by user.</p></div>`,
    hitl: true,
  },
};

// ─── STATE ───

let isSimRunning = false;
let currentScenario = 'file';
let hitlResolver = null;

// ─── DOM REFERENCES ───

const chatLog = document.getElementById('sim-chat-log');
const stepList = document.getElementById('sim-step-list');
const statusOrb = document.getElementById('sim-status-orb');
const statusText = document.getElementById('sim-status-text');
const inputBox = document.getElementById('sim-input-box');
const btnRun = document.getElementById('btn-run-sim');

const presetBtns = {
  file: document.getElementById('btn-sim-file'),
  web: document.getElementById('btn-sim-web'),
  email: document.getElementById('btn-sim-email'),
};

// ─── SIMULATOR HELPERS ───

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function setStatus(state, label) {
  statusOrb.className = 'status-indicator-orb ' + state;
  statusText.textContent = label;
}

function addBubble(role, html) {
  const div = document.createElement('div');
  div.className = `bubble ${role}`;
  div.innerHTML = html;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
  return div;
}

function addTypingBubble() {
  const div = document.createElement('div');
  div.className = 'bubble torch typing';
  div.id = 'sim-typing';
  div.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
  return div;
}

function removeTyping() {
  const el = document.getElementById('sim-typing');
  if (el) el.remove();
}

function renderSteps(steps) {
  stepList.innerHTML = '';
  steps.forEach((step, i) => {
    const div = document.createElement('div');
    div.className = 'sim-step';
    div.id = `sim-step-${i}`;
    div.innerHTML = `
      <div class="step-indicator">—</div>
      <div class="step-label">${step.label}</div>
    `;
    stepList.appendChild(div);
  });
}

function setStepState(index, state) {
  const el = document.getElementById(`sim-step-${index}`);
  if (!el) return;
  el.className = `sim-step ${state}`;
  const indicator = el.querySelector('.step-indicator');
  if (state === 'active') indicator.textContent = '●';
  if (state === 'done') indicator.textContent = '✓';
}

function clearSimulator() {
  chatLog.innerHTML = '';
  stepList.innerHTML = '';
  setStatus('idle', 'IDLE');
}

// ─── SIMULATOR MAIN RUN ───

async function runSimulator(key) {
  if (isSimRunning) return;
  isSimRunning = true;
  btnRun.disabled = true;
  btnRun.textContent = 'Running...';

  const scenario = SCENARIOS[key];
  clearSimulator();

  // Update input box
  inputBox.value = scenario.command;

  // 1) User bubble
  addBubble('user', scenario.userMsg);
  setStatus('thinking', 'PROCESSING');
  renderSteps(scenario.steps);

  // 2) Thinking dots
  await delay(700);
  addTypingBubble();
  await delay(1200);
  removeTyping();

  // 3) TORCH initial response
  addBubble('torch', scenario.thinkMsg);
  setStatus('active', 'EXECUTING');

  // 4) Animate through steps
  for (let i = 0; i < scenario.steps.length; i++) {
    const step = scenario.steps[i];
    setStepState(i, 'active');

    if (step.hitl && scenario.hitl) {
      // Show draft result first
      if (scenario.draftResult) {
        await delay(800);
        addBubble('torch', scenario.draftResult);
      }

      setStatus('thinking', 'AWAITING APPROVAL');

      // Show HITL card and wait for user action
      const hitlBubble = addBubble('torch', scenario.hitlCard);

      const approved = await new Promise((resolve) => {
        hitlResolver = resolve;
      });

      hitlBubble.remove();
      setStepState(i, 'done');

      if (approved) {
        setStatus('active', 'EXECUTING');
        await delay(600);
        addBubble('torch', scenario.approvedResult);
      } else {
        setStatus('idle', 'CANCELLED');
        addBubble('torch', scenario.cancelledResult);
      }
    } else {
      await delay(step.delay);
      setStepState(i, 'done');
    }
  }

  // 5) Final result (for non-HITL scenarios)
  if (!scenario.hitl) {
    await delay(400);
    addBubble('torch', scenario.result);
  }

  setStatus('idle', 'IDLE');
  isSimRunning = false;
  btnRun.disabled = false;
  btnRun.textContent = 'Execute';
}

// Global HITL resolver
function resolveHITL(approved) {
  if (hitlResolver) {
    hitlResolver(approved);
    hitlResolver = null;
  }
}

// ─── PRESET BUTTON BINDINGS ───

Object.keys(presetBtns).forEach((key) => {
  const btn = presetBtns[key];
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (isSimRunning) return;
    // Toggle active state on sidebar buttons
    Object.values(presetBtns).forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentScenario = key;
    inputBox.value = SCENARIOS[key].command;
  });
});

// Execute button
if (btnRun) {
  btnRun.addEventListener('click', () => {
    runSimulator(currentScenario);
  });
}

// ─── ARCHITECTURE TABS ───

const tabBtns = document.querySelectorAll('.arch-tab-btn');
const tabPanels = document.querySelectorAll('.arch-tab-panel');

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabBtns.forEach((b) => b.classList.remove('active'));
    tabPanels.forEach((p) => p.classList.remove('active'));

    btn.classList.add('active');

    const targetId = btn.id.replace('tab-btn-', 'panel-');
    const panel = document.getElementById(targetId);
    if (panel) panel.classList.add('active');
  });
});

// ─── FAQ ACCORDION ───

const faqItems = document.querySelectorAll('.faq-item');

faqItems.forEach((item) => {
  const trigger = item.querySelector('.faq-trigger');
  trigger.addEventListener('click', () => {
    const isOpen = item.classList.contains('active');
    // Close all other items first
    faqItems.forEach((it) => it.classList.remove('active'));
    // Toggle current item
    if (!isOpen) item.classList.add('active');
  });
});

// ─── SCROLL REVEAL ANIMATIONS ───

const observerOptions = {
  root: null,
  rootMargin: '0px',
  threshold: 0.1,
};

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
      revealObserver.unobserve(entry.target);
    }
  });
}, observerOptions);

// Observe sections
document.querySelectorAll('.feature-card, .section-header, .sim-container, .arch-tabs-container, .specs-table-wrapper, .download-card, .faq-item').forEach((el) => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(30px)';
  el.style.transition = 'opacity 0.7s cubic-bezier(0.4,0,0.2,1), transform 0.7s cubic-bezier(0.4,0,0.2,1)';
  revealObserver.observe(el);
});

// Stagger feature cards
document.querySelectorAll('.feature-card').forEach((card, i) => {
  card.style.transitionDelay = `${i * 80}ms`;
});

// ─── HEADER BACKGROUND ON SCROLL ───

const header = document.getElementById('nav-header');

window.addEventListener('scroll', () => {
  if (window.scrollY > 60) {
    header.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    header.style.borderBottomColor = 'rgba(28, 28, 28, 0.9)';
  } else {
    header.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
    header.style.borderBottomColor = 'rgba(255, 255, 255, 0.05)';
  }
});

// ─── SMOOTH SCROLL FOR NAV LINKS ───

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', function (e) {
    const href = this.getAttribute('href');
    if (href === '#') return;
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ─── INITIAL STATE ───

// Start with the file scenario selected
inputBox.value = SCENARIOS.file.command;
