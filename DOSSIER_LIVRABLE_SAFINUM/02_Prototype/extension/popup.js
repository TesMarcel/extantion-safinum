const LANGUAGES = globalThis.SAFINUM_DICT.languages;
// Firefox marque ses voix système comme non locales (voir content.js)
const IS_FIREFOX = /\bFirefox\//.test(navigator.userAgent);
const DEFAULTS = { lang: LANGUAGES[0].code, sites: { "safinum.cm": true }, ai: false, tooltip: true, voice: true, rate: 0.9 };
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
  $("voice").checked = s.voice;
  $("voicebox").hidden = !s.voice;
  $("rate").value = String(s.rate);
  if (!$("rate").value) $("rate").value = "0.9";
  showVoiceInfo($("lang").value);

  $("lang").onchange = () => {
    chrome.storage.sync.set({ lang: $("lang").value });
    showVoiceInfo($("lang").value);
  };
  $("voice").onchange = () => {
    $("voicebox").hidden = !$("voice").checked;
    chrome.storage.sync.set({ voice: $("voice").checked });
  };
  $("rate").onchange = () => chrome.storage.sync.set({ rate: Number($("rate").value) });
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

// Nombre d'enregistrements et voix locale de secours pour la langue choisie
function showVoiceInfo(code) {
  const lang = LANGUAGES.find((l) => l.code === code);
  const n = Object.keys(globalThis.SAFINUM_DICT.audio?.[code] || {}).length;
  const total = new Set(Object.values(globalThis.SAFINUM_DICT.entries).filter((e) => e[code]).map((e) => e.id)).size;
  const render = () => {
    const want = lang?.ttsLang || "fr";
    const pref = { fr: "fr-fr", en: "en-gb" }[want];
    const score = (x) => (x.lang.toLowerCase().replace("_", "-") === pref ? 2 : 0) + (x.name.includes("+") ? 0 : 1);
    const v = speechSynthesis
      .getVoices()
      .filter((x) => (x.localService || IS_FIREFOX) && x.lang.toLowerCase().startsWith(want))
      .sort((a, b) => score(b) - score(a))[0];
    $("voiceinfo").textContent =
      `${n} / ${total} mots enregistrés en ${lang?.label}. ` +
      (v ? `Les autres sont lus par la voix « ${v.name} » (approximative).` : "Aucune voix locale de secours sur cet ordinateur.");
  };
  render();
  speechSynthesis.onvoiceschanged = render;
}
