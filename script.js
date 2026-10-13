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
