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

// Refresh credits button
document.getElementById('refreshCredits').addEventListener('click', function () {
  checkAndDisplayCredits(true);
});

function saveOptions() {
  const apiKey = document.getElementById('apiKey').value;

  const googleKey = document.getElementById('googleKey').value;
  const elevenKey = document.getElementById('elevenKey').value;
  const elevenVoice = document.getElementById('elevenVoice').value;
  const autoDisable = document.getElementById('autoDisableElevenLabs').checked;
  const useReasoner = document.getElementById('deepseekReasoner').checked;
  const customModel = document.getElementById('customModel').value;

  if (!apiKey) {
    showStatus('Por favor, ingresa una clave de DeepSeek principal.', 'error');
    return;
  }

  chrome.storage.sync.set({
    deepseekApiKey: apiKey,
    customModel: customModel,
    googleApiKey: googleKey,
    elevenLabsKey: elevenKey,
    elevenLabsVoiceId: elevenVoice,
    autoDisableElevenLabs: autoDisable,
    useDeepSeekReasoner: useReasoner
  }, () => {
    showStatus('Guardado correctamente.', 'success');

    // Check credits if ElevenLabs key was saved
    if (elevenKey) {
      document.getElementById('creditsStatus').style.display = 'block';
      document.getElementById('autoDisableGroup').style.display = 'block';
      checkAndDisplayCredits();
    }
  });
}

function restoreOptions() {
  chrome.storage.sync.get([
    'deepseekApiKey', 'googleApiKey', 'customModel',
    'elevenLabsKey', 'elevenLabsVoiceId', 'autoDisableElevenLabs', 'useDeepSeekReasoner'
  ], (items) => {
    if (items.deepseekApiKey) {
      document.getElementById('apiKey').value = items.deepseekApiKey;
    }

    if (items.customModel) {
      document.getElementById('customModel').value = items.customModel;
    }

    if (items.googleApiKey) {
      document.getElementById('googleKey').value = items.googleApiKey;
    }
    if (items.elevenLabsKey) {
      document.getElementById('elevenKey').value = items.elevenLabsKey;
      // Show credits section if key exists
      document.getElementById('creditsStatus').style.display = 'block';
      document.getElementById('autoDisableGroup').style.display = 'block';
      checkAndDisplayCredits();
    }
    if (items.elevenLabsVoiceId) {
      document.getElementById('elevenVoice').value = items.elevenLabsVoiceId;
    }
    if (items.autoDisableElevenLabs !== undefined) {
      document.getElementById('autoDisableElevenLabs').checked = items.autoDisableElevenLabs;
    }
    if (items.useDeepSeekReasoner !== undefined) {
      document.getElementById('deepseekReasoner').checked = items.useDeepSeekReasoner;
    }
  });
}

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.style.color = type === 'error' ? '#FF0055' : '#00F2FF';

  setTimeout(() => {
    status.textContent = '';
  }, 3000);
}

// Check and display credits
async function checkAndDisplayCredits(forceRefresh = false) {
  try {
    const action = forceRefresh ? 'refreshCredits' : 'checkCredits';
    const credits = await chrome.runtime.sendMessage({ action });

    if (!credits || credits.remaining === undefined) {
      document.getElementById('creditsStatus').style.display = 'none';
      return;
    }

    const { remaining, total } = credits;
    const percentage = total > 0 ? (remaining / total) * 100 : 0;

    // Update progress bar
    const bar = document.getElementById('creditsBar');
    bar.style.width = `${percentage}%`;

    // Color code the bar
    if (percentage > 20) {
      bar.style.background = 'linear-gradient(90deg, #00ff88, #00cc66)';
    } else if (percentage > 10) {
      bar.style.background = 'linear-gradient(90deg, #ffaa00, #ff8800)';
    } else {
      bar.style.background = 'linear-gradient(90deg, #ff4444, #cc0000)';
    }

    // Update text
    const text = document.getElementById('creditsText');
    text.textContent = `${remaining.toLocaleString()} / ${total.toLocaleString()} créditos (${percentage.toFixed(1)}%)`;

  } catch (error) {
    console.error('Error checking credits:', error);
  }
}
