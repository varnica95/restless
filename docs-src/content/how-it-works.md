---
title: How it works
lead: What RESTless does in your browser, and what it doesn’t.
---
## In your browser only

RESTless runs inside the page and watches the app’s `fetch` and `XMLHttpRequest` calls. Nothing is sent anywhere else: no account, no server, no tracking.

## What it stores

Your rules, mocks, environments and users are saved in this browser, per site. Captured calls are kept until the page reloads, unless **Preserve log** is on. Clearing the site’s data removes everything.

## Limits

- Only calls made by the page itself: not server-side rendering, service workers, WebSockets, `sendBeacon` or cross-origin iframes.
- **Apply to app** repeats the click that made the call, so that button must have been clicked once on the page. Otherwise it reloads the page.
- Another server must allow calls from your app’s page (CORS).
- Mocks and simulations only apply in your browser while RESTless is on.
