// understory — app.js (Zero-Knowledge Tsundere Edition)
// It's not like I encrypted this whole vault just to protect your privacy, b-baka!
// Decrypts encrypted vault payload into browser memory strictly using Web Crypto.
// No raw URLs, keys, or metadata are ever stored unencrypted in this repository!

(() => {
  const PBKDF2_ITERATIONS = 250000;

  let VIDEO_DATA = [];
  let activeFilter = 'all';
  let activeTypeFilter = 'all';
  let activeGroupMode = 'type'; // 'type' | 'franchise' | 'none'
  let searchQuery = '';
  let selectedVideo = null;
  let sortMode = 'default';
  let favorites = [];
  try {
    // Fine, I'll remember your favorite items, but don't expect me to look at them!
    favorites = JSON.parse(localStorage.getItem('understory_favorites') || '[]');
  } catch (e) {
    favorites = [];
  }

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
  const filterChips = document.querySelectorAll('#filter-bar .filter-chip');
  const typeFilterChips = document.querySelectorAll('#type-filter-bar .filter-chip');
  const modeButtons = document.querySelectorAll('.mode-btn');
  const resultsCount = document.getElementById('results-count');
  const sortSelect = document.getElementById('sort-select');
  const sessionTimerEl = document.getElementById('session-timer');
  const characterQuickBar = document.getElementById('character-quick-bar');

  // Modal Elements
  const shieldDialog = document.getElementById('shield-dialog');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalVideoTitle = document.getElementById('modal-video-title');
  const modalFranchise = document.getElementById('modal-franchise');
  const modalCharacters = document.getElementById('modal-characters');
  const modalLayer1Key = document.getElementById('modal-layer1-key');
  const modalLayer2Key = document.getElementById('modal-layer2-key');
  const modalCopyCloakBtn = document.getElementById('modal-copy-cloak-btn');
  const modalCloakAnchor = document.getElementById('modal-cloak-anchor');
  const modalPlayerAnchor = document.getElementById('modal-player-anchor');

  // Utility Elements
  const toastEl = document.getElementById('toast');
  const themeToggle = document.getElementById('theme-toggle');
  const camouflageBtn = document.getElementById('camouflage-btn');
  const decoyView = document.getElementById('decoy-view');
  const decoyExitBtn = document.getElementById('decoy-exit-btn');
  const copyLayer1Btn = document.getElementById('copy-layer1-btn');
  const copyLayer2Btn = document.getElementById('copy-layer2-btn');
  const copyAllCloakBtn = document.getElementById('copy-all-cloak');

  // ── Session Auto-Lock Inactivity Timer ──
  // Hmph! I'm automatically locking this after 15 minutes so nobody peeks over your shoulder!
  let sessionRemaining = 900; // 15 minutes
  let sessionInterval = null;
  let lastActivityTimestamp = Date.now();

  function updateTimerDisplay() {
    if (!sessionTimerEl) return;
    if (VIDEO_DATA.length === 0) {
      sessionTimerEl.textContent = '⏱️ Locked';
      return;
    }
    const mins = Math.floor(sessionRemaining / 60);
    const secs = sessionRemaining % 60;
    sessionTimerEl.textContent = `⏱️ ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function startSessionTimer() {
    if (sessionInterval) clearInterval(sessionInterval);
    sessionRemaining = 900;
    updateTimerDisplay();
    sessionInterval = setInterval(() => {
      sessionRemaining--;
      updateTimerDisplay();
      if (sessionRemaining <= 0) {
        clearInterval(sessionInterval);
        sessionInterval = null;
        lockVault();
        showToast('Session timed out. Vault locked.');
      }
    }, 1000);
  }

  function stopSessionTimer() {
    if (sessionInterval) {
      clearInterval(sessionInterval);
      sessionInterval = null;
    }
    updateTimerDisplay();
  }

  function onUserActivity() {
    if (VIDEO_DATA.length === 0) return;
    const now = Date.now();
    if (now - lastActivityTimestamp > 1000) {
      lastActivityTimestamp = now;
      sessionRemaining = 900;
      updateTimerDisplay();
    }
  }

  ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach((evt) => {
    window.addEventListener(evt, onUserActivity, { passive: true });
  });

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
      // When served through the phone relay (not GitHub Pages), keep navigation on the
      // same origin so local-disk videos resolve to the relay's /media/ path.
      if (location.protocol.startsWith('http') && !location.hostname.endsWith('github.io')) {
        const ghPlayer = 'https://jidiotspam-hue.github.io/understory/player.html';
        VIDEO_DATA.forEach((v) => {
          if (v.playerUrl && v.playerUrl.startsWith(ghPlayer)) {
            v.playerUrl = 'player.html' + v.playerUrl.slice(ghPlayer.length);
          }
        });
      }
      sessionStorage.setItem('understory_session_pass', passphrase);

      vaultLockedView.hidden = true;
      vaultUnlockedView.hidden = false;
      statusLine.textContent = 'Decrypted in memory • Zero-knowledge protection';

      const bannerKeysInfo = document.getElementById('banner-keys-info');
      if (bannerKeysInfo && VIDEO_DATA.length > 0) {
        bannerKeysInfo.innerHTML = `Outer: <code>${VIDEO_DATA[0].layer1Key}</code> ➔ Inner: <code>${VIDEO_DATA[0].layer2Key}</code>`;
      }

      // Clean hash if pass was passed in URL
      if (location.hash.includes('pass=')) {
        history.replaceState(null, '', location.pathname);
      }

      updateFilterCounts();
      render();
      startSessionTimer();
      startRelayWatch();
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
    stopRelayWatch();
    stopSessionTimer();
    vaultUnlockedView.hidden = true;
    vaultLockedView.hidden = false;
    vaultPassInput.value = '';
    statusLine.textContent = 'A quiet, earthy archive. Built incognito-first.';
    showToast('Vault locked and memory cleared');
  }

  const vaultUnlockForm = document.getElementById('vault-unlock-form');
  if (vaultUnlockForm) {
    vaultUnlockForm.addEventListener('submit', (e) => {
      e.preventDefault();
      attemptUnlock(vaultPassInput.value.trim());
    });
  }

  vaultUnlockBtn.addEventListener('click', () => {
    attemptUnlock(vaultPassInput.value.trim());
  });

  vaultPassInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') attemptUnlock(vaultPassInput.value.trim());
  });

  // Automatically attempt unlock when Touch ID autofills the field
  vaultPassInput.addEventListener('change', () => {
    const val = vaultPassInput.value.trim();
    if (val.length > 0) attemptUnlock(val);
  });

  lockVaultBtn.addEventListener('click', lockVault);

  const phoneRelayBtn = document.getElementById('phone-relay-btn');
  if (phoneRelayBtn) {
    phoneRelayBtn.addEventListener('click', () => {
      if (relayBase) {
        showToast('Relay online. Disk videos open on your Mac relay.', 3500);
      } else if (onGithubPages) {
        showToast('Relay offline: ' + (relayWhy || 'checking…') + '. Rechecking now.', 7000);
        resolveRelay();
      } else {
        showToast('You are on the relay itself.', 3000);
      }
    });
  }

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
    const franchiseKeys = [
      'all', 'quintuplets', 'demon-slayer', 'chainsaw-man', 're-zero',
      'horimiya', '100-kanojo', 'overflow', 'roshidere', 'tomo-chan',
      'frieren', 'jujutsu-kaisen', 'fruit-of-evolution', 'dress-up-darling',
      'spy-x-family', 'nier-automata', 'curated', 'nubiles'
    ];

    franchiseKeys.forEach((key) => {
      const count = key === 'all'
        ? VIDEO_DATA.length
        : VIDEO_DATA.filter((v) => v.franchise === key).length;
      const el = document.getElementById(`count-${key}`);
      if (el) el.textContent = count;
    });

    const favCountEl = document.getElementById('count-favorites');
    if (favCountEl) {
      favCountEl.textContent = favorites.length;
    }

    const typeKeys = [
      'all', '3d-animation', '2d-anime', 'compilation', 'ensemble', 'solo', 'portal', 'nubiles-exclusive'
    ];

    typeKeys.forEach((key) => {
      const count = key === 'all'
        ? VIDEO_DATA.length
        : VIDEO_DATA.filter((v) => v.type === key).length;
      const el = document.getElementById(`type-count-${key}`);
      if (el) el.textContent = count;
    });
  }

  // ── Favorites State Management ──
  function toggleFavorite(id) {
    const idx = favorites.indexOf(id);
    const added = idx === -1;
    if (added) {
      favorites.push(id);
    } else {
      favorites.splice(idx, 1);
    }
    try {
      localStorage.setItem('understory_favorites', JSON.stringify(favorites));
    } catch (e) {}

    updateFilterCounts();
    if (activeFilter === 'favorites') {
      render();
    } else {
      const btns = document.querySelectorAll(`.star-btn[data-fav-id="${id}"]`);
      btns.forEach((btn) => {
        btn.classList.toggle('starred', added);
        btn.textContent = added ? '★' : '☆';
        btn.title = added ? 'Remove from favorites' : 'Add to favorites';
      });
    }
    showToast(added ? 'Added to favorites ⭐' : 'Removed from favorites');
  }

  // ── Filter & Search Logic with Sorting ──
  function getFilteredVideos() {
    const filtered = VIDEO_DATA.filter((v) => {
      if (activeFilter === 'favorites') {
        if (!favorites.includes(v.id)) return false;
      } else if (activeFilter !== 'all' && v.franchise !== activeFilter) {
        return false;
      }

      const matchesType =
        activeTypeFilter === 'all' || v.type === activeTypeFilter;
      if (!matchesType) return false;

      if (!searchQuery) return true;

      const words = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
      const searchable = [
        v.title,
        v.fullTitle,
        v.franchiseName,
        v.typeName || '',
        v.userTag,
        ...v.characters,
        ...v.badges
      ].join(' ').toLowerCase();

      return words.every((w) => searchable.includes(w));
    });

    const list = [...filtered];
    if (sortMode === 'top-picks') {
      list.sort((a, b) => {
        const aFav = favorites.includes(a.id) ? 1 : 0;
        const bFav = favorites.includes(b.id) ? 1 : 0;
        if (aFav !== bFav) return bFav - aFav;
        const aTop = (a.userTag.includes('Top') || a.badges.some((bg) => bg.includes('Top') || bg.includes('Peh-Koi'))) ? 1 : 0;
        const bTop = (b.userTag.includes('Top') || b.badges.some((bg) => bg.includes('Top') || bg.includes('Peh-Koi'))) ? 1 : 0;
        if (aTop !== bTop) return bTop - aTop;
        return 0;
      });
    } else if (sortMode === 'title-asc') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortMode === 'franchise') {
      list.sort((a, b) => a.franchiseName.localeCompare(b.franchiseName) || a.title.localeCompare(b.title));
    }

    return list;
  }

  // ── Phone Relay Auto-Discovery ──
  // relay.json holds the relay's current tunnel URL, encrypted with the vault
  // passphrase. After unlock we decrypt it, ping it, and (if alive) send
  // local-disk titles to the player on the relay's own origin.
  const RELAY_RAW = 'https://raw.githubusercontent.com/jidiotspam-hue/understory/main/relay.json';
  let relayBase = null;
  let relayTimer = null;
  let relayWhy = '';
  const onGithubPages = location.hostname.endsWith('github.io');

  function setRelayUI(state) {
    const btn = document.getElementById('phone-relay-btn');
    if (!btn) return;
    const labels = { online: '📱 Relay: Online', offline: '📱 Relay: Offline', checking: '📱 Relay: …' };
    btn.textContent = labels[state] || labels.offline;
    btn.classList.toggle('act-strong', state === 'online');
  }

  async function fetchRelayBlob() {
    const bust = `?t=${Date.now()}`;
    for (const url of [RELAY_RAW + bust, 'relay.json' + bust]) {
      try {
        const r = await fetch(url, { cache: 'no-store' });
        if (r.ok) return (await r.json()).relay;
      } catch (e) { /* try next source */ }
    }
    return null;
  }

  async function resolveRelay() {
    if (!onGithubPages || VIDEO_DATA.length === 0) return;
    const pass = sessionStorage.getItem('understory_session_pass');
    if (!pass) return;
    const before = relayBase;
    let next = null;
    relayWhy = 'could not load relay.json';
    try {
      const blob = await fetchRelayBlob();
      if (blob) {
        relayWhy = 'relay.json unreadable (wrong passphrase?)';
        const info = await decryptVault(blob, pass);
        relayWhy = 'Mac relay is marked offline';
        if (info && info.url) {
          relayWhy = 'cannot reach ' + new URL(info.url).hostname + ' (blocked by network/extension, or tunnel down)';
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 10000);
          try {
            const res = await fetch(info.url + 'ping', { cache: 'no-store', signal: ctrl.signal });
            if (res.ok) { next = info.url; relayWhy = ''; }
          } finally {
            clearTimeout(t);
          }
        }
      }
    } catch (e) { next = null; }
    relayBase = next;
    setRelayUI(next ? 'online' : 'offline');
    if (before !== next && VIDEO_DATA.length) {
      render();
      showToast(next ? 'Phone relay connected — disk videos will play' : 'Phone relay offline');
    }
  }

  function startRelayWatch() {
    if (!onGithubPages) return;
    stopRelayWatch();
    setRelayUI('checking');
    resolveRelay();
    relayTimer = setInterval(resolveRelay, 45000);
  }

  function stopRelayWatch() {
    if (relayTimer) clearInterval(relayTimer);
    relayTimer = null;
    relayBase = null;
  }

  function getPlayerHref(item) {
    if (relayBase && item.directUrl && item.directUrl.startsWith('file://')) {
      const i = item.playerUrl.indexOf('#v=');
      if (i !== -1) return relayBase + 'player.html' + item.playerUrl.slice(i);
    }
    return item.playerUrl;
  }

  function renderCardHtml(item) {
    const isFav = favorites.includes(item.id);
    const badgesHtml = item.badges
      .map((b) => {
        let cls = 'badge';
        const bl = b.toLowerCase();
        if (bl.includes('peh-koi') || bl.includes('studio') || bl.includes('master')) cls += ' badge-studio';
        else if (bl.includes('pov')) cls += ' badge-pov';
        else if (bl.includes('decensored') || bl.includes('uncensored')) cls += ' badge-decensored';
        else if (bl.includes('3d')) cls += ' badge-3d';
        else if (bl.includes('4k') || bl.includes('hd') || bl.includes('1080p') || bl.includes('60fps')) cls += ' badge-quality';
        return `<span class="${cls}">${b}</span>`;
      })
      .join('');

    return `
    <article class="video-card" data-id="${item.id}">
      <div class="card-header">
        <div class="card-topline">
          <span class="card-franchise">${item.franchiseName}</span>
          <div style="display:inline-flex;align-items:center;gap:6px;">
            <span class="badge" style="background:var(--terracotta);color:#fff;font-weight:600;">${item.typeName || 'Feature'}</span>
            <button class="star-btn ${isFav ? 'starred' : ''}" data-fav-id="${item.id}" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}" aria-label="Toggle favorite">
              ${isFav ? '★' : '☆'}
            </button>
          </div>
        </div>
        <h2 class="card-title">${item.title}</h2>
        <p class="card-meta">
          <strong>${item.characters.join(', ')}</strong> • <em>${item.userTag}</em>
        </p>
        ${item.description ? `<p class="card-desc">${item.description}</p>` : ''}
        <div class="card-keys-row">
          <span class="key-badge" data-key="${item.layer1Key}" title="Click to copy Layer 1 Key">
            <strong>L1:</strong> ${item.layer1Key}
          </span>
          <span class="key-badge" data-key="${item.layer2Key}" title="Click to copy Layer 2 Key (tqq)">
            <strong>L2:</strong> ${item.layer2Key}
          </span>
        </div>
        <div class="badges-row">
          ${badgesHtml}
        </div>
      </div>

      <div class="card-actions">
        <div class="card-primary-acts">
          <a href="${getPlayerHref(item)}" target="_blank" rel="noreferrer noopener" class="btn-player-primary" title="Launch Built-in 4K Studio Player">
            <span>▶</span> Launch 4K Studio Player
          </a>
        </div>
        <button class="btn-cloak" data-id="${item.id}" title="Copy 2-Layer Cloaked URL">
          <span>🔒</span> Copy Cloak
        </button>
        <div class="card-sub-acts">
          <button class="act" data-action="details" data-id="${item.id}">Keys</button>
          <a href="${item.cloakUrl}" target="_blank" rel="noreferrer noopener" class="act act-accent" title="Open 2-Layer Cloak decryptor">Cloak ↗</a>
        </div>
      </div>
    </article>
    `;
  }

  const TYPE_META = {
    '3d-animation': { name: '3D Animation', icon: '🎬' },
    '2d-anime': { name: '2D Anime', icon: '🎨' },
    'compilation': { name: 'Compilations & Anthologies', icon: '📚' },
    'ensemble': { name: 'Duos & Ensembles', icon: '👥' },
    'solo': { name: 'Solo Features', icon: '⭐' },
    'portal': { name: 'Archive Portals', icon: '🏛️' },
    'nubiles-exclusive': { name: 'Nubiles 4K Exclusives', icon: '💎' }
  };

  // ── Render Cards & Sub-Sections ──
  function render() {
    const list = getFilteredVideos();
    resultsCount.textContent = `${list.length} ${list.length === 1 ? 'title' : 'titles'} found`;

    if (list.length === 0) {
      cardsContainer.innerHTML = `
        <div style="text-align: center; padding: 48px 16px; color: var(--muted);">
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
          activeTypeFilter = 'all';
          updateFilterChipUI();
          render();
        });
      }
      return;
    }

    if (activeGroupMode === 'type') {
      const typeOrder = ['nubiles-exclusive', '3d-animation', '2d-anime', 'compilation', 'ensemble', 'solo', 'portal'];
      const presentTypes = Array.from(new Set(list.map((v) => v.type)));
      const allTypes = [...typeOrder, ...presentTypes.filter((t) => !typeOrder.includes(t))];
      let html = '';
      allTypes.forEach((typeKey) => {
        const groupItems = list.filter((v) => v.type === typeKey);
        if (groupItems.length === 0) return;
        const meta = TYPE_META[typeKey] || { name: typeKey, icon: '📁' };
        html += `
          <section class="section-group">
            <div class="section-head">
              <div class="section-head-left">
                <span class="section-icon">${meta.icon}</span>
                <h3 class="section-title">${meta.name}</h3>
              </div>
              <span class="section-count-badge">${groupItems.length} ${groupItems.length === 1 ? 'title' : 'titles'}</span>
            </div>
            <div class="cards-grid">
              ${groupItems.map(renderCardHtml).join('')}
            </div>
          </section>
        `;
      });
      cardsContainer.innerHTML = html;
    } else if (activeGroupMode === 'franchise') {
      const groups = {};
      list.forEach((v) => {
        if (!groups[v.franchiseName]) groups[v.franchiseName] = [];
        groups[v.franchiseName].push(v);
      });
      let html = '';
      Object.keys(groups).sort().forEach((fName) => {
        const gItems = groups[fName];
        html += `
          <section class="section-group">
            <div class="section-head">
              <div class="section-head-left">
                <span class="section-icon">🏷️</span>
                <h3 class="section-title">${fName}</h3>
              </div>
              <span class="section-count-badge">${gItems.length} ${gItems.length === 1 ? 'title' : 'titles'}</span>
            </div>
            <div class="cards-grid">
              ${gItems.map(renderCardHtml).join('')}
            </div>
          </section>
        `;
      });
      cardsContainer.innerHTML = html;
    } else {
      cardsContainer.innerHTML = `
        <div class="cards-grid">
          ${list.map(renderCardHtml).join('')}
        </div>
      `;
    }

    // Attach card action listeners
    attachCardListeners();
  }

  function attachCardListeners() {
    // Key badges: 1-click copy key
    cardsContainer.querySelectorAll('.key-badge').forEach((badge) => {
      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = badge.getAttribute('data-key');
        if (key) {
          copyToClipboard(key, `Copied passphrase: ${key}`);
        }
      });
    });

    // Copy 2-Layer Cloaked URL button
    cardsContainer.querySelectorAll('.btn-cloak').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const item = VIDEO_DATA.find((v) => v.id === id);
        if (!item) return;

        const originalText = btn.innerHTML;
        btn.innerHTML = `<span>✓</span> Copied!`;
        btn.style.borderColor = 'var(--moss)';

        await copyToClipboard(
          item.cloakUrl,
          `2-Layer Cloaked URL copied! (L1: ${item.layer1Key} ➔ L2: ${item.layer2Key})`
        );

        setTimeout(() => {
          btn.innerHTML = originalText;
          btn.style.borderColor = '';
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

    // Favorite Star button
    cardsContainer.querySelectorAll('.star-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-fav-id');
        if (id) toggleFavorite(id);
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

    if (modalLayer1Key) modalLayer1Key.textContent = item.layer1Key;
    if (modalLayer2Key) modalLayer2Key.textContent = item.layer2Key;
    if (modalPlayerAnchor) modalPlayerAnchor.href = item.playerUrl;
    if (modalCloakAnchor) modalCloakAnchor.href = item.cloakUrl;
    const modalCloakSub = document.getElementById('modal-cloak-sub');
    if (modalCloakSub) {
      modalCloakSub.textContent = `Encrypted URL (L1: ${item.layer1Key} ➔ L2: ${item.layer2Key})`;
    }

    shieldDialog.showModal();
  }

  if (modalLayer1Key) {
    modalLayer1Key.addEventListener('click', () => {
      if (selectedVideo && selectedVideo.layer1Key) {
        copyToClipboard(selectedVideo.layer1Key, `Layer 1 key copied: ${selectedVideo.layer1Key}`);
      }
    });
  }

  if (modalLayer2Key) {
    modalLayer2Key.addEventListener('click', () => {
      if (selectedVideo && selectedVideo.layer2Key) {
        copyToClipboard(selectedVideo.layer2Key, `Layer 2 key copied: ${selectedVideo.layer2Key}`);
      }
    });
  }

  modalCloseBtn.addEventListener('click', () => {
    shieldDialog.close();
  });

  shieldDialog.addEventListener('click', (e) => {
    if (e.target === shieldDialog) shieldDialog.close();
  });

  modalCopyCloakBtn.addEventListener('click', () => {
    if (!selectedVideo) return;
    copyToClipboard(
      selectedVideo.cloakUrl,
      `2-Layer Cloaked URL copied! (L1: ${selectedVideo.layer1Key} ➔ L2: ${selectedVideo.layer2Key})`
    );
  });

  // ── Quick Jump Character Bar ──
  function syncQuickTags() {
    if (!characterQuickBar) return;
    characterQuickBar.querySelectorAll('.quick-tag').forEach((b) => {
      const tag = b.getAttribute('data-tag').toLowerCase();
      b.classList.toggle('active', !!searchQuery && searchQuery.toLowerCase().includes(tag));
    });
  }

  if (characterQuickBar) {
    characterQuickBar.querySelectorAll('.quick-tag').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tag = btn.getAttribute('data-tag');
        if (searchQuery.toLowerCase() === tag.toLowerCase()) {
          searchQuery = '';
          searchInput.value = '';
          clearSearchBtn.hidden = true;
          btn.classList.remove('active');
        } else {
          searchQuery = tag;
          searchInput.value = tag;
          clearSearchBtn.hidden = false;
          characterQuickBar.querySelectorAll('.quick-tag').forEach((b) => b.classList.toggle('active', b === btn));
        }
        render();
      });
    });
  }

  // ── Sort Control ──
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      sortMode = e.target.value;
      render();
    });
  }

  // ── Global Search & Filters ──
  let searchRafId = null;
  searchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (searchRafId) cancelAnimationFrame(searchRafId);
    searchRafId = requestAnimationFrame(() => {
      searchQuery = val;
      clearSearchBtn.hidden = !searchQuery;
      syncQuickTags();
      render();
    });
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.hidden = true;
    syncQuickTags();
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

  typeFilterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      activeTypeFilter = chip.getAttribute('data-type');
      updateFilterChipUI();
      render();
    });
  });

  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      activeGroupMode = btn.getAttribute('data-mode');
      modeButtons.forEach((b) => b.classList.toggle('active', b === btn));
      render();
    });
  });

  function updateFilterChipUI() {
    filterChips.forEach((c) => {
      c.classList.toggle('active', c.getAttribute('data-filter') === activeFilter);
    });
    typeFilterChips.forEach((c) => {
      c.classList.toggle('active', c.getAttribute('data-type') === activeTypeFilter);
    });
  }

  // ── Batch Copy Actions ──
  if (copyLayer1Btn) {
    copyLayer1Btn.addEventListener('click', () => {
      const key = VIDEO_DATA[0]?.layer1Key;
      if (key) {
        copyToClipboard(key, `Layer 1 Key copied: ${key}`);
      } else {
        showToast('Vault must be unlocked first');
      }
    });
  }

  if (copyLayer2Btn) {
    copyLayer2Btn.addEventListener('click', () => {
      const key = VIDEO_DATA[0]?.layer2Key;
      if (key) {
        copyToClipboard(key, `Layer 2 Key copied: ${key}`);
      } else {
        showToast('Vault must be unlocked first');
      }
    });
  }

  if (copyAllCloakBtn) {
    copyAllCloakBtn.addEventListener('click', () => {
      const filtered = getFilteredVideos();
      const text = filtered
        .map((v) => `# ${v.title} (${v.franchiseName})\n${v.cloakUrl}`)
        .join('\n\n');
      copyToClipboard(
        text,
        `Copied all ${filtered.length} 2-Layer Cloaked URLs!`
      );
    });
  }

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
