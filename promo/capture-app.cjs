const {app, BrowserWindow} = require('electron')
const path = require('path')
const fs = require('fs')

const root = path.resolve(__dirname, '..')
const output = path.join(__dirname, 'public', 'captures')
const renderer = path.join(root, 'out', 'renderer', 'index.html')

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function shot(win, name) {
  const image = await win.webContents.capturePage()
  fs.mkdirSync(output, {recursive: true})
  fs.writeFileSync(path.join(output, name), image.toPNG())
}

async function paintedShot(win, name) {
  await wait(180)
  await shot(win, name)
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    frame: false,
    webPreferences: {contextIsolation: true, sandbox: false}
  })

  await win.loadFile(renderer)
  await win.webContents.executeJavaScript(`
    localStorage.setItem('torch_onboarding_complete', 'true');
    localStorage.setItem('torch_user_name', 'Alex');
    location.reload();
  `)
  await wait(2500)
  win.setOpacity(0)
  win.showInactive()
  await wait(250)
  await win.webContents.executeJavaScript(`
    const title = document.querySelector('.cmd-idle__title');
    const subtitle = document.querySelector('.cmd-idle__subtitle');
    const status = document.querySelector('.cmd-input-meta > span');
    if (title) title.textContent = 'Command Center';
    if (subtitle) subtitle.textContent = 'Tell TORCH what to do. Every step runs live in this view.';
    if (status) status.textContent = 'Ready';
  `)
  await paintedShot(win, '09-home-ready.png')

  await win.webContents.executeJavaScript(`
    const textarea = document.querySelector('.cmd-input-textarea');
    if (textarea) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(textarea, 'Find my latest invoice in Downloads');
      textarea.dispatchEvent(new Event('input', {bubbles: true}));
    }
  `)
  await wait(500)
  await win.webContents.executeJavaScript(`
    const status = document.querySelector('.cmd-input-meta > span');
    if (status) status.textContent = 'Ready';
  `)
  await paintedShot(win, '10-typed-ready.png')

  await win.webContents.executeJavaScript(`document.querySelector('.cmd-input-send')?.click()`)
  await wait(180)
  await paintedShot(win, '11-sending.png')
  await wait(900)
  await win.webContents.executeJavaScript(`
    const activity = document.querySelector('.chat-turn__activity-label');
    const status = document.querySelector('.cmd-input-meta > span');
    if (activity) activity.textContent = 'Searching Downloads…';
    if (status) status.textContent = 'Working';
  `)
  await paintedShot(win, '12-processing-live.png')
  await wait(6500)
  const responseReplaced = await win.webContents.executeJavaScript(`
    const response = document.querySelector('.chat-turn__response');
    if (response) {
      response.innerHTML = '<div class="chat-turn__body">I found <strong>invoice_march.pdf</strong> in Downloads. It is your latest invoice, with a total of <strong>$1,240.00</strong> due on August 15.<br><br>Would you like me to open it or draft a payment reminder?</div>';
      true;
    } else {
      false;
    }
  `)
  console.log('Response replaced:', responseReplaced)
  await win.webContents.executeJavaScript(`
    const status = document.querySelector('.cmd-input-meta > span');
    if (status) status.textContent = 'Ready';
  `)
  await paintedShot(win, '13-response-success.png')

  await win.close()
  app.quit()
})
