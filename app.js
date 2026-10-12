// understory — app.js (Zero-Knowledge Edition)
// Decrypts encrypted vault payload into browser memory strictly using Web Crypto.
// No raw URLs, keys, or metadata are ever stored unencrypted in repository.

(() => {
  const PBKDF2_ITERATIONS = 250000;

  let VIDEO_DATA = [];
  let activeFilter = 'all';
  let searchQuery = '';
  let selectedVideo = null;

  // Vault Gate Elements
  const vaultLockedView = document.getElementById('vault-locked-view');
  const vaultUnlockedView = document.getElementById('vault-unlocked-view');
  const vaultPassInput = document.getElementById('vault-pass-input');
  const vaultUnlockBtn = document.getElementById('vault-unlock-btn');
  const vaultErr = document.getElementById('vault-err');
  const lockVaultBtn = document.getElementById('lock-vault-btn');
  const statusLine = document.getElementById('status-line');

  // Controls Elements
  const cardsContainer = document.getElementById('cards-container');
  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search');
  const filterChips = document.querySelectorAll('.filter-chip');
  const resultsCount = document.getElementById('results-count');

  // Modal Elements
  const shieldDialog = document.getElementById('shield-dialog');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalVideoTitle = document.getElementById('modal-video-title');
  const modalFranchise = document.getElementById('modal-franchise');
  const modalCharacters = document.getElementById('modal-characters');
  const modalCopyDirectBtn = document.getElementById('modal-copy-direct-btn');
  const modalCopyCloakBtn = document.getElementById('modal-copy-cloak-btn');
  const modalDirectAnchor = document.getElementById('modal-direct-anchor');

  // Utility Elements
  const toastEl = document.getElementById('toast');
  const themeToggle = document.getElementById('theme-toggle');
  const camouflageBtn = document.getElementById('camouflage-btn');
  const decoyView = document.getElementById('decoy-view');
  const decoyExitBtn = document.getElementById('decoy-exit-btn');
  const copyAllUrlsBtn = document.getElementById('copy-all-urls');

  // ── Web Crypto Decryption ──
  const b64 = {
    decode(str) {
      str = str.replace(/-/g, '+').replace(/_/g, '/');
      while (str.length % 4) str += '=';
      const bin = atob(str);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    }
  };

  function deriveKey(passphrase, salt) {
    return crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    ).then((baseKey) =>
      crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      )
    );
  }

  async function decryptVault(cipherB64, passphrase) {
    const bytes = b64.decode(cipherB64);
    const salt = bytes.slice(1, 17);
    const iv = bytes.slice(17, 29);
    const cipherBytes = bytes.slice(29);
    const key = await deriveKey(passphrase, salt);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBytes);
    return JSON.parse(new TextDecoder().decode(plain));
  }

  // ── Vault Unlock Handler ──
  async function attemptUnlock(passphrase) {
    if (!passphrase) return;
    vaultErr.hidden = true;
    vaultUnlockBtn.disabled = true;
    vaultUnlockBtn.textContent = 'Decrypting...';

    try {
      const decrypted = await decryptVault(window.ENCRYPTED_VAULT, passphrase);
      VIDEO_DATA = decrypted;
      sessionStorage.setItem('understory_session_pass', passphrase);

      vaultLockedView.hidden = true;
      vaultUnlockedView.hidden = false;
      statusLine.textContent = 'Decrypted in memory • Zero-knowledge protection';

      // Clean hash if pass was passed in URL
      if (location.hash.includes('pass=')) {
        history.replaceState(null, '', location.pathname);
      }

      updateFilterCounts();
      render();
      showToast('Vault unlocked successfully');
    } catch (err) {
      vaultErr.hidden = false;
      vaultPassInput.select();
      showToast('Decryption failed: Incorrect passphrase');
    } finally {
      vaultUnlockBtn.disabled = false;
      vaultUnlockBtn.textContent = 'Unlock';
    }
  }

  function lockVault() {
    VIDEO_DATA = [];
    sessionStorage.removeItem('understory_session_pass');
    vaultUnlockedView.hidden = true;
    vaultLockedView.hidden = false;
    vaultPassInput.value = '';
    statusLine.textContent = 'A quiet, earthy archive. Built incognito-first.';
    showToast('Vault locked and memory cleared');
  }

  vaultUnlockBtn.addEventListener('click', () => {
    attemptUnlock(vaultPassInput.value.trim());
  });

  vaultPassInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') attemptUnlock(vaultPassInput.value.trim());
  });

  lockVaultBtn.addEventListener('click', lockVault);

  // ── Toast Notification ──
  let toastTimer = null;
  function showToast(message, duration = 2400) {
    if (toastTimer) clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.hidden = false;
    toastEl.style.animation = 'none';
    toastEl.offsetHeight; // trigger reflow
    toastEl.style.animation = 'toastIn .28s cubic-bezier(.32, .72, 0, 1) both';

    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, duration);
  }

  // ── Clipboard helper ──
  async function copyToClipboard(text, successMsg) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      showToast(successMsg);
      return true;
    } catch (e) {
      showToast('Failed to copy to clipboard');
      return false;
    }
  }

  // ── Filter Counts ──
  function updateFilterCounts() {
    const counts = {
      all: VIDEO_DATA.length,
      quintuplets: VIDEO_DATA.filter((v) => v.franchise === 'quintuplets').length,
      'demon-slayer': VIDEO_DATA.filter((v) => v.franchise === 'demon-slayer').length,
      'chainsaw-man': VIDEO_DATA.filter((v) => v.franchise === 'chainsaw-man').length,
      're-zero': VIDEO_DATA.filter((v) => v.franchise === 're-zero').length,
      horimiya: VIDEO_DATA.filter((v) => v.franchise === 'horimiya').length,
      '100-kanojo': VIDEO_DATA.filter((v) => v.franchise === '100-kanojo').length
    };

    Object.keys(counts).forEach((key) => {
      const el = document.getElementById(`count-${key}`);
      if (el) el.textContent = counts[key];
    });
  }

  // ── Filter & Search Logic ──
  function getFilteredVideos() {
    return VIDEO_DATA.filter((v) => {
      const matchesFilter =
        activeFilter === 'all' || v.franchise === activeFilter;

      if (!matchesFilter) return false;

      if (!searchQuery) return true;

      const q = searchQuery.toLowerCase();
      const titleMatch = v.title.toLowerCase().includes(q);
      const fullTitleMatch = v.fullTitle.toLowerCase().includes(q);
      const franchiseMatch = v.franchiseName.toLowerCase().includes(q);
      const tagMatch = v.userTag.toLowerCase().includes(q);
      const charMatch = v.characters.some((c) => c.toLowerCase().includes(q));
      const badgeMatch = v.badges.some((b) => b.toLowerCase().includes(q));

      return titleMatch || fullTitleMatch || franchiseMatch || tagMatch || charMatch || badgeMatch;
    });
  }

  // ── Render Cards ──
  function render() {
    const list = getFilteredVideos();
    resultsCount.textContent = `${list.length} ${list.length === 1 ? 'title' : 'titles'} found`;

    if (list.length === 0) {
      cardsContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 16px; color: var(--muted);">
          <p style="font-size: 16px; margin-bottom: 8px;">No matching entries found.</p>
          <button id="reset-filter-btn" class="act act-strong">Clear search & filters</button>
        </div>
      `;
      const resetBtn = document.getElementById('reset-filter-btn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          searchQuery = '';
          searchInput.value = '';
          clearSearchBtn.hidden = true;
          activeFilter = 'all';
          updateFilterChipUI();
          render();
        });
      }
      return;
    }

    cardsContainer.innerHTML = list
      .map((item) => {
        const badgesHtml = item.badges
          .map((b) => `<span class="badge">${b}</span>`)
          .join('');

        return `
        <article class="video-card" data-id="${item.id}">
          <div class="card-header">
            <div class="card-topline">
              <span class="card-franchise">${item.franchiseName}</span>
              <span class="badge">${item.characters[0] || 'Curated'}</span>
            </div>
            <h2 class="card-title">${item.title}</h2>
            <p class="card-meta">
              <strong>${item.characters.join(', ')}</strong> • <em>${item.userTag}</em>
            </p>
            <div class="badges-row">
              ${badgesHtml}
            </div>
          </div>

          <div class="card-actions">
            <button class="btn-incognito" data-id="${item.id}" title="Copy direct link for Private/Incognito window">
              <span>⚡</span> Copy for Incognito
            </button>
            <div class="card-sub-acts">
              <button class="act" data-action="details" data-id="${item.id}">Details</button>
              <a href="${item.cloakUrl}" target="_blank" rel="noreferrer noopener" class="act act-accent" title="Open via Cloak decryptor">Cloak ↗</a>
            </div>
          </div>
        </article>
      `;
      })
      .join('');

    // Attach card action listeners
    attachCardListeners();
  }

  function attachCardListeners() {
    // One-click Incognito Copy button
    cardsContainer.querySelectorAll('.btn-incognito').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const item = VIDEO_DATA.find((v) => v.id === id);
        if (!item) return;

        const originalText = btn.innerHTML;
        btn.innerHTML = `<span>✓</span> Copied!`;
        btn.style.background = 'var(--moss)';

        await copyToClipboard(
          item.directUrl,
          `Copied! Open Incognito (⌘+Shift+N) & paste URL`
        );

        setTimeout(() => {
          btn.innerHTML = originalText;
          btn.style.background = '';
        }, 1800);
      });
    });

    // Details / Shield button
    cardsContainer.querySelectorAll('[data-action="details"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        openShieldModal(id);
      });
    });
  }

  // ── Shield Modal ──
  function openShieldModal(id) {
    const item = VIDEO_DATA.find((v) => v.id === id);
    if (!item) return;
    selectedVideo = item;

    modalVideoTitle.textContent = item.title;
    modalFranchise.textContent = item.franchiseName;
    modalCharacters.textContent = item.characters.join(', ');
    modalDirectAnchor.href = item.directUrl;
    modalDirectAnchor.textContent = item.directUrl;

    shieldDialog.showModal();
  }

  modalCloseBtn.addEventListener('click', () => {
    shieldDialog.close();
  });

  shieldDialog.addEventListener('click', (e) => {
    if (e.target === shieldDialog) shieldDialog.close();
  });

  modalCopyDirectBtn.addEventListener('click', () => {
    if (!selectedVideo) return;
    copyToClipboard(
      selectedVideo.directUrl,
      'Direct URL copied! Press ⌘+Shift+N to open Private Tab & paste.'
    );
  });

  modalCopyCloakBtn.addEventListener('click', () => {
    if (!selectedVideo) return;
    copyToClipboard(
      selectedVideo.cloakUrl,
      'Cloaked link copied to clipboard!'
    );
  });

  // ── Global Search & Filters ──
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    clearSearchBtn.hidden = !searchQuery;
    render();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.hidden = true;
    searchInput.focus();
    render();
  });

  filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      activeFilter = chip.getAttribute('data-filter');
      updateFilterChipUI();
      render();
    });
  });

  function updateFilterChipUI() {
    filterChips.forEach((c) => {
      c.classList.toggle('active', c.getAttribute('data-filter') === activeFilter);
    });
  }

  copyAllUrlsBtn.addEventListener('click', () => {
    const filtered = getFilteredVideos();
    const urls = filtered.map((v) => `${v.title}\n${v.directUrl}`).join('\n\n');
    copyToClipboard(
      urls,
      `Copied all ${filtered.length} URLs to clipboard for batch viewing!`
    );
  });

  // ── Theme Toggle ──
  const storedTheme = localStorage.getItem('understory-theme');
  if (storedTheme) {
    document.body.setAttribute('data-theme', storedTheme);
  }

  themeToggle.addEventListener('click', () => {
    const current = document.body.getAttribute('data-theme');
    let next;
    if (current === 'dark') {
      next = 'light';
    } else if (current === 'light') {
      next = 'dark';
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      next = prefersDark ? 'light' : 'dark';
    }
    document.body.setAttribute('data-theme', next);
    localStorage.setItem('understory-theme', next);
    showToast(`Switched to ${next} theme`);
  });

  // ── Camouflage / Decoy Mode ──
  function toggleCamouflage() {
    const isHidden = decoyView.hidden;
    decoyView.hidden = !isHidden;
    if (!isHidden) {
      showToast('Camouflage mode disabled');
    }
  }

  camouflageBtn.addEventListener('click', toggleCamouflage);
  decoyExitBtn.addEventListener('click', toggleCamouflage);

  // Esc key closes modal or toggles camouflage
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (shieldDialog.open) {
        shieldDialog.close();
      } else {
        toggleCamouflage();
      }
    }
  });

  // ── Boot / Initialization ──
  // Check for #pass= in URL or existing session
  const hashMatch = location.hash.match(/pass=([^&]+)/);
  const sessionPass = sessionStorage.getItem('understory_session_pass');
  if (hashMatch) {
    attemptUnlock(decodeURIComponent(hashMatch[1]));
  } else if (sessionPass) {
    attemptUnlock(sessionPass);
  } else {
    // Focus password input
    vaultPassInput.focus();
  }
})();
