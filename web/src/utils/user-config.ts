if (!localStorage.getItem('theme')) {
  localStorage.setItem(
    'theme',
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  );
}

if (!localStorage.getItem('fontSize')) {
  localStorage.setItem('fontSize', '14');
}

if (!localStorage.getItem('volumen')) {
  localStorage.setItem('volumen', '1');
}

if (!localStorage.getItem('playback')) {
  localStorage.setItem('playback', '1');
}

document.documentElement.dataset['theme'] = localStorage.getItem('theme') || 'light';
document.documentElement.style.setProperty(
  '--text-size',
  `${Number(localStorage.getItem('fontSize'))}pt`
);

export function increaseFontSize() {
  let fontSize = Number(localStorage.getItem('fontSize'));
  if (fontSize > 36) return;

  fontSize += 2;
  localStorage.setItem('fontSize', String(fontSize));
  document.documentElement.style.setProperty('--text-size', `${fontSize}pt`);
}

export function decreaseFontSize() {
  let fontSize = Number(localStorage.getItem('fontSize'));
  if (fontSize < 12) return;

  fontSize -= 2;
  localStorage.setItem('fontSize', String(fontSize));
  document.documentElement.style.setProperty('--text-size', `${fontSize}pt`);
}
