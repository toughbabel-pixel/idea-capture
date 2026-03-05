(function initRenderer() {
  const captureInput = document.getElementById('ideaInput');
  const saveBtn = document.getElementById('saveBtn');
  const historyBtn = document.getElementById('historyBtn');
  const statusText = document.getElementById('statusText');
  const dailyCountLabel = document.getElementById('dailyCountLabel');
  const darkModeToggle = document.getElementById('darkModeToggle');
  const darkModeToggleHistory = document.getElementById('darkModeToggleHistory');
  const searchInput = document.getElementById('searchInput');
  const historyList = document.getElementById('historyList');
  const emptyState = document.getElementById('emptyState');
  const exportBtn = document.getElementById('exportBtn');

  function setTheme(enabled) {
    document.documentElement.setAttribute('data-theme', enabled ? 'dark' : 'light');
    if (darkModeToggle) darkModeToggle.checked = enabled;
    if (darkModeToggleHistory) darkModeToggleHistory.checked = enabled;
  }

  async function loadAndApplySettings() {
    const data = await window.ideaAPI.getIdeasData();
    setTheme(Boolean(data.darkMode));

    if (dailyCountLabel) {
      const today = new Date().toISOString().slice(0, 10);
      dailyCountLabel.textContent = `Ideas today: ${data.dailyCounts[today] || 0}`;
    }

    return data;
  }

  function flashStatus(message, timeout = 1400) {
    if (!statusText) return;
    statusText.textContent = message;
    if (timeout > 0) {
      setTimeout(() => {
        statusText.textContent = '';
      }, timeout);
    }
  }

  async function saveCurrentIdea() {
    if (!captureInput) return;

    const text = captureInput.value;
    const result = await window.ideaAPI.saveIdea({ text });

    if (!result.ok) {
      flashStatus(result.message || 'Unable to save', 2000);
      return;
    }

    captureInput.value = '';
    dailyCountLabel.textContent = `Ideas today: ${result.dailyCount}`;
    flashStatus('Saved ✓');
  }

  function renderHistory(ideas, query) {
    if (!historyList || !emptyState) return;

    const normalized = (query || '').trim().toLowerCase();
    const filtered = ideas
      .slice()
      .sort((a, b) => {
        if (a.pinned === b.pinned) {
          return new Date(b.createdAt) - new Date(a.createdAt);
        }
        return a.pinned ? -1 : 1;
      })
      .filter((idea) => {
        if (!normalized) return true;
        return (
          idea.text.toLowerCase().includes(normalized) ||
          idea.tags.some((tag) => tag.includes(normalized))
        );
      });

    historyList.innerHTML = '';

    if (!filtered.length) {
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    filtered.forEach((idea) => {
      const item = document.createElement('li');
      item.className = 'idea-item';

      const meta = document.createElement('div');
      meta.className = 'idea-meta';
      meta.innerHTML = `
        <span>${new Date(idea.createdAt).toLocaleString()}</span>
        <span>${idea.pinned ? '📌 Pinned' : ''}</span>
      `;

      const text = document.createElement('p');
      text.className = 'idea-text';
      text.textContent = idea.text;

      const tags = document.createElement('div');
      tags.className = 'idea-tags';
      tags.textContent = idea.tags.length ? idea.tags.join(' ') : 'No tags';

      const controls = document.createElement('div');
      controls.className = 'idea-controls';

      const pinBtn = document.createElement('button');
      pinBtn.textContent = idea.pinned ? 'Unpin' : 'Pin';
      pinBtn.className = `pin ${idea.pinned ? 'active' : ''}`;
      pinBtn.addEventListener('click', async () => {
        await window.ideaAPI.togglePin(idea.id);
        await loadHistory();
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'danger';
      deleteBtn.addEventListener('click', async () => {
        await window.ideaAPI.deleteIdea(idea.id);
        await loadHistory();
      });

      controls.append(pinBtn, deleteBtn);
      item.append(meta, text, tags, controls);
      historyList.appendChild(item);
    });
  }

  async function loadHistory() {
    const data = await window.ideaAPI.getIdeasData();
    renderHistory(data.ideas, searchInput?.value || '');
    setTheme(Boolean(data.darkMode));
  }

  if (captureInput) {
    captureInput.focus();

    captureInput.addEventListener('keydown', async (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        await saveCurrentIdea();
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        await window.ideaAPI.closeCaptureWindow();
      }
    });

    saveBtn.addEventListener('click', saveCurrentIdea);

    historyBtn.addEventListener('click', async () => {
      await window.ideaAPI.openHistoryWindow();
    });

    window.ideaAPI.onFocusInput(() => {
      captureInput.focus();
    });

    loadAndApplySettings();
  }

  if (historyList) {
    searchInput.addEventListener('input', loadHistory);

    exportBtn.addEventListener('click', async () => {
      const result = await window.ideaAPI.exportMarkdown();
      if (!result.ok) return;
      alert(`Exported to ${result.filePath}`);
    });

    window.ideaAPI.onHistoryRefresh(loadHistory);
    loadHistory();
  }

  const themeListener = async (event) => {
    const enabled = event.target.checked;
    setTheme(enabled);
    await window.ideaAPI.setDarkMode(enabled);
  };

  if (darkModeToggle) darkModeToggle.addEventListener('change', themeListener);
  if (darkModeToggleHistory) darkModeToggleHistory.addEventListener('change', themeListener);
})();
