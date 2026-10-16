// Set the theme before first paint so dark-mode users never see a white flash.
try {
  var s = JSON.parse(localStorage.getItem('wherebox.settings') || '{}')
  var dark = s.theme === 'dark' || (s.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  if (s.lang) document.documentElement.lang = s.lang
} catch (e) {}
