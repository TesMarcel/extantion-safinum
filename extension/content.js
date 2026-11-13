// Safinum Lingua — traduit l'interface d'un service financier en fulfulde / beti-fang
// sans modifier son code. Principe : on ne touche qu'aux nœuds texte « libellés »,
// jamais aux valeurs (montants, numéros, références, noms) ni aux champs de saisie.
(() => {
  "use strict";
  if (globalThis.__safinumLingua) return;
  globalThis.__safinumLingua = true;

  const DICT = globalThis.SAFINUM_DICT || { languages: [], entries: {}, glossary: [] };
  // Langues = colonnes du CSV (voir tools/build_dictionary.py)
  const LANGS = Object.fromEntries(DICT.languages.map((l) => [l.code, l]));
  const FIRST = DICT.languages[0]?.code;
  const DEFAULTS = { lang: FIRST, sites: { "safinum.cm": true }, ai: false, tooltip: true };

  let settings = { ...DEFAULTS };
  let active = false;

  // ---------- Normalisation (doit rester identique à tools/build_dictionary.py) ----------
  const norm = (s) =>
    s.normalize("NFC").replace(/[’‘]/g, "'").replace(/[\s  ]+/g, " ").trim().toLowerCase();

  // ---------- Détection des valeurs à protéger ----------
  const PROTECTED = [
    /^[+\-−]?\s*\d[\d\s  .,]*\s*(FCFA|XAF|F\s?CFA)$/i, // montants
    /^\+?\d[\d\s ().-]{6,}$/, // téléphones
    /^[A-Z]{2,6}-\d{4}-[A-Z0-9]{4,}$/, // références SAF-2026-XXXXXX
    /^[A-Z]{2}(\s?\d{2,5}){3,}$/, // numéros de compte CM 001 2345…
    /^[A-Z]+_\d{3}$/, // codes d'erreur
    /^\d{1,2}\s+\p{L}+\.?\s+\d{4}$/u, // 05 nov. 2026
    /^\p{L}{3,9}\.?\s+\d{1,2},\s+\d{4}$/u, // Nov 5, 2026
  ];
  const PROPER_NAME = /^\p{Lu}[\p{L}'’-]*(\s+\p{Lu}[\p{L}'’-]*)*$/u;
  const SKIP_SELECTOR =
    "script,style,noscript,textarea,input,code,pre,svg,[contenteditable=''],[contenteditable='true'],[translate='no'],.notranslate,#safinum-lingua-host";

  const isProtected = (text) => {
    const t = text.trim();
    if (!/\p{L}/u.test(t)) return true; // que des chiffres / symboles
    return PROTECTED.some((re) => re.test(t));
  };

  // ---------- Recherche dans le dictionaire ----------
  function lookup(text) {
    const e = DICT.entries[norm(text)];
    return e ? e[settings.lang] || null : null;
  }

  function translateKnown(text) {
    const direct = lookup(text);
    if (direct) return direct;
    // Ponctuation finale absente du dictionnaire (« Frais : » …)
    const m = text.match(/^(.*?)(\s*[:.!?]\s*)$/s);
    if (m && m[1].trim()) {
      const t = lookup(m[1]);
      if (t) return t + m[2];
    }
    // Libellé composé : « Numéro de compte : CM 001… », « Bonjour, Amina »
    for (const sep of [" : ", ": ", ", "]) {
      const i = text.indexOf(sep);
      if (i > 0) {
        const left = lookup(text.slice(0, i));
        if (left) return left + text.slice(i); // la partie droite reste intacte
      }
    }
    return null;
  }

  // ---------- État des nœuds traduits ----------
  // node -> { orig, applied }
  const state = new WeakMap();
  const touched = new Set();
  const titled = new Set();

  function setText(node, orig, translated) {
    const lead = orig.match(/^\s*/)[0];
    const trail = orig.match(/\s*$/)[0];
    const applied = lead + translated.trim() + trail;
    state.set(node, { orig, applied });
    touched.add(node);
    if (node.nodeValue !== applied) node.nodeValue = applied;
    const parent = node.parentElement;
    if (parent && parent.childNodes.length === 1) {
      if (LANGS[settings.lang].htmlLang) parent.setAttribute("lang", LANGS[settings.lang].htmlLang);
      if (settings.tooltip && !parent.hasAttribute("title")) {
        parent.setAttribute("title", orig.trim());
        parent.dataset.slTitle = "1";
        titled.add(parent);
      }
    }
  }

  function originalOf(node) {
    const s = state.get(node);
    // Si l'application a changé le texte entre-temps, c'est le nouveau texte source.
    if (s && node.nodeValue === s.applied) return s.orig;
    return node.nodeValue;
  }

  function processTextNode(node) {
    const parent = node.parentElement;
    if (!parent || parent.closest(SKIP_SELECTOR)) return;
    const orig = originalOf(node);
    if (!orig || !orig.trim() || isProtected(orig)) return;

    const known = translateKnown(orig);
    if (known) return setText(node, orig, known);

    // Texte inconnu : nom propre -> jamais traduit
    if (PROPER_NAME.test(orig.trim())) return;
    if (settings.ai) queueAI(node, orig);
  }

  function processAttributes(el) {
    for (const attr of ["aria-label", "placeholder"]) {
      if (!el.hasAttribute(attr)) continue;
      const key = `slOrig_${attr.replace("-", "_")}`;
      const current = el.getAttribute(attr);
      const orig = el.dataset[key] && el.dataset[`${key}_applied`] === current ? el.dataset[key] : current;
      const t = translateKnown(orig);
      if (t) {
        el.dataset[key] = orig;
        el.dataset[`${key}_applied`] = t;
        if (current !== t) el.setAttribute(attr, t);
        touched.add(el);
      }
    }
  }

  function walk(root) {
    if (!active || !root) return;
    if (root.nodeType === Node.TEXT_NODE) return processTextNode(root);
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) {
      if (root.closest(SKIP_SELECTOR)) return;
      processAttributes(root);
    }
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n;
    while ((n = tw.nextNode())) {
      if (n.nodeType === Node.TEXT_NODE) processTextNode(n);
      else processAttributes(n);
    }
  }

  function restoreAll() {
    for (const node of touched) {
      if (node.nodeType === Node.TEXT_NODE) {
        const s = state.get(node);
        if (s && node.isConnected && node.nodeValue === s.applied) node.nodeValue = s.orig;
        state.delete(node);
        const p = node.parentElement;
        if (p) p.removeAttribute("lang");
      } else {
        for (const attr of ["aria-label", "placeholder"]) {
          const key = `slOrig_${attr.replace("-", "_")}`;
          if (node.dataset && node.dataset[key]) {
            if (node.getAttribute(attr) === node.dataset[`${key}_applied`]) node.setAttribute(attr, node.dataset[key]);
            delete node.dataset[key];
            delete node.dataset[`${key}_applied`];
          }
        }
      }
    }
    for (const el of titled) {
      if (el.dataset.slTitle) {
        el.removeAttribute("title");
        delete el.dataset.slTitle;
      }
    }
    touched.clear();
    titled.clear();
  }

  // ---------- Observation du contenu dynamique ----------
  const dirty = new Set();
  let scheduled = false;
  const observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "characterData") {
        const s = state.get(r.target);
        if (s && r.target.nodeValue === s.applied) continue; // notre propre écriture
        dirty.add(r.target);
      } else if (r.type === "attributes") {
        dirty.add(r.target);
      } else {
        r.addedNodes.forEach((n) => dirty.add(n));
      }
    }
    if (!scheduled && dirty.size) {
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        const batch = [...dirty];
        dirty.clear();
        batch.forEach((n) => n.isConnected && walk(n));
      });
    }
  });

  function start() {
    if (active) return;
    active = true;
    walk(document.body);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["aria-label", "placeholder"],
    });
  }

  function stop() {
    if (!active) return;
    active = false;
    observer.disconnect();
    dirty.clear();
    restoreAll();
  }

  // ---------- Traduction IA (facultative) des contenus inédits ----------
  const aiCache = new Map(); // `${lang}|${texte}` -> traduction | null (échec)
  const aiQueue = new Map(); // texte -> Set(nodes)
  let aiTimer = null;

  function queueAI(node, orig) {
    const text = orig.trim();
    if (text.split(/\s+/).length < 2 || text.length < 8) return;
    const cached = aiCache.get(`${settings.lang}|${text}`);
    if (cached) return setText(node, orig, cached);
    if (cached === null) return;
    if (!aiQueue.has(text)) aiQueue.set(text, new Set());
    aiQueue.get(text).add(node);
    clearTimeout(aiTimer);
    aiTimer = setTimeout(flushAI, 400);
  }

  // Remplace chiffres, montants, références, codes et noms par ⟦n⟧ avant l'envoi.
  function mask(text) {
    const kept = [];
    const put = (m) => {
      kept.push(m);
      return `⟦${kept.length - 1}⟧`;
    };
    let out = text
      .replace(/\b[A-Z]{2,6}-\d{4}-[A-Z0-9]{4,}\b/g, put)
      .replace(/\b[A-Z]+_\d{3}\b/g, put)
      .replace(/\+?\d(?:[\d.,]|[\s  ](?=\d))*(?:\s?(?:FCFA|XAF))?(?:\s?%)?/g, put)
      .replace(/\b[A-Z]{2,}\b/g, put)
      .replace(/\p{Lu}[\p{Ll}'’-]+(?:[\s-]\p{Lu}[\p{Ll}'’-]+)+/gu, put);
    // Mot à majuscule au milieu d'une phrase = nom propre probable
    out = out.replace(/(?<=[\p{Ll},;]\s)\p{Lu}[\p{L}'’-]+/gu, put);
    return { masked: out, kept };
  }

  function unmask(translated, kept) {
    for (let i = 0; i < kept.length; i++) {
      const tag = `⟦${i}⟧`;
      if (translated.split(tag).length !== 2) return null; // marqueur perdu ou dupliqué -> rejet
      translated = translated.replace(tag, () => kept[i]);
    }
    return /⟦\d+⟧/.test(translated) ? null : translated;
  }

  async function flushAI() {
    const lang = settings.lang;
    const items = [...aiQueue.entries()].slice(0, 20);
    items.forEach(([t]) => aiQueue.delete(t));
    if (aiQueue.size) aiTimer = setTimeout(flushAI, 400);
    if (!items.length) return;

    const masked = items.map(([t]) => mask(t));
    const glossary = DICT.glossary.filter((g) => g[lang]).map((g) => `${g.fr} / ${g.en} = ${g[lang]}`);
    widgetStatus("Traduction IA…");
    let res;
    try {
      res = await chrome.runtime.sendMessage({
        type: "sl-translate",
        lang,
        langDescription: LANGS[lang].description,
        texts: masked.map((m) => m.masked),
        glossary,
      });
    } catch (e) {
      res = { error: String(e) };
    }
    if (!res || res.error || !Array.isArray(res.translations) || res.translations.length !== items.length) {
      widgetStatus(res && res.error === "no-key" ? "IA : clé API manquante" : "IA indisponible");
      items.forEach(([t]) => aiCache.set(`${lang}|${t}`, null));
      return;
    }
    widgetStatus("");
    items.forEach(([text, nodes], i) => {
      const t = unmask(res.translations[i], masked[i].kept);
      aiCache.set(`${lang}|${text}`, t);
      if (!t || lang !== settings.lang || !active) return;
      nodes.forEach((node) => {
        if (node.isConnected && originalOf(node).trim() === text) setText(node, originalOf(node), t);
      });
    });
  }

  // ---------- Petit sélecteur flottant (Shadow DOM : invisible pour la page) ----------
  let widget = null;
  function buildWidget() {
    const host = document.createElement("div");
    host.id = "safinum-lingua-host";
    host.setAttribute("translate", "no");
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host { all: initial; }
        .box { position: fixed; left: 16px; bottom: 16px; z-index: 2147483646;
          display: flex; align-items: center; gap: 8px; padding: 8px 12px;
          background: #111827; color: #fff; border: 2px solid #FFEB3B; border-radius: 999px;
          font: 600 14px/1.2 system-ui, sans-serif; box-shadow: 0 4px 16px rgba(0,0,0,.35); }
        select { font: inherit; color: #111827; background: #fff; border: 0; border-radius: 6px; padding: 4px 6px; }
        select:focus-visible { outline: 3px solid #00BFFF; outline-offset: 2px; }
        .st { font-weight: 400; font-size: 12px; color: #FFEB3B; }
        .st:empty { display: none; }
      </style>
      <div class="box" role="region" aria-label="Langue de l'interface">
        <span aria-hidden="true">🌍</span>
        <select aria-label="Choisir la langue"></select>
        <span class="st" role="status" aria-live="polite"></span>
      </div>`;
    const select = root.querySelector("select");
    for (const [value, label] of [...DICT.languages.map((l) => [l.code, l.label]), ["off", "Original"]]) {
      select.append(new Option(label, value));
    }
    select.addEventListener("change", () => {
      const v = select.value;
      const h = location.hostname;
      const sites = { ...settings.sites };
      if (v === "off") {
        for (const d of Object.keys(sites)) if (h === d || h.endsWith("." + d)) sites[d] = false;
        sites[h] = false;
        chrome.storage.sync.set({ sites });
      } else chrome.storage.sync.set({ lang: v, sites: { ...sites, [h]: true } });
    });
    document.documentElement.appendChild(host);
    widget = { select, status: root.querySelector(".st") };
  }
  function widgetStatus(msg) {
    if (widget) widget.status.textContent = msg;
  }
  function syncWidget() {
    if (!widget) buildWidget();
    widget.select.value = siteEnabled() ? settings.lang : "off";
  }

  // ---------- Réglages ----------
  function siteEnabled() {
    const h = location.hostname;
    return Object.entries(settings.sites).some(([s, on]) => on && (h === s || h.endsWith("." + s)));
  }

  function apply(prevLang) {
    if (!LANGS[settings.lang]) settings.lang = FIRST; // langue retirée du CSV
    if (siteEnabled() && FIRST) {
      if (active && prevLang && prevLang !== settings.lang) {
        stop();
        aiQueue.clear();
      }
      start();
    } else stop();
    syncWidget();
  }

  chrome.storage.sync.get(DEFAULTS, (s) => {
    settings = { ...DEFAULTS, ...s };
    apply();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    const prevLang = settings.lang;
    for (const [k, { newValue }] of Object.entries(changes)) settings[k] = newValue;
    apply(prevLang);
  });
})();
