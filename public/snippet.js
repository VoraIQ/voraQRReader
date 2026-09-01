/**
 * Embed on your destination site:
 *   <script src="https://YOUR-TRACKER-DOMAIN.vercel.app/snippet.js"></script>
 *
 * Then, wherever a visitor completes something worth tracking:
 *   trackQrAction('signup', { plan: 'pro' });
 *
 * It automatically figures out its own tracker domain from the <script> tag,
 * so no manual editing is needed.
 */
(function () {
  var STORAGE_KEY = 'qr_click_id';

  var trackerOrigin = (function () {
    var currentScript = document.currentScript;
    if (currentScript && currentScript.src) {
      return new URL(currentScript.src).origin;
    }
    return '';
  })();

  var cidFromUrl = new URLSearchParams(window.location.search).get('qr_cid');
  if (cidFromUrl) {
    try {
      localStorage.setItem(STORAGE_KEY, cidFromUrl);
    } catch (e) {
      // localStorage unavailable (private browsing, etc.) - fall back to
      // the in-memory value for this page load only.
    }
  }

  function getClickId() {
    if (cidFromUrl) return cidFromUrl;
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  window.trackQrAction = function (actionType, metadata) {
    var clickId = getClickId();
    if (!clickId || !trackerOrigin) return; // this visitor didn't arrive via a tracked QR code

    var payload = JSON.stringify({
      clickId: clickId,
      actionType: actionType,
      metadata: metadata || {},
    });

    var endpoint = trackerOrigin + '/api/action';

    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([payload], { type: 'application/json' }));
    } else {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      });
    }
  };
})();
