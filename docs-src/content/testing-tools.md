---
title: Testing tools
lead: Quick checks for offline mode, permissions and validation.
---
[[shots: offline | Offline: the app’s calls fail ; run-as-every-user | One status per user ; edge-cases | One bad field at a time]]

## Go offline

Click the **wifi** button in the header. Every call the app makes now fails, as if there’s no internet. Only this tab is affected, and it stays offline after a reload. Click **Offline** to go back online.

## Try with every user

**Tools ▾ → Try with every user** sends the request as each user of the environment and lists the status for each. A quick permission check: *Admin 200, Viewer 403*. It needs at least one saved user; until then it's greyed out.

## Test edge cases

**Tools ▾ → Test edge cases** sends the request again with one field changed at a time: empty, too long, wrong type, out of range, missing.

- ✓ **rejected** (4xx): what you want.
- ⚠ **accepted** (2xx): maybe missing validation.
- ✕ **crashed** (5xx): a bug.
