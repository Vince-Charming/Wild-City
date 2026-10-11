// Flier pop-up: shows the flier of the next upcoming event (from events-data.js) once per visitor per flier,
// on whichever page they land on first. Closing it (button, backdrop, Escape, or "See event details") marks
// that flier as seen. It never shows on events.html itself (the flier is already on that page) or after the
// event has ended. Self-contained styles, so it works on every page.
(function () {
  const EVENTS = window.COMMONWILD_EVENTS || [];
  const STORE_KEY = (id) => 'cw-flier-seen:' + id;
  const parse = (s) => new Date(s);   // "YYYY-MM-DDTHH:MM" is read as local time

  function storageGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function storageSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* private mode etc. */ } }

  const now = new Date();
  const next = EVENTS
    .filter((e) => e.flier && parse(e.end) > now)
    .sort((a, b) => parse(a.start) - parse(b.start))[0];
  if (!next) return;

  const onEventsPage = /(^|\/)events(\.html)?$/.test(window.location.pathname);
  if (onEventsPage) { storageSet(STORE_KEY(next.id), '1'); return; }
  if (storageGet(STORE_KEY(next.id))) return;

  function show() {
    const style = document.createElement('style');
    style.textContent = `
      .cw-flier-backdrop { position: fixed; inset: 0; z-index: 90; display: flex; align-items: center; justify-content: center;
        padding: 16px; background: rgba(28, 25, 23, .6); }
      .cw-flier { position: relative; display: flex; flex-direction: column; max-width: min(440px, 100%);
        max-height: calc(100vh - 32px); background: #faf8f5; border-radius: 16px; overflow: hidden;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, .45); }
      .cw-flier img { display: block; width: 100%; height: auto; min-height: 0; flex: 1 1 auto; object-fit: contain; background: #e1ede6; }
      .cw-flier__bar { display: flex; gap: 8px; padding: 12px; flex-wrap: wrap; }
      .cw-flier__cta { flex: 1 1 auto; text-align: center; padding: 10px 16px; border-radius: 12px; background: #2f523f;
        color: #fff; font: 700 14px/1.2 'Plus Jakarta Sans', system-ui, sans-serif; text-decoration: none; }
      .cw-flier__cta:hover { background: #3a664e; }
      .cw-flier__later { padding: 10px 16px; border-radius: 12px; border: 1px solid #e5dbcd; background: #fff; color: #44403c;
        font: 600 14px/1.2 'Plus Jakarta Sans', system-ui, sans-serif; cursor: pointer; }
      .cw-flier__close { position: absolute; top: 8px; right: 8px; width: 36px; height: 36px; border-radius: 999px; border: 0;
        background: rgba(255, 255, 255, .92); color: #1d3327; font: 700 20px/1 system-ui, sans-serif; cursor: pointer;
        box-shadow: 0 1px 4px rgba(0, 0, 0, .25); }
      .cw-flier a:focus-visible, .cw-flier button:focus-visible { outline: 2px solid #498062; outline-offset: 2px; }
      @media print { .cw-flier-backdrop { display: none !important; } }`;
    document.head.appendChild(style);

    const back = document.createElement('div');
    back.className = 'cw-flier-backdrop';
    back.innerHTML = `
      <div class="cw-flier" role="dialog" aria-modal="true" aria-label="Upcoming event: ${next.title.replace(/"/g, '&quot;')}">
        <button type="button" class="cw-flier__close" aria-label="Close">&times;</button>
        <img alt="">
        <div class="cw-flier__bar">
          <a class="cw-flier__cta" href="events.html#${next.id}">${next.host === 'commonwild' ? 'Event details &amp; sign up' : 'Event details'}</a>
          <button type="button" class="cw-flier__later">Maybe later</button>
        </div>
      </div>`;
    const img = back.querySelector('img');
    img.alt = next.flierAlt || next.title;
    // Only show once the flier has loaded, so visitors never see an empty box
    img.addEventListener('error', () => back.remove());

    const previouslyFocused = document.activeElement;
    function close() {
      storageSet(STORE_KEY(next.id), '1');
      back.remove();
      document.removeEventListener('keydown', onKey);
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    }
    function onKey(e) {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {   // keep focus inside the dialog
        const f = [...back.querySelectorAll('a, button')];
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    }
    back.addEventListener('click', (e) => { if (e.target === back) close(); });
    back.querySelector('.cw-flier__close').addEventListener('click', close);
    back.querySelector('.cw-flier__later').addEventListener('click', close);
    back.querySelector('.cw-flier__cta').addEventListener('click', () => storageSet(STORE_KEY(next.id), '1'));
    document.addEventListener('keydown', onKey);

    img.addEventListener('load', () => {
      document.body.appendChild(back);
      back.querySelector('.cw-flier__close').focus();
    }, { once: true });
    img.src = next.flier;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
  else show();
})();
