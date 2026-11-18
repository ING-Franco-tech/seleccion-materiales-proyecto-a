const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {pathToFileURL} = require('node:url');
const {setTimeout: delay} = require('node:timers/promises');

const root = path.resolve(__dirname, '..');
const profile = fs.mkdtempSync(path.join(root, '.ch-'));
const shots = path.join(root, '../.capturas');
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
function observeCanvasText() {
  const proto = CanvasRenderingContext2D.prototype;
  const clear = proto.clearRect, text = proto.fillText;
  proto.clearRect = function (...args) {
    if (args[0] === 0 && args[1] === 0) this.canvas.layoutText = [];
    return clear.apply(this,args);
  };
  proto.fillText = function (label,x,y,...args) {
    const labels = this.canvas.layoutText;
    if (label && labels && ['cvEq','cvVida'].includes(this.canvas.id)) {
      const t = this.getTransform(), m = this.measureText(label);
      const corners = [[x-m.actualBoundingBoxLeft,y-m.actualBoundingBoxAscent],
        [x+m.actualBoundingBoxRight,y+m.actualBoundingBoxDescent]].flatMap(([a,b],i,all) =>
        [[a,b],[a,all[1-i][1]]]).map(([a,b])=>t.transformPoint({x:a,y:b}));
      labels.push({label,left:Math.min(...corners.map(p=>p.x)),right:Math.max(...corners.map(p=>p.x)),
        top:Math.min(...corners.map(p=>p.y)),bottom:Math.max(...corners.map(p=>p.y))});
    }
    return text.call(this,label,x,y,...args);
  };
}

async function main() {
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
    if (message.method === 'Runtime.exceptionThrown' ||
        message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error' ||
        message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      errors.push(message.params);
    }
  });
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument',{source:'('+observeCanvasText.toString()+')()'});
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  const results = JSON.parse(fs.readFileSync(path.join(root,'resultados.json'),'utf8'));
  const expected = Object.fromEntries(Object.keys(results.escenarios).map(key => [key,
    Object.assign({}, ...Object.values(results.grupos).flatMap(g=>Object.values(g.estudiantes).map(s=>s.escenarios[key])))]));
  const url = pathToFileURL(path.join(root,'presentacion/index.html')).href;
  const issues = [];
  const captureFailures = [];
  let compared = 0;
  let views = 0;
  async function verifyModel(windowExpression, context) {
    const rows = 'Object.values(APP.R.eqs).flatMap(e=>e.piezas)';
    const run = code => evaluate(windowExpression + '.eval(' + JSON.stringify(code) + ')');
    for (const key of Object.keys(expected)) {
      const preset = 'APP.aplicarEsc(' + JSON.stringify(key) + ');';
      const actual = await run(preset + 'Object.fromEntries(' + rows + '.map(p=>[p.tag,[p.s,p.reg??null,p.c?.life??null,p.c?.req??null]]))');
      for (const [tag, values] of Object.entries(actual)) {
        const row = expected[key][tag];
        const target = [row.s,row['región'],row.vida,row.vidaRequerida];
        if (JSON.stringify(values)!==JSON.stringify(target)) issues.push({context,key,tag,values,target});
        compared++;
      }
    }
    await run("APP.aplicarEsc('base')");
  }
  async function screenshot(file) {
    const {data} = await send('Page.captureScreenshot',{format:'png'});
    try {
      fs.writeFileSync(path.join(shots,file),Buffer.from(data,'base64'));
    } catch (error) {
      captureFailures.push(file + ' ' + error.code);
    }
  }
  async function layout(context) {
    const reports = await evaluate('(' + measure.toString() + ')()');
    views++;
    for (const report of reports) issues.push({context,...report});
  }
  for (const width of [1920,1280]) {
    await send('Emulation.setDeviceMetricsOverride',{width,height:width*9/16,deviceScaleFactor:1,mobile:false});
    await send('Page.navigate',{url});
    await waitFor(()=>evaluate('Boolean(document.querySelector("#progress button"))'));
    const count = await evaluate('document.querySelectorAll(".slide").length');
    for (let index=0; index<count; index++) {
      const label = await evaluate(`(() => {
        document.querySelectorAll('#progress button')[${index}].click();
        const slide = document.querySelector('.slide.active');
        return {id:slide.dataset.resultId, tabs:slide.querySelectorAll('.sim-tabs button').length,
          frame:slide.querySelector('iframe')?.id};
      })()`);
      const context = width+'/'+(index+1)+'/'+(label.id ?? label.frame ?? 'slide');
      if (!label.frame) await layout(context);
      if (width===1920 && ['navarro','baleta','franco'].includes(label.id)) await screenshot('res-'+label.id+'.png');
      if (!label.frame) continue;
      for (let tabIndex=0; tabIndex<Math.max(1,label.tabs); tabIndex++) {
        if (label.tabs) await evaluate(`document.querySelectorAll('.slide.active .sim-tabs button')[${tabIndex}].click()`);
        const ready = await waitFor(()=>evaluate(`(() => {
          const f = document.getElementById(${JSON.stringify(label.frame)});
          return f.contentDocument?.readyState === 'complete' && f.contentDocument.URL.split('#')[0] === f.src.split('#')[0];
        })()`));
        assert.ok(ready);
        const tabs = await evaluate(`(() => {
          const f = document.getElementById(${JSON.stringify(label.frame)});
          const d=f.contentDocument;
          return {uniform:!!d.querySelector('#equipmentScenario'), internal:[...d.querySelectorAll('#eqTabs button,[role=tab]')]
            .filter(e=>e.getClientRects().length).length};
        })()`);
        if (width===1920 && label.frame==='visor-A2_navarro' && tabIndex===0) {
          await delay(120);
          await screenshot('sim-navarro-corte.png');
        }
        const child = 'document.getElementById(' + JSON.stringify(label.frame) + ').contentWindow';
        if (width===1920 && tabs.uniform) await verifyModel(child,context);
        if (label.frame==='visor-integrado') {
          const plant = child + ".document.getElementById('f-planta').contentWindow";
          await waitFor(()=>evaluate("typeof " + plant + ".abrirEquipo === 'function'"));
          if (width===1920) {
            await verifyModel(plant,context+'/planta');
            await evaluate(child + ".document.querySelector('[data-tab=envolvente]').click()");
            for (const [key, count] of Object.entries(results.conteos)) {
              const doc = child + '.document';
              const actual = await evaluate(doc + '.querySelector("[data-pre=' + key + ']").click(); Array.from(' +
                doc + '.querySelectorAll("#env .env-kpi b"),el=>Number(el.textContent))');
              if (JSON.stringify(actual)!==JSON.stringify(count)) issues.push({context,key,actual,count});
            }
            await evaluate(child + ".document.querySelector('[data-tab=planta]').click()");
          }
          await evaluate(plant + ".abrirEquipo('TL-201')");
          const n = await evaluate(plant + ".document.querySelectorAll('#eqTabs button').length");
          for (let i=0; i<n; i++) {
            await evaluate(plant + ".document.querySelectorAll('#eqTabs button')[" + i + "].click()");
            await delay(30);
            await layout(context+'/planta/'+i);
          }
        }
        for (let inner=0;inner<Math.max(1,tabs.internal);inner++) {
          if (tabs.internal) await evaluate(`[...document.getElementById(${JSON.stringify(label.frame)}).contentDocument.querySelectorAll('#eqTabs button,[role=tab]')].filter(e=>e.getClientRects().length)[${inner}]?.click()`);
          await delay(32);
          await layout(context+'/'+tabIndex+'/'+inner);
        }
      }
    }
  }
  const findGrades = folder => fs.readdirSync(folder,{withFileTypes:true}).flatMap(entry => {
    const file = path.join(folder,entry.name);
    if (entry.isDirectory()) return findGrades(file);
    return entry.name.endsWith('.html') && /L[0-9]{3}NE/.test(fs.readFileSync(file,'utf8')) ? [file] : [];
  });
  issues.push(...findGrades(path.join(root,'sim')), ...findGrades(path.join(root,'presentacion')));
  if (/L[0-9]{3}NE/.test(fs.readFileSync(path.join(root,'resultados.json'),'utf8'))) issues.push('resultados.json');
  const grades = issues.filter(item=>typeof item==='string').length;
  const overlap = issues.filter(item=>item.type?.startsWith('solape')).length;
  const horizontal = issues.filter(item=>item.type==='scroll horizontal').length;
  console.log(JSON.stringify({views,compared,consoleErrors:errors.length,overlap,horizontal,grades,
    modelDifferences:issues.length-grades-overlap-horizontal,captureFailures},null,2));
  if (issues.length) {
    const unique = new Map(issues.map(i=>[JSON.stringify([i.type,i.url,i.a,i.b,i.tag,i.key]),i]));
    console.log(JSON.stringify([...unique.values()].slice(0,50),null,2));
  }
  assert.deepEqual(errors, []);
  assert.equal(issues.length,0);
  if (captureFailures.length) process.exitCode = 2;
}

function measure() {
  const findings = [];
  function visit(window, depth=0) {
    const doc = window.document;
    const body = doc.body;
    if (!body || !window.innerWidth) return;
    const excess = Math.max(body.scrollWidth,doc.documentElement.scrollWidth)-window.innerWidth;
    if (excess > 1) findings.push({type:'scroll horizontal',excess,url:doc.URL});
    const visible = element => element.getClientRects().length && window.getComputedStyle(element).visibility==='visible';
    const label = el => el.textContent.trim().slice(0,85);
    const compare = (a,b) => Math.min(a.right,b.right)-Math.max(a.left,b.left) > 2 &&
      Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top) > 2;
    const sets = [...doc.querySelectorAll('svg')].filter(visible).map(svg =>
      [...svg.querySelectorAll('text')].filter(el=>el.ownerSVGElement===svg && visible(el)));
    sets.push([...doc.querySelectorAll('body *')].filter(el=>el instanceof window.HTMLElement &&
      visible(el) && ['absolute','fixed'].includes(window.getComputedStyle(el).position) &&
      [...el.childNodes].some(node=>node.nodeType===3 && node.textContent.trim())));
    for (const set of sets) {
      const boxes = set.map(el=>[el,el.getBoundingClientRect()]);
      boxes.forEach(([a,ra],index)=>boxes.slice(index+1).forEach(([b,rb])=>{
        if (a.contains(b) || b.contains(a) || !compare(ra,rb)) return;
        findings.push({type:'solape',a:label(a),b:label(b),url:doc.URL});
      }));
    }
    for (const cv of doc.querySelectorAll('#cvEq,#cvVida')) {
      if (!visible(cv) || !cv.layoutText) continue;
      const labels = cv.layoutText.filter(b=>b.left>=0 && b.top>=0 && b.right<=cv.width && b.bottom<=cv.height);
      labels.forEach((a,index)=>labels.slice(index+1).forEach(b=>{
        if (compare(a,b)) findings.push({type:'solape canvas',a:a.label,b:b.label,canvas:cv.id,url:doc.URL});
      }));
    }
    if (depth<3) for (const frame of doc.querySelectorAll('iframe')) {
      if (visible(frame) && frame.contentDocument) visit(frame.contentWindow,depth+1);
    }
  }
  visit(window);
  return findings;
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
