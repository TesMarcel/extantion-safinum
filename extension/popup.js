const LANGUAGES = globalThis.SAFINUM_DICT.languages;
const DEFAULTS = { lang: LANGUAGES[0].code, sites: { "safinum.cm": true }, ai: false, tooltip: true };
const $ = (id) => document.getElementById(id);

(async () => {
  for (const l of LANGUAGES) $("lang").append(new Option(l.label, l.code));
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let host = "";
  try {
    host = new URL(tab.url).hostname;
  } catch {}
  $("host").textContent = host || "ce site";

  const s = await chrome.storage.sync.get(DEFAULTS);
  const { apiKey = "" } = await chrome.storage.local.get("apiKey");
  $("lang").value = LANGUAGES.some((l) => l.code === s.lang) ? s.lang : DEFAULTS.lang;
  $("site").checked = Object.entries(s.sites).some(([d, on]) => on && (host === d || host.endsWith("." + d)));
  $("site").disabled = !host;
  $("tooltip").checked = s.tooltip;
  $("ai").checked = s.ai;
  $("key").value = apiKey;
  $("keybox").hidden = !s.ai;

  $("lang").onchange = () => chrome.storage.sync.set({ lang: $("lang").value });
  $("tooltip").onchange = () => chrome.storage.sync.set({ tooltip: $("tooltip").checked });
  $("ai").onchange = () => {
    $("keybox").hidden = !$("ai").checked;
    chrome.storage.sync.set({ ai: $("ai").checked });
  };
  $("key").onchange = () => chrome.storage.local.set({ apiKey: $("key").value.trim() });
  $("site").onchange = async () => {
    const cur = await chrome.storage.sync.get(DEFAULTS);
    const sites = { ...cur.sites };
    // Désactiver aussi le domaine parent qui couvrirait ce site
    for (const d of Object.keys(sites)) if (host === d || host.endsWith("." + d)) sites[d] = false;
    sites[host] = $("site").checked;
    chrome.storage.sync.set({ sites });
  };
})();
