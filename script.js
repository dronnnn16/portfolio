// Mobile navigation
const toggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('site-nav');

toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') === 'true';
  toggle.setAttribute('aria-expanded', String(!open));
  nav.classList.toggle('open', !open);
});

nav.addEventListener('click', (e) => {
  if (e.target.closest('a')) {
    toggle.setAttribute('aria-expanded', 'false');
    nav.classList.remove('open');
  }
});

// Free trial form: opens WhatsApp with the booking details filled in.
// Replace the number with the gym's WhatsApp Business number.
const WHATSAPP_NUMBER = '919800000000';
const form = document.querySelector('.trial-form');
const error = form.querySelector('.form-error');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = form.elements['name'].value.trim();
  const phone = form.elements['phone'].value.trim();
  const time = form.elements['time'].value;

  if (!name || phone.replace(/\D/g, '').length < 10) {
    error.textContent = !name
      ? 'Enter your name so we know who to expect.'
      : 'Enter a 10-digit phone number so we can confirm your slot.';
    error.hidden = false;
    form.elements[!name ? 'name' : 'phone'].focus();
    return;
  }

  error.hidden = true;
  const message = `Hi Iron Haveli, I'd like to book a free trial.\nName: ${name}\nPhone: ${phone}\nPreferred time: ${time}`;
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
});

document.getElementById('year').textContent = new Date().getFullYear();

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Header shadow and scroll progress bar
const header = document.querySelector('.site-header');
const progress = document.createElement('div');
progress.className = 'scroll-progress';
progress.setAttribute('aria-hidden', 'true');
header.appendChild(progress);
let scrollTicking = false;
function onScroll() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
  header.classList.toggle('scrolled', window.scrollY > 8);
  scrollTicking = false;
}
window.addEventListener('scroll', () => {
  if (!scrollTicking) { scrollTicking = true; requestAnimationFrame(onScroll); }
}, { passive: true });
onScroll();

// Scroll reveals: each block slides in from its side, siblings in a short stagger.
// Anything already on screen at load is left visible, so the first frame is complete.
const REVEALS = [
  ['.about-photo', 'from-right'],
  ['.about-copy > *', 'from-left'],
  ['.section-head > *', 'from-left'],
  ['.program-list li', 'from-left'],
  ['.review-feature', ''],
  ['.review', ''],
  ['.plan', ''],
  ['.pt-note', ''],
  ['.trial > :not(form), .trial-form > :not([hidden])', 'from-left'],
  ['.find-us > *', 'from-right'],
];

if (!reduceMotion && 'IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      revealObserver.unobserve(el);
      el.classList.add('in');
      const delay = parseInt(el.style.getPropertyValue('--delay'), 10) || 0;
      // Hand the element back to its normal hover transitions once it has landed
      setTimeout(() => {
        el.classList.remove('reveal', 'in', 'from-left', 'from-right');
        el.style.removeProperty('--delay');
      }, 1000 + delay);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  REVEALS.forEach(([selector, direction]) => {
    const seen = new Map();
    document.querySelectorAll(selector).forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight) return;
      const i = seen.get(el.parentElement) || 0;
      seen.set(el.parentElement, i + 1);
      el.classList.add('reveal');
      if (direction) el.classList.add(direction);
      el.style.setProperty('--delay', `${Math.min(i, 6) * 90}ms`);
      revealObserver.observe(el);
    });
  });
}

// Count-up for the about figures
const counters = document.querySelectorAll('[data-count]');
if (!reduceMotion && 'IntersectionObserver' in window) {
  const countObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      countObserver.unobserve(entry.target);
      const el = entry.target;
      const target = Number(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min((now - start) / 1400, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(target * eased).toLocaleString('en-IN') + (t === 1 ? suffix : '');
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.6 });
  counters.forEach((el) => countObserver.observe(el));
}

// Custom cursor and hero parallax, for mouse and trackpad users only
if (!reduceMotion && window.matchMedia('(pointer: fine)').matches) {
  const root = document.documentElement;
  const dot = document.createElement('div');
  const ring = document.createElement('div');
  dot.className = 'cursor-dot';
  ring.className = 'cursor-ring';
  dot.setAttribute('aria-hidden', 'true');
  ring.setAttribute('aria-hidden', 'true');
  document.body.append(dot, ring);
  root.classList.add('has-cursor');

  let mouseX = -100, mouseY = -100, ringX = -100, ringY = -100;
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
    root.classList.add('cursor-on');
  }, { passive: true });
  document.addEventListener('mouseleave', () => root.classList.remove('cursor-on'));
  window.addEventListener('mousedown', () => root.classList.add('cursor-down'));
  window.addEventListener('mouseup', () => root.classList.remove('cursor-down'));

  document.addEventListener('mouseover', (e) => {
    const t = e.target;
    root.classList.toggle('cursor-link', !!t.closest('a, button, select, .program-list li, .plan'));
    root.classList.toggle('cursor-text', !!t.closest('input, textarea'));
  });

  (function follow() {
    ringX += (mouseX - ringX) * 0.18;
    ringY += (mouseY - ringY) * 0.18;
    ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
    requestAnimationFrame(follow);
  })();

  // The arched windows drift against the cursor at different depths
  const hero = document.querySelector('.hero');
  const facade = document.querySelector('.facade');
  hero.addEventListener('mousemove', (e) => {
    const r = hero.getBoundingClientRect();
    facade.style.setProperty('--mx', (((e.clientX - r.left) / r.width) - 0.5) * -2);
    facade.style.setProperty('--my', (((e.clientY - r.top) / r.height) - 0.5) * -2);
  });
  hero.addEventListener('mouseleave', () => {
    facade.style.setProperty('--mx', 0);
    facade.style.setProperty('--my', 0);
  });
}
