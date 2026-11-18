const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {pathToFileURL} = require('node:url');
const {setTimeout: delay} = require('node:timers/promises');

const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(root, '.ch-'));
const shots = path.join(root, '.capturas');
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless', '--no-sandbox', '--disable-gpu', '--disable-background-networking',
  '--disable-extensions', '--disable-component-update', '--no-first-run',
  '--allow-file-access-from-files', '--remote-debugging-port=0',
  '--window-size=1920,1080', '--force-device-scale-factor=1',
  '--user-data-dir=' + profile, 'about:blank'
], {windowsHide:true, stdio:'ignore'});
const closed = new Promise(resolve => chrome.once('exit', resolve));
const devtools = path.join(profile, 'DevToolsActivePort');
const pending = new Map();
const errors = [];
let socket;
let serial = 0;

function send(method, params = {}) {
  const id = ++serial;
  return new Promise((resolve, reject) => {
    pending.set(id, reply => reply.error ? reject(Error(reply.error.message)) : resolve(reply.result));
    socket.send(JSON.stringify({id, method, params}));
  });
}
async function evaluate(expression) {
  const response = await send('Runtime.evaluate', {expression, returnByValue:true});
  if (response.exceptionDetails) throw Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
  return response.result.value;
}
async function waitFor(predicate) {
  for (let i = 0; i < 100; i++) {
    const value = await predicate();
    if (value) return value;
    await delay(100);
  }
  throw Error('Tiempo agotado esperando Chrome: ' + predicate);
}
async function main() {
  fs.mkdirSync(shots, {recursive:true});
  await waitFor(() => fs.existsSync(devtools));
  const port = Number(fs.readFileSync(devtools, 'utf8').split('\n')[0]);
  const [tab] = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, {once:true});
    socket.addEventListener('error', reject, {once:true});
  });
  socket.addEventListener('message', ({data}) => {
    const message = JSON.parse(data);
    if (message.id) {
      pending.get(message.id)?.(message);
      pending.delete(message.id);
    }
    if (message.method === 'Runtime.exceptionThrown' || message.method === 'Runtime.consoleAPICalled' &&
      message.params.type === 'error' || message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      errors.push(message.params);
    }
  });
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Network.enable');
  await send('Network.setBlockedURLs', {urls:['http://*', 'https://*']});
  await send('Emulation.setDeviceMetricsOverride', {width:1920, height:1080, deviceScaleFactor:1, mobile:false});
  await send('Page.navigate', {url:pathToFileURL(path.join(root, 'presentacion/index.html')).href});
  await waitFor(() => evaluate('Boolean(document.querySelector(".slide.active"))'));
  const ids = ['bayeh','cano','duque','cortes','fajardo','navarro'];
  for (const id of ids) {
    const group = 'A2';
    const frame = '#visor-' + group + '_' + id;
    const setup = await evaluate(`(() => {
      const frame = document.querySelector('${frame}');
      const slide = frame.closest('.slide');
      const position = [...document.querySelectorAll('.slide')].indexOf(slide);
      document.querySelectorAll('#progress button')[position].click();
      return [...slide.querySelectorAll('[role=tab]')].map(tab => tab.getAttribute('aria-selected'));
    })()`);
    assert.deepEqual(setup, ['true', 'false', 'false']);
    let previousLayout;
    let previousContext;
    for (let i = 0; i < setup.length; i++) {
      await evaluate(`document.querySelector('.slide.active .sim-tabs')?.children[${i}].click()`);
      const canvas = i === 2 ? '' : '&& doc.querySelector("#cvEq")?.width > 300';
      await waitFor(() => evaluate(`(() => {
        const frame = document.querySelector('${frame}');
        const doc = frame.contentDocument;
        return Boolean(doc && doc.URL.split('#')[0] === frame.src && doc.readyState === 'complete' ${canvas});
      })()`));
      await delay(350);
      const info = await evaluate(`(() => {
        const frame = document.querySelector('${frame}');
        const doc = frame.contentDocument;
        const win = frame.contentWindow;
        const slide = frame.closest('.slide');
        const tab = slide.querySelector('[aria-selected=true]');
        const matrix = slide.querySelector('[data-sim-matrix]:not([hidden])');
        const eq = doc.querySelector('#v-equipo .equipo');
        return {
          width:innerWidth, height:innerHeight,
          overflow:Math.max(document.documentElement.scrollWidth - innerWidth,
            doc.documentElement.scrollWidth - win.innerWidth, doc.body.scrollWidth - win.innerWidth),
          layout:eq && [frame.clientWidth, frame.clientHeight,
            win.getComputedStyle(eq).gridTemplateColumns, doc.querySelector('#cvEq').clientWidth,
            doc.querySelector('#cvEq').clientHeight, doc.querySelector('#equipmentScenario').options.length],
          title:tab?.textContent, matrix:matrix?.innerHTML,
          matrixTitle:matrix?.querySelector('h4')?.textContent,
          guide:document.querySelector('#guide-notes').textContent,
          url:doc.URL, transparent:getComputedStyle(tab).backgroundColor === 'rgba(0, 0, 0, 0)'
        };
      })()`);
      assert.equal(info.width, 1920);
      assert.equal(info.height, 1080);
      if (i < 2) {
        assert.ok(info.overflow <= 1, id + ' desborde: ' + info.overflow);
        assert.equal(info.matrixTitle, info.title);
        assert.ok(info.guide.startsWith(info.title));
        if (previousLayout) assert.deepEqual(info.layout, previousLayout, id);
        previousLayout = info.layout;
        previousContext = [info.matrix, info.guide];
        assert.ok(info.url.endsWith(`/A2_${id}_${i + 1}.html?embed=1`));
      } else {
        assert.equal(info.title, 'Simulador original');
        assert.ok(info.transparent);
        assert.match(info.url.split('#')[0], new RegExp('/sim/originales/A2/[0-9]_' + id + '_[^/]+[.]html[?]embed=1$'));
        assert.deepEqual([info.matrix, info.guide], previousContext);
        if (id === 'navarro') {
          const {data} = await send('Page.captureScreenshot', {format:'png'});
          fs.writeFileSync(path.join(shots, 'orig-tab-navarro.png'), Buffer.from(data, 'base64'));
        }
      }
      console.log(group, id, i + 1, info.layout ?? 'módulo original');
    }
  }
  assert.deepEqual(errors, []);
}

main().catch(error => {
  console.error(error, JSON.stringify(errors).slice(0, 3500));
  process.exitCode = 1;
}).finally(async () => {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({id:++serial, method:'Browser.close'}));
    socket.close();
  } else chrome.kill();
  await Promise.race([closed, delay(3500)]);
  if (chrome.exitCode === null) chrome.kill();
  await delay(500);
  fs.rmSync(profile, {recursive:true, force:true, maxRetries:5, retryDelay:200});
});
