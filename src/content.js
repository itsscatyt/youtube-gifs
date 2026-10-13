(() => {
  if (globalThis.gcfyLoaded) return;
  globalThis.gcfyLoaded = true;

  const BOX_SCOPE = 'ytd-comment-simplebox-renderer, ytd-comment-thread-renderer';
  const POST_DIALOG = 'ytd-backstage-post-dialog-renderer';
  const PICKER_W = 340;
  const PICKER_H = 420;
  const SEARCH_DEBOUNCE_MS = 350;
  const ARM_TIMEOUT_MS = 1500;
  const AUTO_SUBMIT_GRACE_MS = 4000;
  const RESULT_TIMEOUT_MS = 20000;
  const NO_FAVORITES = 'No favorites yet. Point at a GIF and click its star.';
  const THEME_STYLE_ID = 'tenor-gif-toolkit-youtube-theme';

  async function applyYoutubeTheme() {
    try {
      const { youtubeTheme = {} } = await chrome.storage.local.get('youtubeTheme');
      const c = (k, d) => safeColor(youtubeTheme[k], d);
      const accent=c('accent','#7c3aed'), page=c('page','#0f0f0f'), surface=c('surface','#18181b');
      const text=c('text','#f1f1f1'), secondary=c('secondaryText','#aaaaaa'), border=c('border','#383838');
      const title=c('title','#f1f1f1'), comments=c('commentsText','#f1f1f1');
      const preview=c('preview','#18181b'), outline=c('outline','#a855f7');
      const radius=Math.max(0,Math.min(28,Number(youtubeTheme.radius ?? 12)));
      let style=document.getElementById('tenor-gif-toolkit-youtube-theme');
      if(!style){style=document.createElement('style');style.id='tenor-gif-toolkit-youtube-theme';(document.head||document.documentElement).appendChild(style);}
      style.textContent=`
        :root{--tgt-accent:${accent};--tgt-page:${page};--tgt-surface:${surface};--tgt-text:${text};--tgt-secondary:${secondary};--tgt-border:${border};--tgt-title:${title};--tgt-comments:${comments};--tgt-preview:${preview};--tgt-outline:${outline};--tgt-radius:${radius}px}
        html,body,ytd-app,#content,ytd-page-manager,ytd-browse,ytd-watch-flexy,ytd-search,ytd-two-column-browse-results-renderer,ytd-rich-grid-renderer{background-color:var(--tgt-page)!important;color:var(--tgt-text)!important}
        ytd-rich-item-renderer,ytd-video-renderer,ytd-compact-video-renderer,ytd-grid-video-renderer,ytd-comment-thread-renderer,ytd-comment-view-model,ytd-comments,#comments,ytd-guide-renderer,ytd-mini-guide-renderer,ytd-masthead,#masthead-container,ytd-rich-section-renderer,ytd-rich-shelf-renderer{color:var(--tgt-text)!important;border-color:var(--tgt-border)!important}
        #video-title,yt-formatted-string#video-title,h1,#title,.title,ytd-watch-metadata{color:var(--tgt-title)!important}
        #content-text,#content-text *,#author-text,#author-text *,ytd-comment-view-model #content-text,yt-attributed-string,ytd-comment-thread-renderer yt-formatted-string{color:var(--tgt-comments)!important}
        #metadata-line,#byline,#subtitle,.ytd-video-meta-block,#published-time-text,#vote-count-middle,#count,#secondary,ytd-video-meta-block,#channel-name,#owner-sub-count{color:var(--tgt-secondary)!important}
        ytd-rich-item-renderer ytd-thumbnail,ytd-video-renderer ytd-thumbnail,ytd-compact-video-renderer ytd-thumbnail,ytd-grid-video-renderer ytd-thumbnail{background-color:var(--tgt-preview)!important;border-radius:var(--tgt-radius)!important;overflow:hidden!important;outline:1px solid var(--tgt-outline)!important;outline-offset:1px}
        ytd-player,#movie_player,.html5-video-container{background-color:var(--tgt-preview)!important}
        ytd-searchbox,#search-form,ytd-searchbox #container{background-color:var(--tgt-surface)!important;border-color:var(--tgt-border)!important}
        a#video-title:hover,yt-formatted-string#video-title:hover,#author-text:hover{color:var(--tgt-accent)!important}
        #movie_player:focus-within,ytd-player:focus-within{outline:2px solid var(--tgt-accent)!important;outline-offset:2px}
        ${youtubeTheme.pickerAccent !== false ? `.gcfy-btn:focus-visible{outline-color:${accent}!important}` : ''}
      `;
    } catch(e) {}
  }
  function safeColor(value, fallback) {
    return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
  }
  applyYoutubeTheme();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.youtubeTheme) applyYoutubeTheme();
  });

  const PICKER_CSS = `
    :host { all: initial; position: fixed; z-index: 2147483647; }
    .panel {
      --bg: #fff; --fg: #0f0f0f; --muted: #606060; --line: rgba(0,0,0,.12); --field: rgba(0,0,0,.05); --accent: #065fd4; --err: #c00;
      --thumb: rgba(0,0,0,.25); --thumb-hover: rgba(0,0,0,.45);
      box-sizing: border-box; display: flex; flex-direction: column;
      width: ${PICKER_W}px; background: var(--bg); color: var(--fg);
      border: 1px solid var(--line); border-radius: 12px; overflow: hidden;
      box-shadow: 0 8px 28px rgba(0,0,0,.35);
      font: 13px/1.4 Roboto, Arial, sans-serif;
    }
    .panel[data-dark] {
      --bg: #212121; --fg: #f1f1f1; --muted: #aaa; --line: rgba(255,255,255,.14); --field: rgba(255,255,255,.08); --accent: #3ea6ff; --err: #ff7b7b;
      --thumb: rgba(255,255,255,.25); --thumb-hover: rgba(255,255,255,.45);
    }
    .search { flex: none; display: flex; gap: 6px; padding: 8px; border-bottom: 1px solid var(--line); }
    input {
      box-sizing: border-box; flex: 1; min-width: 0; height: 34px; padding: 0 12px;
      border: 1px solid transparent; border-radius: 17px; outline: none;
      background: var(--field); color: var(--fg); font: inherit;
    }
    input:focus { border-color: var(--accent); }
    input::placeholder { color: var(--muted); }
    .fav-tab {
      flex: none; width: 34px; height: 34px; padding: 0; border: 0; border-radius: 50%;
      background: var(--field); color: var(--muted); font: 16px/1 Arial, sans-serif; cursor: pointer;
    }
    .fav-tab[aria-pressed="true"] { background: var(--accent); color: var(--bg); }
    .custom-tab { flex:none; min-width:34px; height:34px; padding:0 8px; border:0; border-radius:17px; background:var(--field); color:var(--muted); font:12px Arial,sans-serif; cursor:pointer; }
    .custom-tab[aria-pressed="true"] { background:var(--accent); color:var(--bg); }
    .add-custom { flex:none; width:34px; height:34px; padding:0; border:0; border-radius:50%; background:var(--field); color:var(--fg); font:22px/1 Arial,sans-serif; cursor:pointer; }
    .settings-tab { flex:none; width:34px; height:34px; padding:0; border:0; border-radius:50%; background:var(--field); color:var(--fg); font:17px/1 Arial,sans-serif; cursor:pointer; }
    .remove-custom { position:absolute; top:4px; left:4px; width:24px; height:24px; border:0; border-radius:50%; background:rgba(180,0,0,.85); color:#fff; cursor:pointer; font:16px/1 Arial,sans-serif; display:none; }
    .panel[data-custom] .remove-custom { display:block; }
    .fav-tab:focus-visible, .star:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
    .status { flex: none; padding: 6px 12px 0; color: var(--muted); }
    .status:empty { display: none; }
    .status[data-kind="error"] { color: var(--err); }
    .grid {
      flex: 1; min-height: 0; overflow-x: hidden; overflow-y: auto; padding: 8px 2px 8px 8px;
      display: flex; align-items: flex-start; gap: 6px;
      scrollbar-gutter: stable;
    }
    /* Slim rounded scrollbar: a 6px thumb inside a 12px transparent track. */
    .grid::-webkit-scrollbar { width: 12px; }
    .grid::-webkit-scrollbar-track { background: transparent; }
    .grid::-webkit-scrollbar-thumb {
      border: 3px solid transparent; border-radius: 6px;
      background: var(--thumb); background-clip: content-box;
    }
    .grid::-webkit-scrollbar-thumb:hover { background: var(--thumb-hover); background-clip: content-box; }
    @supports not selector(::-webkit-scrollbar) {
      .grid { scrollbar-width: thin; scrollbar-color: var(--thumb) transparent; padding-right: 8px; }
    }
    .col { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
    .tile {
      display: block; width: 100%; margin: 0; padding: 0; border: 0; border-radius: 8px;
      overflow: hidden; background: var(--field); cursor: pointer;
    }
    .tile:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
    .tile:hover img { opacity: .82; }
    .tile img { display: block; width: 100%; height: auto; }
    /* The star is the tile's sibling, not its child: a button cannot hold another button. */
    .cell { position: relative; }
    .star {
      position: absolute; top: 4px; right: 4px; width: 26px; height: 26px; padding: 0; border: 0; border-radius: 50%;
      background: rgba(0,0,0,.6); color: #fff; font: 16px/1 Arial, sans-serif; cursor: pointer; opacity: 0;
    }
    .cell:hover .star, .star:focus-visible, .star[aria-pressed="true"] { opacity: 1; }
    .star[aria-pressed="true"] { color: #ffd45c; }
    .panel[data-busy] .cell { pointer-events: none; opacity: .45; }
  `;

  const fromMain = new Map();

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.origin !== location.origin) return;
    const msg = e.data;
    if (!msg || msg.gcfy !== 'to-content' || typeof msg.nonce !== 'string') return;
    const cb = fromMain.get(msg.nonce);
    if (cb) cb(msg);
  });

  const toMain = (msg) => window.postMessage({ gcfy: 'to-main', ...msg }, location.origin);

  function newNonce() {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  }


  function addButton(box) {
    if (box.querySelector('.gcfy-btn')) return;
    if (!box.closest(BOX_SCOPE) || box.closest(POST_DIALOG)) return;
    const footer = box.querySelector('#footer');
    if (!footer) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gcfy-btn';
    btn.title = 'Add a GIF';
    btn.setAttribute('aria-label', 'Add a GIF');
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (picker.open && picker.anchor === btn) closePicker();
      else openPicker(btn, box);
    });
        footer.append(btn);
  }

  let scanQueued = false;
  function scan() {
    scanQueued = false;
    for (const box of document.querySelectorAll('ytd-commentbox')) addButton(box);
  }
  new MutationObserver(() => {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(scan);
  }).observe(document.documentElement, { childList: true, subtree: true });
  scan();

  const picker = { open: false, busy: false, host: null, anchor: null, box: null, els: null, seq: 0, timer: 0, gifs: [], nonce: null, favorites: [], customGifs: [], showingFavorites: false, showingCustom: false };

  function buildPicker() {
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = PICKER_CSS;

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Choose a GIF');

    const search = document.createElement('div');
    search.className = 'search';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Search Tenor or paste a Tenor link';
    input.setAttribute('aria-label', 'Search Tenor or paste a Tenor link');
    input.autocomplete = 'off';
    input.spellcheck = false;
    const customTab = document.createElement('button');
    customTab.type = 'button';
    customTab.className = 'custom-tab';
    customTab.textContent = 'My GIFs';
    customTab.title = 'Your custom GIF collection';
    customTab.setAttribute('aria-pressed', 'false');
    const settingsTab = document.createElement('button');
    settingsTab.type = 'button';
    settingsTab.className = 'settings-tab';
    settingsTab.textContent = '⚙';
    settingsTab.title = 'Settings: customize YouTube colors';
    settingsTab.setAttribute('aria-label', 'Customize YouTube colors');
    settingsTab.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'openOptions' }, (response) => {
        if (chrome.runtime.lastError || !response || !response.ok) {          const url = chrome.runtime.getURL('settings.html');
          window.open(url, '_blank', 'noopener');
        }
      });
    });
    const addCustom = document.createElement('button');
    addCustom.type = 'button';
    addCustom.className = 'add-custom';
    addCustom.textContent = '+';
    addCustom.title = 'Add a GIF to My GIFs';
    addCustom.setAttribute('aria-label', 'Add a GIF to My GIFs');
    const favTab = document.createElement('button');
    favTab.type = 'button';
    favTab.className = 'fav-tab';
    favTab.textContent = '★';
    favTab.title = 'Favorites';
    favTab.setAttribute('aria-label', 'Favorites');
    favTab.setAttribute('aria-pressed', 'false');
    search.append(input, customTab, addCustom, favTab, settingsTab);

    const status = document.createElement('div');
    status.className = 'status';
    status.setAttribute('role', 'status');

    const grid = document.createElement('div');
    grid.className = 'grid';

    panel.append(search, status, grid);
    root.append(style, panel);

    input.addEventListener('input', () => {
      clearTimeout(picker.timer);
      picker.timer = setTimeout(() => load(input.value), SEARCH_DEBOUNCE_MS);
    });
    customTab.addEventListener('click', () => {
      clearTimeout(picker.timer);
      picker.seq++;
      setCustomView(!picker.showingCustom);
      if (picker.showingCustom) renderCustom(false);
      else load(input.value);
    });
    addCustom.addEventListener('click', addCustomGif);
    favTab.addEventListener('click', () => {
      if (picker.showingFavorites) { load(input.value); return; }
      clearTimeout(picker.timer);
      picker.seq++;
      setFavoritesView(true);
      renderFavorites(false);
    });
    grid.addEventListener('click', (e) => {
      const remove = e.target.closest('.remove-custom');
      const star = e.target.closest('.star');
      const tile = e.target.closest('.tile');
      if (remove) removeCustomGif(picker.gifs[Number(remove.dataset.index)]);
      else if (star) toggleFavorite(picker.gifs[Number(star.dataset.index)]);
      else if (tile && !picker.busy) send(picker.gifs[Number(tile.dataset.index)]);
    });

    picker.host = host;
    picker.els = { panel, input, status, grid, favTab, customTab, addCustom };
  }

  function setStatus(text, kind) {
    picker.els.status.textContent = text || '';
    if (kind) picker.els.status.dataset.kind = kind;
    else delete picker.els.status.dataset.kind;
  }

  function setBusy(busy) {
    picker.busy = busy;
    picker.els.panel.toggleAttribute('data-busy', busy);
  }

  function place() {
    if (!picker.open) return;
    if (!picker.anchor.isConnected) { closePicker(); return; }
    const r = picker.anchor.getBoundingClientRect();
    const h = Math.min(PICKER_H, innerHeight - 16);
    picker.els.panel.style.height = `${h}px`;
    let top = r.top - h - 8;
    if (top < 8) top = Math.min(r.bottom + 8, innerHeight - h - 8);
    const left = Math.min(Math.max(8, r.right - PICKER_W), innerWidth - PICKER_W - 8);
    picker.host.style.top = `${Math.max(8, top)}px`;
    picker.host.style.left = `${Math.max(8, left)}px`;
  }

  function openPicker(anchor, box) {
    if (!picker.host) buildPicker();
    if (picker.open) closePicker();
    picker.open = true;
    picker.anchor = anchor;
    picker.box = box;
    anchor.setAttribute('aria-expanded', 'true');
    picker.els.panel.toggleAttribute('data-dark', document.documentElement.hasAttribute('dark'));
    document.documentElement.append(picker.host);
    setBusy(false);
    place();
    picker.els.input.focus();
    load(picker.els.input.value);
  }

  function closePicker() {
    if (!picker.open) return;
    picker.open = false;
    clearTimeout(picker.timer);
    picker.seq++;
    picker.anchor.setAttribute('aria-expanded', 'false');
    picker.host.remove();
    if (picker.anchor.isConnected && !picker.busy) picker.anchor.focus();
  }

  const looksLikeLink = (text) => /^\d{6,20}$/.test(text) || /^(https?:\/\/)?([\w-]+\.)*tenor\.com\//i.test(text);

  async function load(raw) {
    const text = raw.trim();
    const seq = ++picker.seq;
    setFavoritesView(false);
    setCustomView(false);
    setStatus(text ? 'Searching…' : 'Loading…');
    let reply;
    try {
      reply = await chrome.runtime.sendMessage(
        !text ? { type: 'featured' } : looksLikeLink(text) ? { type: 'resolve', input: text } : { type: 'search', query: text },
      );
    } catch (e) {
      reply = { ok: false, error: 'The extension was reloaded. Refresh this page.' };
    }
    if (seq !== picker.seq || !picker.open) return;
    if (!reply || !reply.ok) {
      render([]);
      setStatus((reply && reply.error) || 'Tenor could not be reached.', 'error');
      return;
    }
    render(reply.gifs);
    setStatus(reply.gifs.length ? '' : 'No GIFs found.');
  }

  function render(gifs) {
    picker.gifs = gifs;
    // Two columns that grow downwards; each GIF goes into the shorter one.
    const cols = [0, 1].map(() => {
      const col = document.createElement('div');
      col.className = 'col';
      return { el: col, height: 0 };
    });
    gifs.forEach((gif, i) => {
      const cell = document.createElement('div');
      cell.className = 'cell';
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'tile';
      tile.dataset.index = String(i);
      tile.title = gif.title;
      const img = document.createElement('img');
      img.src = gif.preview;
      img.alt = gif.title;
      img.width = gif.width;
      img.height = gif.height;
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      tile.append(img);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove-custom';
      remove.dataset.index = String(i);
      remove.textContent = '×';
      remove.title = 'Remove from My GIFs';
      remove.setAttribute('aria-label', 'Remove from My GIFs');
      const star = document.createElement('button');
      star.type = 'button';
      star.className = 'star';
      star.dataset.index = String(i);
      setStar(star, gif);
      cell.append(tile, star, remove);
      const col = cols[0].height <= cols[1].height ? cols[0] : cols[1];
      col.el.append(cell);
      col.height += gif.height / gif.width;
    });
    picker.els.grid.replaceChildren(...cols.map((c) => c.el));
    picker.els.grid.scrollTop = 0;
  }

  // --------------------------------------------------------------- favorites

  function setFavoritesView(on) {
    picker.showingFavorites = on;
    picker.els.favTab.setAttribute('aria-pressed', String(on));
  }

  function setCustomView(on) {
    picker.showingCustom = on;
    picker.els.customTab.setAttribute('aria-pressed', String(on));
    picker.els.panel.toggleAttribute('data-custom', on);
    if (on) setFavoritesView(false);
  }

  async function addCustomGif() {
    const input = picker.els.input;
    const value = prompt('Paste a Tenor GIF link or numeric Tenor GIF ID to add to My GIFs:');
    if (!value || !value.trim()) return;
    setStatus('Adding GIF…');
    try {
      const reply = await chrome.runtime.sendMessage({ type: 'resolve', input: value.trim() });
      if (!reply || !reply.ok || !reply.gifs || !reply.gifs.length) {
        setStatus((reply && reply.error) || 'Could not add that GIF.', 'error');
        return;
      }
      const gif = reply.gifs[0];
      const items = await chrome.storage.local.get('customGifs');
      const list = Array.isArray(items.customGifs) ? items.customGifs : [];
      if (list.some((g) => g.id === gif.id)) {
        setStatus('That GIF is already in My GIFs.');
        return;
      }
      await chrome.storage.local.set({ customGifs: [gif, ...list].slice(0, 100) });
      const latest = await chrome.storage.local.get('customGifs');
      picker.customGifs = Array.isArray(latest.customGifs) ? latest.customGifs : [];
      setCustomView(true);
      renderCustom(false);
      setStatus('Added to My GIFs.');
    } catch (e) {
      setStatus('Could not save the GIF. Try reloading the YouTube tab.', 'error');
    }
  }

  async function removeCustomGif(gif) {
    if (!gif) return;
    const list = picker.customGifs.filter((g) => g.id !== gif.id);
    try {
      await chrome.storage.local.set({ customGifs: list });
      picker.customGifs = list;
      renderCustom(true);
      setStatus('Removed from My GIFs.');
    } catch (e) {
      setStatus('Could not remove that GIF.', 'error');
    }
  }

  function renderCustom(keepScroll) {
    const top = keepScroll ? picker.els.grid.scrollTop : 0;
    render(picker.customGifs);
    picker.els.grid.scrollTop = top;
    setStatus(picker.customGifs.length ? 'My GIFs · click a GIF to post, × to remove' : 'No custom GIFs yet. Press + to add a Tenor link.');
  }

  function setStar(star, gif) {
    const on = picker.favorites.some((f) => f.id === gif.id);
    star.textContent = on ? '★' : '☆';
    star.title = on ? 'Remove from favorites' : 'Add to favorites';
    star.setAttribute('aria-label', star.title);
    star.setAttribute('aria-pressed', String(on));
  }

  function renderFavorites(keepScroll) {
    const top = keepScroll ? picker.els.grid.scrollTop : 0;
    render(picker.favorites);
    picker.els.grid.scrollTop = top;
    setStatus(picker.favorites.length ? '' : NO_FAVORITES);
  }

  // Takes the stored list, on load and whenever any tab changes it, so every
  // tab works on the same list and none writes back an old copy.
  function useFavorites(stored) {
    picker.favorites = (Array.isArray(stored) ? stored : []).filter((g) => g
      && typeof g.id === 'string' && typeof g.title === 'string' && typeof g.preview === 'string'
      && g.width > 0 && g.height > 0);
    if (!picker.open || picker.busy) return;
    if (picker.showingFavorites) renderFavorites(true);
    else for (const star of picker.els.grid.querySelectorAll('.star')) setStar(star, picker.gifs[Number(star.dataset.index)]);
  }

  chrome.storage.local.get(['favorites', 'customGifs']).then((items) => {
    useFavorites(items.favorites);
    picker.customGifs = (Array.isArray(items.customGifs) ? items.customGifs : []).filter((g) =>
      g && typeof g.id === 'string' && typeof g.title === 'string' && typeof g.preview === 'string'
      && g.width > 0 && g.height > 0);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.favorites) useFavorites(changes.favorites.newValue);
    if (area === 'local' && changes.customGifs) {
      picker.customGifs = (Array.isArray(changes.customGifs.newValue) ? changes.customGifs.newValue : []);
      if (picker.open && picker.showingCustom) renderCustom(true);
    }
  });

  // Only writes the list; the change listener above then shows it, here and
  // in every other tab.
  async function toggleFavorite(gif) {
    const rest = picker.favorites.filter((f) => f.id !== gif.id);
    try {
      await chrome.storage.local.set({ favorites: rest.length < picker.favorites.length ? rest : [gif, ...rest] });
    } catch (e) {
      setStatus('The favorite could not be saved. Refresh this page.', 'error');
    }
  }

  // ----------------------------------------------------------------- posting

  function selectRange(editor, range) {
    editor.focus();
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  // Adds the marker after whatever the user has typed, leaving their text
  // (and any emoji or mentions in it) as it is.
  function appendMarker(editor, marker) {
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selectRange(editor, range);
    let done = false;
    try { done = document.execCommand('insertText', false, marker); } catch (e) { /* fall back below */ }
    if (!done || !editor.textContent.includes(marker)) {
      editor.append(document.createTextNode(marker));
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: marker }));
    }
  }

  function removeMarker(editor, marker) {
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.data.indexOf(marker);
      if (at === -1) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + marker.length);
      selectRange(editor, range);
      let done = false;
      try { done = document.execCommand('delete', false); } catch (e) { /* fall back below */ }
      if (!done || editor.textContent.includes(marker)) {
        node.data = node.data.replace(marker, '');
        editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
      }
      return;
    }
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function send(gif) {
    const box = picker.box;
    const editor = box && box.isConnected && box.querySelector('#contenteditable-root');
    const submit = box && box.querySelector('#submit-button button');
    if (!editor || !submit) {
      setStatus('The comment box was closed. Open it and try again.', 'error');
      return;
    }

    const nonce = newNonce();
    const marker = `[[gif:${gif.id}:${nonce}]]`;
    let settle;
    const settled = new Promise((resolve) => { settle = resolve; });
    let armedAck;
    const armedPromise = new Promise((resolve) => { armedAck = resolve; });
    let seen = false;
    fromMain.set(nonce, (msg) => {
      if (msg.type === 'armed') armedAck(true);
      else if (msg.type === 'refused') armedAck('refused');
      else if (msg.type === 'seen') seen = true;
      else if (msg.type === 'result') settle(msg);
    });

    setBusy(true);
    setStatus('Posting…');
    try {
      toMain({ type: 'arm', id: gif.id, nonce });
      // Without the page hook the marker would be posted as plain text, so
      // nothing is typed into the box until the hook has answered.
      const armed = await Promise.race([armedPromise, sleep(ARM_TIMEOUT_MS).then(() => false)]);
      if (armed !== true) {
        setStatus(armed === 'refused'
          ? 'Not ready in this tab yet. Try again in a few seconds, or refresh this page.'
          : 'The page hook is not running. Refresh this page and try again.', 'error');
        return;
      }

      appendMarker(editor, marker);
      for (let i = 0; i < 20 && submit.disabled; i++) await sleep(50);
      submit.click();

      let result = await Promise.race([settled, sleep(AUTO_SUBMIT_GRACE_MS).then(() => null)]);
      if (!result && !seen) {
        const label = (submit.getAttribute('aria-label') || submit.textContent || 'Comment').trim();
        setStatus(`Press ${label} to send the GIF.`);
      }
      if (!result) result = await Promise.race([settled, sleep(RESULT_TIMEOUT_MS).then(() => null)]);

      if (result && result.ok) {
        setBusy(false);
        closePicker();
        return;
      }
      // Failed or never sent: take the marker back out of the box.
      toMain({ type: 'disarm', nonce });
      if (editor.isConnected) removeMarker(editor, marker);
      setStatus((result && result.error) || 'The GIF was not sent. Nothing was posted.', 'error');
    } finally {
      fromMain.delete(nonce);
      setBusy(false);
    }
  }

  // ------------------------------------------------------- page interactions

  const inPicker = (e) => picker.open && e.composedPath().includes(picker.host);

  // Registered at document_start in the capture phase, ahead of YouTube's own
  // handlers, so typing in the search field does not trigger player shortcuts
  // and scrolling the grid does not flip to the next Short.
  for (const type of ['keydown', 'keyup', 'keypress']) {
    window.addEventListener(type, (e) => {
      if (!inPicker(e)) return;
      e.stopImmediatePropagation();
      if (type !== 'keydown') return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closePicker();
      } else if (e.key === 'Enter' && e.composedPath()[0] === picker.els.input && picker.gifs.length === 1 && !picker.busy) {
        e.preventDefault();
        send(picker.gifs[0]);
      }
    }, true);
  }
  window.addEventListener('wheel', (e) => { if (inPicker(e)) e.stopImmediatePropagation(); }, { capture: true, passive: true });

  window.addEventListener('pointerdown', (e) => {
    if (!picker.open || picker.busy) return;
    const path = e.composedPath();
    if (!path.includes(picker.host) && !path.includes(picker.anchor)) closePicker();
  }, true);

  let placeQueued = false;
  const queuePlace = () => {
    if (!picker.open || placeQueued) return;
    placeQueued = true;
    requestAnimationFrame(() => { placeQueued = false; place(); });
  };
  window.addEventListener('scroll', queuePlace, { capture: true, passive: true });
  window.addEventListener('resize', queuePlace, { passive: true });
  window.addEventListener('yt-navigate-start', () => { if (!picker.busy) closePicker(); });
})();
