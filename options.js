document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveBtn').addEventListener('click', saveOptions);

// Toggle Password Visibility
const toggleBtn = document.getElementById('toggleApiVisibility');
const apiKeyInput = document.getElementById('apiKey');

if (toggleBtn && apiKeyInput) {
  toggleBtn.addEventListener('click', () => {
    const type = apiKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
    apiKeyInput.setAttribute('type', type);

    // Update Icon
    if (type === 'text') {
      toggleBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M1 1l22 22"></path><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path></svg>`;
      toggleBtn.style.color = 'var(--accent-color)';
    } else {
      toggleBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
      toggleBtn.style.color = '';
    }
  });
}

function saveOptions() {
  const apiKey = document.getElementById('apiKey').value;
  const openaiKey = document.getElementById('openaiKey').value;
  const googleKey = document.getElementById('googleKey').value;

  if (!apiKey) {
    showStatus('Por favor, ingresa una clave de DeepSeek principal.', 'error');
    return;
  }

  chrome.storage.sync.set({
    deepseekApiKey: apiKey,
    openaiApiKey: openaiKey,
    googleApiKey: googleKey
  }, () => {
    showStatus('Guardado correctamente.', 'success');
  });
}

function restoreOptions() {
  chrome.storage.sync.get(['deepseekApiKey', 'openaiApiKey', 'googleApiKey'], (items) => {
    if (items.deepseekApiKey) {
      document.getElementById('apiKey').value = items.deepseekApiKey;
    }
    if (items.openaiApiKey) {
      document.getElementById('openaiKey').value = items.openaiApiKey;
    }
    if (items.googleApiKey) {
      document.getElementById('googleKey').value = items.googleApiKey;
    }
  });
}

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.style.color = type === 'error' ? '#FF0055' : '#00F2FF'; // Neon Error Red / Neon Cyan

  setTimeout(() => {
    status.textContent = '';
  }, 3000);
}
