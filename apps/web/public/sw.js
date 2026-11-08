/* Lumovio service worker.
 *
 * 1. TorrServer auth bridge: <video> cannot send an Authorization header, so player URLs for
 *    password-protected TorrServers use a same-origin virtual path `/__ts/<connectionId>/<path>`.
 *    This worker fetches the owner's credentials from the Lumovio API (same origin, session
 *    cookie) and forwards the request — Range header included — DIRECTLY to the user's server.
 *    Video bytes never pass through Lumovio's backend.
 * 2. Offline fallback for page navigations.
 */
const VERSION = "lumovio-sw-5";
const creds = new Map();

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function basic(user, pass) {
  const bytes = new TextEncoder().encode(`${user}:${pass || ""}`);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return `Basic ${btoa(bin)}`;
}

async function credentialsFor(connectionId) {
  const cached = creds.get(connectionId);
  if (cached && cached.exp > Date.now()) return cached;
  const res = await fetch(`/api/connections/${connectionId}/credentials`, { credentials: "same-origin", cache: "no-store" });
  if (!res.ok) throw new Error(`credentials ${res.status}`);
  const body = await res.json();
  const a = body.auth || {};
  const value = {
    base: String(body.baseUrl).replace(/\/+$/, ""),
    header: a.kind === "torrserver" && a.username ? basic(a.username, a.password) : null,
    exp: Date.now() + 10 * 60 * 1000,
  };
  creds.set(connectionId, value);
  return value;
}

const PRIVATE = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|[^.]+\.local$)/i;

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "lumovio:forget-credentials") creds.clear();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const m = url.pathname.match(/^\/__ts\/([0-9a-f-]{36})\/(.+)$/);
  if (m) {
    event.respondWith(
      (async () => {
        try {
          const c = await credentialsFor(m[1]);
          const target = `${c.base}/${m[2]}${url.search}`;
          const headers = new Headers();
          const range = event.request.headers.get("range");
          if (range) headers.set("range", range);
          if (c.header) headers.set("authorization", c.header);
          const init = { method: "GET", headers, mode: "cors", credentials: "omit", cache: "no-store" };
          if (PRIVATE.test(new URL(target).hostname)) init.targetAddressSpace = "local";
          const res = await fetch(target, init);
          if (res.status === 401) creds.delete(m[1]);
          return res;
        } catch (err) {
          return new Response(`TorrServer bridge error: ${err && err.message}`, { status: 502 });
        }
      })(),
    );
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => offlinePage(url)));
  }
});

/*
 * The offline page (design-system 11.3, 7.11, audit SH-10): the page state — the logo where the header has it, in the
 * middle the projector going dark, "No connection" and Retry, the why for a screen reader — in the person's language and
 * theme, with nothing loaded from the network.
 * Language: the address (/ru/…, /de/…), else the saved choice (cookie), else the browser's; drafts get English (8.11).
 * A language joins OFFLINE_TEXT when it becomes "reviewed" (i18n/locales.ts).
 * Theme: the saved choice; dark by default. The logo paths are those of src/lib/brand.ts.
 * Retry has the focus from the start (a TV remote's OK presses it), and the page tries the site again every 15 s by
 * itself: a TV whose network is up but can't reach the site never gets an "online" event.
 */
/* BEGIN brand:motion offline */
const OFFLINE_MOTION_ART = "<svg xmlns=\"http://www.w3.org/2000/svg\" class=\"lm-art lm-offline\" width=\"64\" height=\"64\" viewBox=\"0 0 128 128\" aria-hidden=\"true\" style=\"--lm-mark:var(--mark);--lm-muted:var(--text2)\"><title>Offline</title><style>\n.lm-offline {\n  --lm-offline-duration: 320ms;\n  display: block;\n}\n.lm-offline .lm-projector,\n.lm-offline .lm-screen {\n  fill: var(--lm-muted);\n  animation: lm-projector-off var(--lm-offline-duration) ease-out both;\n}\n.lm-offline .lm-beam {\n  fill: var(--lm-mark);\n  opacity: 0;\n  animation: lm-beam-off var(--lm-offline-duration) ease-out both;\n}\n@keyframes lm-projector-off {\n  from {\n    fill: var(--lm-mark);\n  }\n  to {\n    fill: var(--lm-muted);\n  }\n}\n@keyframes lm-beam-off {\n  from {\n    opacity: 0.2;\n  }\n  to {\n    opacity: 0;\n  }\n}\n\n@media(prefers-reduced-motion:reduce){.lm-offline *{animation:none!important}}</style><g><path class=\"lm-projector\" d=\"M4 39C4 33 8 30 13.5 32.3L29.4 39.1C33 40.6 34 43 34 47V84C34 88 32.8 90.4 29.4 91.9L13.5 98.7C8 101 4 98 4 92Z\"/><path class=\"lm-screen\" d=\"M45 38L111 8C118 4.8 124 9.4 124 17V111C124 119 118 123 111 120L45 90C40.2 87.8 38 84.7 38 80V78L84.8 93C88.5 94.2 91 92.4 91 88.5V39.5C91 35.6 88.5 33.8 84.8 35L38 50V48C38 43.3 40.2 40.2 45 38Z\"/></g><path class=\"lm-beam\" d=\"M38 50 84.8 35Q91 32.8 91 39.5V88.5Q91 94.2 84.8 93L38 78Z\"/></svg>";
/* END brand:motion offline */
const OFFLINE_TEXT = {
  ru: { title: "Нет подключения", text: "Проверьте интернет. Библиотека вернётся, как только связь восстановится.", retry: "Повторить" },
  uk: { title: "Немає з’єднання", text: "Перевірте інтернет. Бібліотека повернеться, щойно зв’язок відновиться.", retry: "Повторити" },
  en: { title: "You're offline", text: "Check your connection. Your library will be back as soon as you're online.", retry: "Retry" },
  de: { title: "Keine Verbindung", text: "Prüfe deine Internetverbindung. Deine Mediathek ist wieder da, sobald du online bist.", retry: "Erneut versuchen" },
  es: { title: "Sin conexión", text: "Comprueba tu conexión a internet. Tu biblioteca volverá en cuanto vuelvas a estar en línea.", retry: "Reintentar" },
  "pt-BR": { title: "Sem conexão", text: "Verifique sua conexão com a internet. Sua biblioteca volta assim que você estiver on-line.", retry: "Tentar novamente" },
  fr: { title: "Pas de connexion", text: "Vérifiez votre connexion à Internet. Votre bibliothèque reviendra dès que vous serez en ligne.", retry: "Réessayer" },
  it: { title: "Nessuna connessione", text: "Controlla la connessione a internet. La tua libreria tornerà appena sarai online.", retry: "Riprova" },
  pl: { title: "Brak połączenia", text: "Sprawdź połączenie z internetem. Twoja biblioteka wróci, gdy tylko połączenie zostanie przywrócone.", retry: "Spróbuj ponownie" },
  tr: { title: "Bağlantı yok", text: "İnternet bağlantınızı kontrol edin. Kitaplığınız, bağlantı gelir gelmez geri dönecek.", retry: "Tekrar dene" },
};
const LOGO_MARK = ["M4 39C4 33 8 30 13.5 32.3L29.4 39.1C33 40.6 34 43 34 47V84C34 88 32.8 90.4 29.4 91.9L13.5 98.7C8 101 4 98 4 92Z","M45 38L111 8C118 4.8 124 9.4 124 17V111C124 119 118 123 111 120L45 90C40.2 87.8 38 84.7 38 80V78L84.8 93C88.5 94.2 91 92.4 91 88.5V39.5C91 35.6 88.5 33.8 84.8 35L38 50V48C38 43.3 40.2 40.2 45 38Z"];
const LOGO_WORD = "M175.66 88.98L132 88.98L132 23.39L146.58 23.39L146.58 76.16L175.66 76.16L175.66 88.98M202.88 90L202.88 90Q196.66 90 191.87 87.45Q187.09 84.89 184.39 80.39Q181.7 75.88 181.7 70.03L181.7 70.03L181.7 43.83L195.91 43.83L195.91 69.84Q195.91 72.16 196.7 73.84Q197.49 75.51 199.07 76.44Q200.65 77.37 202.88 77.37L202.88 77.37Q206.04 77.37 207.9 75.37Q209.75 73.37 209.75 69.84L209.75 69.84L209.75 43.83L223.97 43.83L223.97 69.93Q223.97 75.88 221.27 80.39Q218.58 84.89 213.84 87.45Q209.1 90 202.88 90M247.1 88.98L232.89 88.98L232.89 43.83L247.1 43.83L247.1 47.17Q248.49 45.87 250.26 44.95L250.26 44.95Q254.25 42.9 259.27 42.9L259.27 42.9Q264.01 42.9 267.81 45.04L267.81 45.04Q270.51 46.62 272.46 49.03L272.46 49.03Q274.5 46.71 277.38 45.13L277.38 45.13Q281.56 42.9 286.86 42.9L286.86 42.9Q292.06 42.9 296.1 45.08Q300.14 47.27 302.51 51.31Q304.88 55.35 304.88 61.02L304.88 61.02L304.88 88.98L290.67 88.98L290.67 62.6Q290.67 59.16 288.58 57.25Q286.49 55.35 283.42 55.35L283.42 55.35Q281.28 55.35 279.61 56.23Q277.94 57.11 276.96 58.69Q275.99 60.27 275.99 62.6L275.99 62.6L275.99 88.98L261.78 88.98L261.78 62.6Q261.78 59.16 259.69 57.25Q257.6 55.35 254.53 55.35L254.53 55.35Q252.39 55.35 250.72 56.23Q249.05 57.11 248.07 58.69Q247.1 60.27 247.1 62.6L247.1 62.6L247.1 88.98M335.72 90L335.72 90Q328.75 90 323.13 86.89Q317.51 83.78 314.26 78.39Q311.01 73 311.01 66.31L311.01 66.31Q311.01 59.62 314.26 54.33Q317.51 49.03 323.09 45.92Q328.66 42.81 335.72 42.81L335.72 42.81Q342.78 42.81 348.36 45.87Q353.93 48.94 357.18 54.28Q360.43 59.62 360.43 66.31L360.43 66.31Q360.43 73 357.18 78.39Q353.93 83.78 348.36 86.89Q342.78 90 335.72 90M335.72 77.09L335.72 77.09Q338.79 77.09 341.11 75.74Q343.43 74.39 344.69 71.93Q345.94 69.47 345.94 66.31L345.94 66.31Q345.94 63.15 344.64 60.78Q343.34 58.42 341.06 57.07Q338.79 55.72 335.72 55.72L335.72 55.72Q332.75 55.72 330.43 57.07Q328.1 58.42 326.8 60.83Q325.5 63.25 325.5 66.4L325.5 66.4Q325.5 69.47 326.8 71.93Q328.1 74.39 330.43 75.74Q332.75 77.09 335.72 77.09M391.92 88.98L380.5 88.98L361.36 43.83L376.69 43.83L386.35 71.79L396.01 43.83L411.06 43.83L391.92 88.98M430.38 88.98L416.17 88.98L416.17 43.83L430.38 43.83L430.38 88.98M423.32 37.61L423.32 37.61Q419.98 37.61 417.8 35.33Q415.61 33.05 415.61 29.8L415.61 29.8Q415.61 26.46 417.8 24.23Q419.98 22 423.32 22L423.32 22Q426.67 22 428.8 24.23Q430.94 26.46 430.94 29.8L430.94 29.8Q430.94 33.05 428.8 35.33Q426.67 37.61 423.32 37.61M462.15 90L462.15 90Q455.19 90 449.57 86.89Q443.95 83.78 440.69 78.39Q437.44 73 437.44 66.31L437.44 66.31Q437.44 59.62 440.69 54.33Q443.95 49.03 449.52 45.92Q455.09 42.81 462.15 42.81L462.15 42.81Q469.21 42.81 474.79 45.87Q480.36 48.94 483.61 54.28Q486.86 59.62 486.86 66.31L486.86 66.31Q486.86 73 483.61 78.39Q480.36 83.78 474.79 86.89Q469.21 90 462.15 90M462.15 77.09L462.15 77.09Q465.22 77.09 467.54 75.74Q469.86 74.39 471.12 71.93Q472.37 69.47 472.37 66.31L472.37 66.31Q472.37 63.15 471.07 60.78Q469.77 58.42 467.49 57.07Q465.22 55.72 462.15 55.72L462.15 55.72Q459.18 55.72 456.86 57.07Q454.54 58.42 453.23 60.83Q451.93 63.25 451.93 66.4L451.93 66.4Q451.93 69.47 453.23 71.93Q454.54 74.39 456.86 75.74Q459.18 77.09 462.15 77.09";

async function cookie(name) {
  try {
    return (await self.cookieStore?.get(name))?.value ?? null;
  } catch {
    return null;
  }
}

async function offlineLanguage(url) {
  const prefix = url.pathname.split("/")[1];
  if (OFFLINE_TEXT[prefix]) return prefix;
  if (/^[a-z]{2}(-[A-Z]{2})?$/.test(prefix)) return "en";
  const saved = await cookie("lumovio_locale");
  if (OFFLINE_TEXT[saved]) return saved;
  // "de-AT" → de, "pt-BR" → pt-BR: a language here, or a region of one (as the site picks it, i18n/locales.ts).
  for (const tag of self.navigator.languages ?? []) {
    const t = tag.toLowerCase();
    const code = Object.keys(OFFLINE_TEXT).find((k) => t === k.toLowerCase() || t.startsWith(`${k.toLowerCase()}-`));
    if (code) return code;
  }
  return "en";
}

async function offlinePage(url) {
  const lang = await offlineLanguage(url);
  const saved = await cookie("lumovio_theme");
  const theme = saved === "light" || saved === "system" ? saved : "dark";
  const t = OFFLINE_TEXT[lang];
  const light = "--bg:#f6f7f9;--surface:#fff;--surface2:#eef0f3;--line:rgb(10 12 16/.09);--text:#0b0c10;--text2:#4a505c;--mark:#0b0c10;--btn:#0b0c10;--btnfg:#f6f7f9;--focus:#5c7800;color-scheme:light";
  const html = `<!doctype html><html lang="${lang}" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="${theme === "light" ? "#f6f7f9" : "#0b0c10"}"><title>${t.title} · Lumovio</title><style>
:root{--bg:#0b0c10;--surface:#14161b;--surface2:#1c1f26;--line:rgb(255 255 255/.08);--text:#f5f6f8;--text2:#b4b9c4;--mark:#dcfa63;--btn:#f5f6f8;--btnfg:#0b0c10;--focus:#dcfa63;color-scheme:dark}
:root[data-theme=light]{${light}}
@media (prefers-color-scheme:light){:root[data-theme=system]{${light}}}
*{box-sizing:border-box}
body{margin:0;min-height:100dvh;display:flex;flex-direction:column;background:var(--bg);color:var(--text);font:400 15px/1.5 Onest,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
header{height:64px;display:flex;align-items:center;padding:0 16px}
@media (min-width:768px){header{padding:0 32px}}
@media (min-width:1024px){header{padding:0 48px}}
@media (min-width:1536px){header{padding:0 64px}}
header svg{display:block;height:30px;width:auto}
main{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 16px 96px;text-align:center}
.icon{width:48px;height:48px;margin-bottom:16px}
.icon>svg{width:48px;height:48px}
h1{margin:0;max-width:28rem;font-size:24px;font-weight:700;line-height:1.25;text-wrap:balance}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
button{margin-top:32px;height:48px;padding:0 24px;border:0;border-radius:999px;background:var(--btn);color:var(--btnfg);font:inherit;font-weight:600;cursor:pointer}
button:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
</style></head><body>
<header><svg role="img" aria-label="Lumovio" viewBox="0 0 491 112"><g transform="scale(.875)" fill="var(--mark)">${LOGO_MARK.map((d) => `<path d="${d}"/>`).join("")}</g><path fill="currentColor" d="${LOGO_WORD}"/></svg></header>
<main><div class="icon" aria-hidden="true">${OFFLINE_MOTION_ART}</div><h1>${t.title}</h1><p class="sr">${t.text}</p><button type="button" id="retry" autofocus>${t.retry}</button></main>
<script>var r=document.getElementById("retry");r.onclick=function(){location.reload()};r.focus();addEventListener("online",function(){location.reload()});setInterval(function(){fetch("/manifest.webmanifest",{cache:"no-store"}).then(function(x){if(x.ok)location.reload()},function(){})},15000);</script>
</body></html>`;
  return new Response(html, { status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

self.VERSION = VERSION;
