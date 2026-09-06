import { THEME_STORAGE_KEY } from "./constants";

/**
 * Runs before paint so the first frame matches the stored or system theme.
 * Keep this a static string: it is injected from a Server Component, not a
 * client tree. React 19 does not execute `<script>` rendered by client
 * components (next-themes' previous approach).
 */
export const THEME_INIT_SCRIPT = `(function(){var k=${JSON.stringify(THEME_STORAGE_KEY)};var d=document.documentElement;var t=["light","dark"];function a(n){d.classList.remove("light","dark");d.classList.add(n);d.style.colorScheme=n}function s(){return window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}try{var v=localStorage.getItem(k)||"system";var n=v==="system"?s():v;if(t.indexOf(n)===-1)n=s();a(n)}catch(e){a(s())}})();`;
