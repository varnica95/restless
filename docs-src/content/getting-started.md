---
title: Getting started
lead: Install RESTless, open the panel and start watching your app’s API calls.
---
## Install

1. Clone the repo or download it as a ZIP from GitHub.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and pick the `restless` folder.
4. Reload the tab with your app.

## Open the panel

Click the RESTless icon in the toolbar, or press <kbd>Ctrl</kbd>+<kbd>Y</kbd>. The panel opens beside your page.

## Turn on capturing

RESTless records nothing until you allow it, one site at a time. Click **Turn on capturing**, or **Turn on and reload** to catch the calls the page makes while loading.

[[shots: requests | Every API call, grouped by endpoint]]

## Find your way

- **Requests**: every call the app makes.
- **Rules**: everything you’ve changed, in one list.
- **API Docs**: your OpenAPI / Swagger docs.

In the header: where your requests go (**Where & as**), the **Offline** switch and **Settings**.

> **Tip:** <kbd>Ctrl</kbd>+click a button or table in your app (or right-click → **Inspect API call**) to jump straight to the call behind it.
