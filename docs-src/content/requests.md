---
title: Requests
lead: Every API call your app makes, grouped by endpoint.
---
[[shots: requests | Search, filters and pinned endpoints ; mocked-request | Calls grouped under their endpoint]]

## Find a call

- **Search** looks in URLs and bodies.
- **Filters** narrow the list to methods, errors, slow or large calls.
- Click a row to open it. Rows with several calls expand.

## Keep what matters

- **Pin** an endpoint to keep it at the top: hover the row and click the pin, or use **⋯ → Pin to top**.
- **Preserve log** (the history icon) keeps calls when the page reloads.
- **Select** (the checkbox icon above the list) to pause or resume capturing several endpoints at once, or export them.
- **Middle-click** a request to open it in a new tab and stay on the list.
- Open request tabs come back after a reload, with your edits.

## Read the tags

| Tag | Means |
|---|---|
| **Simulated** | You changed what the app got back. |
| **Mocked** | A mock endpoint answered. No server was called. |
| **Offline** | The call failed because the tab is offline. |
| **yours** | A request you made, not the app. |
