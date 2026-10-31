"use client";

// Runs before the first paint: the saved theme, or the OS preference for "As the system", without a flash.
const CODE = `(function(){try{var m=document.cookie.match(/(?:^|; )lumovio_theme=(\\w+)/);var p=m&&(m[1]==='light'||m[1]==='system')?m[1]:'dark';var t=p==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):p;var d=document.documentElement;d.dataset.theme=t;d.dataset.themePref=p;}catch(e){}})();`;

/**
 * The first-paint theme script, in the server's HTML only. React never runs a script it renders in the browser, and
 * says so in the console whenever it renders one there — on a 404 or an error page, which the browser renders anew
 * (audit SH-14). Hydrating <head>, React skips the server's node that has no counterpart here.
 */
export function ThemeScript() {
  if (typeof window !== "undefined") return null;
  // biome-ignore lint/security/noDangerouslySetInnerHtml: a static first-paint script
  return <script dangerouslySetInnerHTML={{ __html: CODE }} />;
}
