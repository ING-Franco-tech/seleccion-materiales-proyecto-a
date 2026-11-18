'use strict';

const stage = document.getElementById('stage');
const slides = [...document.querySelectorAll('.slide')];
const progress = document.getElementById('progress');
const counter = document.getElementById('counter');
const part = document.getElementById('part');
const speaker = document.getElementById('speaker');
const source = document.getElementById('source');
const editor = new URLSearchParams(location.search).get('editor') === '1';
document.body.classList.toggle('editor', editor);
let index = 0;
const guide = document.getElementById('guide');
const guideButton = document.getElementById('guide-toggle');
const guideNotes = document.getElementById('guide-notes');
function resize() {
  const available = innerWidth - (guide.hidden ? 0 : guide.offsetWidth);
  stage.style.left = available / 2 + 'px';
  stage.style.setProperty('--scale', Math.min(available / 1600, innerHeight / 900));
}
function toggleGuide() {
  guide.hidden = !guide.hidden;
  guideButton.setAttribute('aria-expanded', String(!guide.hidden));
  resize();
}
guideButton.onclick = toggleGuide;
document.getElementById('guide-close').onclick = () => {
  toggleGuide();
  guideButton.focus();
};
const fromHash = () => (parseInt(location.hash.slice(1), 10) || 1) - 1;
const segments = slides.map((_, i) => {
  const dot = document.createElement('button');
  dot.type = 'button';
  dot.setAttribute('aria-label', 'Ir a diapositiva ' + (i + 1));
  dot.addEventListener('click', () => show(i));
  progress.append(dot);
  return dot;
});
const cached = new Map(slides.map(slide => [slide, slide.querySelector('iframe')]).filter(([,frame]) => frame));
const frameSource = frame => frame.dataset.src + (editor ? '&editor=1' : '');
function show(position) {
  index = Math.max(0, Math.min(slides.length - 1, position));
  slides.forEach((slide, i) => {
    slide.classList.toggle('active', i === index);
    slide.setAttribute('aria-hidden', String(i !== index));
    segments[i].classList.toggle('past', i < index);
    segments[i].setAttribute('aria-current', i === index ? 'true' : 'false');
    const frame = cached.get(slide);
    if (!frame) return;
    if (i !== index) slide.querySelector(':popover-open')?.hidePopover();
    if (Math.abs(i - index) <= (frame.hasAttribute('data-active-only') ? 0 : 1)) {
      if (!frame.hasAttribute('src')) frame.setAttribute('src', frameSource(frame));
    } else {
      frame.removeAttribute('src');
    }
  });
  const slide = slides[index];
  guideNotes.replaceChildren(...JSON.parse(slide.dataset.notes).map(note => {
    const item = document.createElement('li');
    item.textContent = note;
    return item;
  }));
  guide.scrollTop = 0;
  part.textContent = slide.dataset.part;
  speaker.textContent = slide.dataset.speaker;
  speaker.hidden = !speaker.textContent;
  speaker.style.setProperty('--speaker', slide.style.getPropertyValue('--accent'));
  source.textContent = slide.dataset.source;
  counter.value = String(index + 1).padStart(2, '0') + ' / ' + slides.length;
  const hash = '#' + (index + 1);
  if (location.hash !== hash) history.replaceState(null, '', hash);
}
async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {}
}
for (const [slide, frame] of cached) {
  const tabs = [...slide.querySelectorAll('.sim-tabs [role="tab"]')];
  for (const [position, tab] of tabs.entries()) {
    tab.addEventListener('click', () => {
      if (tab.getAttribute('aria-selected') === 'true') return;
      for (const button of tabs) {
        button.setAttribute('aria-selected', String(button === tab));
        button.tabIndex = button === tab ? 0 : -1;
      }
      frame.title = tab.textContent;
      frame.dataset.src = tab.dataset.module + (tab.dataset.module.includes('?') ? '&' : '?') + 'embed=1';
      frame.src = frameSource(frame);
      slide.querySelector('.sim-open').href = tab.dataset.module;
    });
    tab.addEventListener('keydown', event => {
      const destinations = {ArrowLeft:(position + tabs.length - 1) % tabs.length,
        ArrowRight:(position + 1) % tabs.length, Home:0, End:tabs.length - 1};
      if (!Object.hasOwn(destinations, event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      tabs[destinations[event.key]].focus();
      tabs[destinations[event.key]].click();
    });
  }
  slide.querySelector('.sim-fullscreen').addEventListener('click', async () => {
    try {
      await frame.requestFullscreen();
    } catch {
      alert('No se pudo activar la pantalla completa.');
    }
  });
}
document.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key.toLowerCase() === 'n' && !event.repeat) {
    event.preventDefault();
    toggleGuide();
    return;
  }
  if (event.key === ' ' && event.target.closest('button')) return;
  if (['f', 'p'].includes(event.key.toLowerCase())) {
    event.preventDefault();
    fullscreen();
    return;
  }
  const destinations = {ArrowRight:index + 1, PageDown:index + 1, ' ':index + 1,
    ArrowLeft:index - 1, PageUp:index - 1, Home:0, End:slides.length - 1};
  if (!Object.hasOwn(destinations, event.key)) return;
  event.preventDefault();
  show(destinations[event.key]);
});
const interactive = event => event.target.closest('button, a, .sim-layout');
stage.addEventListener('click', event => {
  if (!interactive(event)) show(index - 1);
});
stage.addEventListener('contextmenu', event => {
  if (interactive(event)) return;
  event.preventDefault();
  show(index + 1);
});
window.addEventListener('message', event => {
  if (!event.data || !['ArrowLeft','ArrowRight','n'].includes(event.data.projectAKey)) return;
  if (![...cached.values()].some(frame => frame.contentWindow === event.source && frame.closest('.active'))) return;
  if (event.data.projectAKey === 'n') {
    toggleGuide();
    return;
  }
  if (document.fullscreenElement) return;
  show(index + (event.data.projectAKey === 'ArrowRight' ? 1 : -1));
});
window.addEventListener('resize', resize);
window.addEventListener('hashchange', () => show(fromHash()));
resize();
show(fromHash());
