# RESTless 🐦

**The Network tab on steroids.** Never let your API rest.

<img src="icons/128.png" width="64" alt="RESTless mockingbird">

A Chrome extension (Manifest V3) that sits next to your app and shows every API call it makes: see which call a button or table uses, edit and replay it, pause it like a breakpoint, mock responses and errors, compare responses, and try new endpoints straight from your OpenAPI docs.

The mascot is a mockingbird: it listens to your API and sings it back your way.

📖 **Documentation, with screenshots and a live demo:** https://varnica95.github.io/restless/

## Install

1. Get the code: `git clone https://github.com/varnica95/restless.git`, or **Code → Download ZIP** on GitHub and unzip it.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. **Load unpacked** → pick the `restless` folder (the one with `manifest.json`).
4. Reload any tab that was already open.

To update: `git pull` (or download again), then click ↻ on RESTless in `chrome://extensions`.

## Use

### Capture is off until you turn it on (per site)

RESTless doesn't capture anything on a site until you allow it. Open the panel and the Requests tab says **Recording is off for this site**, with **Record this site** (from now on) and **Record and reload** (so the calls made while the page loads are captured too). The choice is remembered per site (origin). While off, the site's `fetch`/XHR calls go straight to the browser: nothing is recorded, and rewrite rules, breakpoints and users (Send to / Send as) don't apply. Turn it off with the **Recording** switch above the list (the list stays; nothing new is recorded or changed until you turn it back on). Your own requests (new request, API Docs, Inspect) work either way.

Everything happens in one panel. It docks to the right edge by default; it can also dock left or float as a window.

| Action | What you get |
|---|---|
| Toolbar icon or **Ctrl+Y** (**Control+Y** on Mac too) | Show / hide the panel |
| Toolbar icon badge | The number of requests captured on this page (turn it off in **Settings → Advanced → Request count on icon**); turns orange (`‖2`) when calls are paused at a breakpoint and red `OFF` while the tab is offline, even with the count off |
| Settings → Appearance → Position | Dock right or left, or Floating window |
| Drag the panel's inner edge | Resize (remembered across sites). Floating: drag the header to move, the bottom-right corner to resize |
| **Esc** (inside the panel) | Go back one screen, or minimize |

The panel's state (open or minimized) is kept per tab, so a reload keeps it open; new tabs start minimized.

### Tabs

- **Requests**: every captured request as a list with fixed columns (**Status · Size · Time** always line up). Above it, three rows: **search** with **+** (New request) on its right; **Filters ▾**, **Errors N** and **Clear** with the view switch on the right; and the **status line**. Two views:
  - **View ▾** (right of the filters) switches between two views; it names the current one. **By endpoint** (default): one row per endpoint (method + path) with the latest call's status, size and duration, a **×7** count when it was called more than once (red when every call failed, amber when some are duplicates; the tooltip says how many failed, repeated or how often it polls). A status not in the API docs gets a dashed outline on its status pill (the tooltip says so). Click a row with several calls to expand them (time, query string, status, size, duration); a row with a single call opens it.
  - **Every call**: every call in time order, with a small clock line when the minute changes.

  The status line has the **Recording / Off** switch: Recording captures; Off keeps the list but records and changes nothing on this site until you click it again. Then the counts (*22 requests · 9 endpoints*, shortened in a narrow panel), and on the right three icons: **export**, **Keep after reload** (pin, purple when on) and **clear** (clears right away; rules and recorded clicks are kept). With nothing captured yet, only the status line and *Listening for requests* show. A call waiting at a breakpoint shows in a bar above the list, and the request tab strip appears (it's hidden while no request tab is open). Each row's **⋯** shows on hover or keyboard focus: **Hide from list** / **Show in list** (see below), **Export…**, **Compare with…** (see Compare) and **Copy as ›**. Copy as opens a small menu beside it (on hover, click, → or Enter; ← or Esc goes back), in two groups: *Request* (**URL**, **cURL**, **Fetch**, **Request body** when there is one) and *Response* (**Response body**, **TypeScript**). It opens on whichever side has room, below or above the menu in a narrow panel, or inside the menu when there's no room at all. Tags like *yours* and *rewritten* turn into icons when the row is short of room, so the path stays readable. To keep polling from piling up, each endpoint keeps its latest 50 calls, and only the latest 5 keep their response body.
- **API docs**: your OpenAPI / Swagger docs (see below).
- The panel header shows the logo and name, then on the right the **Send to / Send as chip** and the **Settings** gear. Under it, always visible, the main tabs: **Requests**, **Setup** and **API Docs**, each with its icon, name and count (the Rules count turns amber while a rule or breakpoint is on). Under those, the open request tabs.
  - **Send to / Send as chip** (always there): where your requests go and who they're sent as, in words: **● Staging · as Ana** (**○ Default** at first). Clicking it opens **Send to / Send as**. In a narrow panel, and in the small chip in front of a request's path, the user shows as an avatar (initials) instead. The avatar's ring takes the colour of the environment the user is the default for (grey for none); a **dashed ring** means the user isn't the selected environment's default (a mismatch, allowed); a red dot on it means the user's token has expired.  Click it to open **Send to / Send as**.
  - **Settings** (the gear, last on the right): opens Settings, titled *Settings*; the gear stays highlighted while you're there, and clicking it again goes back to the tab you came from. Settings has:
  - **Setup**: your variables and everything that changes this site's calls. A segmented control at the top switches between three views (← → keys too); the last one is remembered for the site.
    - **Variables**: one list. Each row: name, value, **↻** when it updates itself from a response (hover for which call), and **⋯** (Edit, Duplicate, Delete with Undo). Click a row to edit it in place (name and value); **+ Variable** adds one. **Duplicate** makes `name_2` and opens it. Empty: *Reuse values with {{name}} in requests.* and **+ Variable**.
    - **Buttons**: requests you turned into buttons on the items of a list (see *Buttons on list items*). A switch turns one off without deleting it; click a row to edit it; **⋯** has **Edit**, **Duplicate** and **Delete** (with Undo).
    - **Overrides**: mocks, rules and breakpoints in one list, in the order they apply (breakpoints and rules change real calls, mocks answer last; the ⓘ says so: Offline → rules → mocks). Each row: method, path (`→ new route` when a rule reroutes), a tag for what it does (`Mock 200`, `+2.0 s`, `Error 500`, `Edited 200`, `No response`, `Network failure`, `Rewrite`, `Breakpoint`, `once`) and a **switch** (off rows are dimmed). Rules and breakpoints: click a row to open the latest captured call; **×** (on hover) deletes it, with Undo. Mocks: click a row for **Edit mock**; **⋯** has Edit, Duplicate, Delete. The header shows the summary (*6 overrides · 4 on*), **+** (new mock endpoint) and **⋯ → Clear all rules and breakpoints** (mocks and variables stay; Undo). Rules and breakpoints are made from a request (⋯ → Change the app's call). Empty: *Mock endpoints or change real calls from a request's ⋯ menu.* and **+ Mock endpoint**.
    - The **Setup** tab's count turns amber while any override is on.
  - **Settings**: appearance, shortcuts, docking, per-site capture switch, stored data.

### Testing an endpoint the app doesn't call yet

On the Requests tab:

- **+** in the request tab strip (or double-clicking its empty space) opens an empty request (GET on this site). Type the full URL or a path in the route field; a pasted query string is moved into Params. On the Headers tab, **Use headers from…** copies the headers (including the login token) of a call the app already made, so the new endpoint is called as the logged-in user. **Send** shows the response; the request stays in the list tagged **yours**, with its last response, until you delete it (⋯ → Delete this request).
- **Import cURL**: on a new request, **⋯ → Import cURL…** replaces it with a curl command (DevTools → Network → right-click → Copy → **Copy as cURL**, bash or cmd, or one from Swagger/Postman/a colleague) and shows what it found before importing: method, URL, number of params and headers, body type, whether a login is included. Supported: `-X`, `-H`, `-d`/`--data*`, `--data-urlencode`, `--json`, `-F`, `-u`, `-G`, `-A`, `--url`, quoting with `'…'`, `"…"`, `$'…'`, and `\` or `^` line breaks. Things a page can't do (set cookies or Referer, upload files) are listed as warnings.

Requests are sent from the page, so the browser's CORS rules apply: another origin only works if its server allows it.

### API docs tab (OpenAPI / Swagger)

**Loading**: one row: the field, **Load**, and *choose a file*. Type or paste a **URL** (e.g. `https://localhost:5001/swagger/v1/swagger.json` for Swashbuckle, `/openapi/v1.json` for .NET 9+, `/v3/api-docs` for Springdoc; a `/path` uses the current API's host) or the **JSON** itself, or **drop a .json file** anywhere on the tab. Anything else shows *Not a URL or JSON* and Load stays off. Pasting a complete URL or valid JSON loads it right away; Enter loads a URL, Ctrl/⌘+Enter loads typed JSON. The usual docs URL is filled in, so often it's just Enter. Errors show right under the field. OpenAPI 3 or Swagger 2, in JSON (YAML gets a clear message to load the JSON version).

Loaded docs are kept for the site and come back on the next visit with no download. Docs too big to keep are saved as a link: they're downloaded again when the page loads if capturing is on for the site, otherwise only when you open the API Docs tab (if that fails, the loader shows with the address and the error).

**Above the list**, two rows:
- The API's name and version, the server picker (only when there's a real choice, see below) and **⋯**: **↻ Reload** (download again and show what changed), **Load API docs…** (opens the loader as a bar above the list, with Cancel), **Server URL…** (when the picker is hidden), **Remove**.
- One search and **Methods ▾**. The search covers path, method, summary, tag, operationId and the field names of request and response bodies at once. Path and method matches come first; matching body fields show under the endpoint, labelled **request** or **response**.

Under them, the count line is also the filter: *10 endpoints · 2 called · 8 not called* (and *· N deprecated* when the docs mark any); a count of zero isn't shown. Click **called** or **not called** to show only those, click again to clear. Filtered, it reads *N of 10 endpoints*, and **Clear** resets search and filters.

**Server**: where requests from the docs go. **Auto** (the default) looks at the calls the app already made and uses that server, including any path prefix (e.g. a gateway at `https://gw.example.com/tasks-service`), so docs copied from `localhost` while you test on dev or staging still call dev or staging; with no calls yet, docs that point to localhost go to the site you're on. The picker (**→ dev.example.com ▾**) shows next to the title only when the docs list several servers, Auto picked a different one than the docs list, or you set your own; otherwise use **⋯ → Server URL…**. The choice is kept for the site.

**The list**: endpoints grouped by tag. When most tags have a single endpoint, those get no header: the tag shows as a small label on the row instead; groups of two or more keep a collapsible header. Each row shows the path and, muted, the summary on one line (two lines in a narrow panel). An endpoint the app called on this page shows **called ×N**. Click an endpoint to open it as a new request: query params with their defaults, path params with sample values, a sample JSON body built from the schema (examples, enums, formats), and the headers (including the login) of the latest captured call to that API. It opens on the Requests tab; Back returns to API docs.

### What changed in the API

**New version available**: docs loaded from a URL are checked quietly in the background (when you open the API Docs tab, when the page gets focus again while you're on it, and every 5 minutes while the panel is open; at most once a minute, only where capturing is on, and the check isn't listed under Requests). When the version or an endpoint changed, a note appears above the list: *A new version of the API docs is available*, with the versions (e.g. `v1.4 → v1.5`) and how many endpoints changed, a **Refresh** button and ✕. The **API Docs** tab gets a small dot meanwhile, so you see it from any tab. **Refresh** does the same as ⋯ → Reload below. ✕ hides the note until the docs change again. Pasted or file-loaded docs have no link, so they aren't checked.

After **⋯ → Reload** on the API docs tab: if nothing changed, a short message says so. Otherwise a one-line **What changed** bar appears above the list: *3 changes · 2 breaking · View*, with copy and ✕. **View** expands it: the counts (**+N new**, **−N removed**, **~N changed**, **⚠ N breaking**), the versions (or the reload time) and the details:

- **New endpoints** are clickable and open as a new request.
- **A request opened from the docs** shows just its path (e.g. `/api/tasks`); the Send to / Send as chip in front of it says where it goes, and Run sends it to the environment you picked, not to the docs' server. Before the first Run, the Response area shows **From the API docs**: one chip per documented status (2xx first), the description and the documented example (or one built from the schema). Run replaces it with the real response.
- **Removed endpoints** are tagged **breaking**.
- **Changed endpoints** list the parameters, request body fields, response fields and documented status codes that were added, removed or changed (type, nullable, required, allowed values). An endpoint with a change that can break the frontend gets one **breaking** tag next to its path, and those lines are in red: removed response fields, type changes, new required request fields, response fields that became nullable.

Endpoints are tagged **new** or **changed** in the list. The copy icon puts the summary on the clipboard as text, ready to paste in Slack or Teams.

### JWT decoder

On the Headers tab, an `Authorization: Bearer …` row with a JWT gets a **shield** icon, coloured by expiry (green, amber under 5 minutes, red when expired; the tooltip says e.g. *Decode JWT (expires in 4 min)*). Click it to open the decoded token right under that row: who it is (email, name or subject), roles (including .NET `…/claims/role`, Keycloak `realm_access` and `groups`), scopes, **expires in 4 min** / **expired 12 min ago**, every claim with readable labels and dates, and the token header. Click the shield again to close it. It's decoded in your browser; the signature isn't checked.

For a **401** or **403** response, the Response tab says what the token looked like when the call was made: expired, or valid with these roles and scopes.

### Search and filters

The search on the Requests tab looks in the method and URL, and in request and response bodies, at once. URL matches filter the list as you type; below them, **In bodies** lists the calls whose request or response body contains the text (labelled *request* or *response*), with the JSON path of each match (`items[1].name = "Hyperloop study"`). Open one and its Response tab highlights the matches. Body results update 200 ms after you stop typing. Only the latest 5 calls per endpoint keep their body, so older calls can't be searched. **Ctrl+K** (**⌘K** on Mac) or **/** focuses the search when the panel was last clicked; Esc clears it.

**Filters ▾** has two sections: **Methods** (only the ones with calls, each with its count) and **Show only** (**Your requests**, **Changed by you**, **Duplicate calls**, **Slow (≥ 1 s)**, **Large (≥ 1 MB)**, **Hidden endpoints**). Only the ones that match at least one call are listed, so the menu stays short. The button shows how many are on. **Errors N** (4xx, 5xx and network failures) is its own chip, shown when there are any. **Clear** resets the search and every filter.

### Mock endpoints

Answer calls to an endpoint that doesn't exist yet (or that you want to fake), without the server: **create** a mock in API Docs, **manage** mocks in Setup → Overrides, **inspect** mocked responses in Requests. The app's own calls (fetch and XHR) get the mock in this browser tab, and so do your requests (Run, Bulk, API Docs). It works while RESTless is on; other browsers, server-side code and tools like Postman still reach the real server.

- **Create mock** (one form for creating and editing):
  - **Endpoint**: from API Docs it's filled in and shown as *GET /api/invoices/{id}* (**Change** makes it editable); from Setup you type the method and path. When the path has `{id}`, a short hint says it matches any value and can be repeated in the body.
  - **Response**: the status (GET, PUT and PATCH start at 200, POST at 201, DELETE at 204; from API Docs, the docs' success status) and the **body editor**, the main part of the form. From API Docs the body is already generated from the documented example or schema; **Generate example** regenerates it. Without docs it starts as a small JSON object to edit. 204 has no body.
  - `{id}` in the path matches any one value (`/api/invoices/{id}` answers `/api/invoices/42`); `{id}` in the body repeats it (`"id": "{id}"` → `"id": "42"`).
  - The body is checked as JSON before saving, with the line and the problem (*Invalid JSON on line 4: Expected double-quoted property name*).
  - **Advanced settings** (folded): **Response delay** in ms.
  - **Create mock** (Ctrl/Cmd+Enter) or **Cancel**. Editing says **Edit mock**, **Save changes**, and has **Delete** (with Undo).
- **API Docs**: hover an endpoint for **Mock** (always shown on touch screens). A mocked endpoint shows a **Mocked** badge in the same place (*Mock off* when switched off); click it to edit.
- **Setup → Overrides**: **+** creates a mock; each mock is a row with method, path, `Mock 200` (and the delay), a **switch** and **⋯** (Edit, Duplicate, Delete). Click a row to edit. **Duplicate** opens the form with the same response for another path. **Clear all rules and breakpoints** leaves mocks alone.
- **Requests**: calls answered by a mock carry the **Changed** tag (its tooltip says which mock; click it to edit the mock) and **Edit mock** in the row's ⋯. On the request screen the response shows **Source: Mock endpoint · Edit mock** (also for your own runs), and ⋯ has **Edit mock**.
- **Setup tab**: while any mock or override is on, the Setup tab shows how many, so you can see at a glance that something is changed.
- Precedence: **Offline** wins over everything, then a rule that simulates the real endpoint, then mocks. Mocks match the path on any host.
- Mocks are part of **Settings → Import & export** (Rules and breakpoints).

### Pinned endpoints

Pin the endpoints you keep coming back to and they stay at the top of the Requests list.

- **Pin to top**: hover a row and click the pin (just left of ⋯). Click it again to unpin. Each shows *Pinned GET /api/tasks* with **Undo**.
- You pin an **endpoint** (method and path), not one call: its new calls appear under the pinned row as they arrive.
- **Pinned** is a section at the top (with a count; click it to fold it), then **All requests**. A pinned endpoint moves up instead of showing twice. In the Timeline view the list stays in time order.
- Pins are saved per site, so they stay after a reload and after **Clear**. A pinned endpoint with no calls yet shows *No calls yet*; clicking it opens a new request to it.
- Search and filters apply to pinned rows too; when they hide some, the header says so (*Pinned · 2 hidden by search*).
- Pinned endpoints are part of **Settings → Import & export**.

### Send to / Send as (environments and users)

One sheet, from the header chip or the chip before a request's address. It lists your environments, each with **its own users** indented under it. Every user belongs to exactly one environment, takes its colour, and is only ever sent there. The environment picks where **your** requests go (Run, Bulk, requests opened from API Docs, Compare); the user under it picks who they're sent as. Nothing needs setting up: it starts with **Default** and the app's own login. The app's own calls never change server.

```
◉ ● Default        localhost:5173
     ◉ JS Josip S.      Current
     ○ PQ Petra QA      expires in 3 days
     + Add user
○ ● Development    dev-api.example.com      ⋯
     ○ AA Ana Admin                         ⋯
     ○ AC Ana Customer                      ⋯
     + Add user
○ ● Staging        staging-api.example.com  ⋯
     No users yet: requests go without a login.
     + Add user
+ Add environment
```

- **Environments**: **Default** is always first: your requests go where the app sends its own calls (the API origin it calls most, e.g. *api.example.com +1*; hover for the list). Then your environments, each a colour dot, a name and its address. Click an environment to pick it: requests then go out as the user you last picked there (or its first user). **+ Add environment** opens the card used to edit one: **Name**, **URL** and **Colour** (8 swatches). Only the URL is required; until you type a name or pick a colour, they follow the URL (*Staging*; production, staging, test and dev-like names start from red, amber, green and blue). **⋯** on an environment: **Edit** (or double-click the name) and **Delete**, which deletes its users too (**Undo** in the message brings both back). **+ Add N from API docs** appears when the docs list other servers.
- **Users**: Default always has the **current login**: the app's own login, named from its token and marked *Current* (just *Current* before one is captured). It can't be moved or edited. **+ Add user** under an environment opens a card: **Name** (optional: it follows the token, e.g. *Ana Admin*) and **Token** (header name, masked token with 👁; a JWT, `Bearer …` or a whole `Authorization: …` line). The preview shows the email and the expiry. Tick **Add current login** to use the app's latest token instead of pasting one; it's greyed out (*already in Development*) where that environment already has it, which Default always does. Click a user to pick it (its environment is picked with it). The second line shows the expiry only when it runs out within 7 days (*expires in 2 days*, amber) or has (*expired 3 h ago*, red), else the email. Picking an expired user shows *Requests as this user will get 401* with **Edit**. **⋯** on a user: **Edit** (the same card, name and token together), **Move to ▸**, **Copy to ▸** and **Delete** (with Undo). The current login's **⋯** has **Copy to ▸** only.
- **New environment**: the same **Add current login** checkbox adds the current login as the new environment's first user.
- **Moving and copying users**: drag a user onto another environment (the target lights up in its colour), or use **⋯ → Move to**. The user takes the new environment's colour everywhere at once (chip, avatars, Headers tab); **Undo** in the message moves it back. **⋯ → Copy to** puts a copy (same name, header and token) in another environment and leaves the original where it is; environments that already have that token are greyed out (*Already there*).
- **Scoped to the environment**: wherever you pick or send as a user, only the users of the environment the request goes to are used. The **Headers tab**'s first line is a picker of that environment's users (*Authorization · AC Ana Customer ▾ (Development)*, **Manage** opens the sheet); with no users there it reads *No login* with **Add user**. **Try with every user** sends as every user of that environment (on Default: the current login and Default's users). **Compare → another environment** sends as that environment's picked user. On an environment with no users, the app's own token is taken out, so it never reaches another environment (a token you typed into the headers yourself stays).
- **Safety**: a user's token is only sent to their own environment (and, for Default, this page and the app's API), never to other hosts the page calls. Saved users are only used for your requests: the app's own calls always keep their own login.
- Users saved by an older version are moved once to the environment they were the default (★) for, else to Default.
- Your runs are tagged **as <user>**, and Compare labels sides with their environment.
- Sending swaps the start of the address (any server the app calls, the docs' server or another environment) for the target's and keeps the path, query, body and headers. Calls to other hosts (third-party APIs) are left alone. Another server must allow calls from this page (CORS); if it allows the page but not its cookies, the request is retried once without cookies.
- Environments and users are saved per site, in this browser (localStorage).


**⋯ → Export…** (above the list, next to Clear) opens the export dialog for the calls shown (search and filters apply); a row's **⋯ → Export…** opens it for that call or endpoint. In the dialog, **Choose calls…** switches to selection: checkboxes appear on the rows, and the line above the list shows *N selected · Select all · Clear* with **Cancel** and **Export N**. Tick an endpoint row to take all its calls. Esc cancels.

The dialog is titled **Export N calls**, where N follows the Calls choice (*Export 1 call* for a single call):
- **Format** (first control, full width): **Postman** (Collection v2.1 `.json`), **HAR** (`.har`) or **cURL** (a `.sh` script), with one line under it saying where it opens: *Imports into Postman, Insomnia, Bruno, Hoppscotch* / *Opens in DevTools → Network, Charles, Fiddler* / *A shell script, one curl command per request*.
- **Calls** (second control): the latest call per endpoint (default) or every call, each with its count (*Latest (N)* in a narrow panel). **Choose calls…** sits under it.
- **Leave tokens out** (default on), for every format, with a one-line note: Authorization becomes `{{token}}` (Postman, empty value), `$TOKEN` (cURL) or `[hidden]` (HAR), so the file is safe to share.
- **More options** (Postman only, closed by default; open or closed is remembered): **Name** (defaults to the site's host), **Folders by resource**, **Use variables** (`{{baseUrl}}`) and **Save responses as examples**, each explained in its ⓘ.
- Buttons: **Download** is the main one for Postman and HAR; for cURL **Copy** is the main one and Download sits next to it. All choices are remembered per site.


- **Duplicates**: the app sent the same request (method, URL and body) again within 1 s. Usually a double fetch: React StrictMode runs effects twice in development, or two components load the same data. The endpoint's **×N** count turns amber and its tooltip says how many repeat (e.g. *3 calls, 2 duplicates within 1 s*); single calls get a small amber dot. Your own requests and calls from before a reload don't count.
- **slow**: the call took 1 s or more (its time is shown in red). **large**: the response is 1 MB or more.
- Duplicate, slow and large are in **Filters → Show only**, with counts.
- **Hide from list** (a row's ⋯): stops listing new calls to that endpoint (method + path, any query), for health checks, analytics, polling and other noise. The calls still go out as usual, and rules and breakpoints still apply to them; they just aren't listed. Calls already in the list stay, greyed out with a *hidden* tag. The choice is saved for the site, so it holds after a reload. **Filters → Hidden endpoints** shows the hidden endpoints, including ones with no calls left in the list (after a reload or Clear), and their ⋯ has **Show in list**. Both actions show a toast with **Undo**.
- **Select several**: **⋯ → Select…** above the list puts checkboxes on the rows. Tick calls or whole endpoints, then **Hide N** hides those endpoints from the list and **Show N** shows hidden ones again (both show when the selection has some of each); one Undo reverts the lot. **Export N** exports the ticked calls. With **Hidden endpoints** on, hidden endpoints with no calls listed can be ticked too. Esc or **Cancel** leaves selection.

### Testing tools (QA)

- **Offline (header).** The wifi button in the header makes every call the app makes fail, as if there's no internet — no throttling, just off. While offline it becomes a red **● Offline** pill (click it to go back online), RESTless's icon in Chrome's toolbar shows a red **OFF** badge, and affected calls carry an *Offline* tag. It applies to this browser tab only and stays on when the tab reloads (like DevTools' Offline), so you can test how the app starts without a network. Each switch shows a short message with Undo. Your own Run and Bulk still work. If capture is off for the site, going offline turns it on.
- **Try with every user** (request ⋯ → Send copies). Sends the request once as the app's login and once as each saved user, and lists the status for each: a quick permission check (e.g. Admin 200, Viewer 403). Users without a token or with an expired one are skipped; a user with the same token as the app is shown once. Click a row to see that response; **Copy as table** gives Markdown. Methods other than GET ask first. With no saved user in that environment the item is greyed out (*Add a user in Send to first*). Opening another tool closes these results.
- **Test edge cases** (request ⋯ → Send copies). Sends the request again with one field changed at a time — empty, spaces only, very long, emoji / right-to-left text, quotes and tags, wrong type, 0 / −1 / 1.5 / very large, null, missing, plus min/max length, range, allowed values and formats from the API docs when loaded, and an unknown extra field. Results are grouped by field: **✓ rejected** (4xx, what you want), **⚠ accepted** (2xx — maybe missing validation), **✕ crashed** (5xx or failed). The legend and *Only problems* (filters to ⚠ and ✕) appear once there are results; *Stop on first 500* (on by default) stops the run at the first crash. The chevron opens that exact request in a new tab. Up to 200 requests, 2 at a time; methods other than GET ask first.

### Request tabs survive a reload

The request tabs you have open come back when the page reloads, in this browser tab, with your work in them: the method, path, query, headers and body you edited, the Simulation draft, the sub-tab you were on (Query, Headers, Body), your last run's response, and which tab was active. The calls they belong to show in the list under *Before reload* (with Keep after reload on they're the same entries). Closing a tab means it won't come back; a new browser tab starts empty. Very large responses are dropped from what's kept, never your edits.

### Keep after reload

Turn on **Keep after reload** (**⋯ → Keep after reload** above the list; a dot on ⋯ shows it's on) and the captured requests stay when the page reloads or navigates within the site, like DevTools. Older calls are dimmed and listed under one **Before reload** line (in the grouped view: endpoints not called again since the reload; inside an expanded group, between its new and older calls). The request screen tags them **before reload**; a call still in flight when the page left shows as `interrupted`. The switch is saved per site; the log itself is kept per tab (`sessionStorage`), at most 300 calls, and very large bodies are dropped first. The trash button clears it.


### TypeScript types

**⋯ → Copy as › TypeScript** (and **Body as TypeScript**) on the request screen, and **Copy as › TypeScript** in a row's ⋯ menu. With API docs loaded, the types come from the schema (named schemas become interfaces, enums become unions, optional and nullable fields are kept); otherwise from the JSON itself, merging every item of a list so fields missing in some items become optional. Names follow the `operationId`, or the method and path (`GetTasksResponse`, `PostTasksRequest`).

### Request tabs

Every request you open gets a tab in a strip under the main tabs, so you can jump between them. A tab keeps its edits (params, headers, body, simulation, the response you ran) while you look at other requests or the list. The strip stays visible on **Rules** and **API Docs** too; clicking a tab there goes back to that request.

- The **Requests** tab (or ‹ / Esc) shows the list; the tabs stay.
- **Middle-click** a request in the list (or Ctrl/⌘+click) to open it in a new tab without leaving the list; the new tab flashes briefly. A request that already has a tab isn't opened twice.
- Opening a request that already has a tab switches to it. **Duplicate request**, **New request** (**+** at the right end, ⋯ → New request, or **double-click the empty part of the strip**) open a new tab.
- Close a tab with its **×**, a middle-click, or Delete when it's focused; the next tab takes its place. Deleting your own request closes its tab.
- At most 5 tabs by default (the counter shows `3/5`). Opening one more closes the least recently used tab (a paused call is never closed) and says which. Change the limit (1–20) in **Settings → Panel → Request tabs**.
- When the tabs don't fit, the strip scrolls sideways (mouse wheel works).

### The request screen

Click any request to open it; it opens in a request tab. Esc (or the **Requests** tab) goes back.

**Header**: one row: method (dropdown) · URL (editable, with the environment chip and a copy-URL button; without environments, a captured call's host shows muted in front of the path) · **Run** · **⋯**. At 400 px or narrower, Run and ⋯ move to a second row. The tab strip's `n/5` counter only appears once you're one tab away from the limit.

- **Run** sends the edited request yourself and shows the response below; the app doesn't see it (this was *Send copy*). Its tooltip is one line; with a Draft simulation it says Run previews instead. On a paused call it reads **Continue**, with **Send unchanged** and **Drop** in the bar under it.
- **⋯** is a short menu with three submenus (› opens them beside the menu; on a narrow panel they open just under the item):
  - **Duplicate request** (becomes your own request, tagged *yours*). **Add as a button…** puts this request as a button on each item of a list (see *Buttons on list items*). Pinning and hiding are list actions: they're on the row (pin icon, row ⋯ → Hide from list).
  - **Copy as ›**: *Request* (**URL**, **cURL**, **Fetch**, **Request body**, **Body as TypeScript**) and *Response* (**Response body**, **TypeScript**), copied as you see them here (with your edits, and the response that's showing).
  - **Send copies ›** (you send them; the app doesn't see these): **Run in bulk…**, **Try with every user…**, **Test edge cases…**.
  - **Change the app's call ›** (app's own calls only): **Simulate response…**, **Break on next call**, **Break on every call** (ticked when set; click again to turn off). While a breakpoint is on, the item's second line says so (*Breakpoint on: next call*) and the ⋯ button turns purple.
  - **Apply to app** (see below): one action; its subtitle says what it will do, e.g. *Re-runs “Search” on the page · keeps applying* or *Reloads the page · just once*.
  - Second lines only show state (*Open*, *Breakpoint on*); explanations are in the tooltips. Arrow keys move through the menu, → opens a submenu, ← or Esc goes back.
  - Your own requests have **Import cURL…** and **Delete request** instead of the breakpoints and the app items; Simulate response is greyed out for them.

**Edited bar**: when the request differs from the app's original call, one bar appears under the URL row: **● Edited** (hover for the list), **Reset** (back to the request as the app made it; a simulation keeps its own state in its card), the **Keep applying** / **Just once** switch and **Save**; once saved, **Saved · keeps applying · View in Setup**. Messages (Copied, Applied, a failed request…) appear as one compact line below it. There is no separate status row: status, time, size and age are in the Response header.

**Request**: **Query (n)**, **Headers (n)** and **Body** tabs. Query and Headers are editable tables: a checkbox per row (untick to leave it out of Run, rules and Bulk without deleting it), no header row, inline editing, and small icons on hover: edit, delete and, per row, duplicate-with-next-index, show/hide secret, decode JWT, copy. **Edit as text** keeps disabled rows as `// key:value` lines.

**Response** sits right below. Its header reads like `Response 200 OK · 13 ms · 205 B` (after a Run, your run's own figures; on a narrow panel just status and time, and Simulate becomes an icon), then the API docs check (an icon with a tooltip, plus a label such as *Matches docs* when there's room) and the call's tags (rewritten, dry run, simulated, delayed, as profile, before reload). Below: **Pretty** (an editor-style JSON view with line numbers and folding; hover a line for **Value** and **Key + value** copy buttons: Value copies strings without quotes and objects or arrays as formatted JSON, Key + value copies a `"key": value` fragment), **Raw**, **Preview** (HTML and SVG responses only, and the default view for them: the page rendered in a sandboxed frame, without scripts and without access to the page; relative links and images resolve against the request's address) and **Headers**, with **From: App | Your run** (when both exist), **Compare…**, **Wrap** and **Copy** on the right; when they don't fit on one row, Wrap and Copy move into a small ⋯ menu. **Compare…** lists only what works right now, in two groups, *Another response* and *Another environment*: **Previous call · 17:34:12** (the endpoint's previous call), **Your run** (after a Run), **Another call…** (pick it in the list, any endpoint) and, under *Same request, other environment*, each other environment (it sends the request there too). With none of these, there is no Compare button.

An error response (problem details) shows an **Error details** card. Its one visible button, **Copy error**, copies a short summary for a bug report; a field such as *traceId* gets its own copy icon when you hover it.

**Compare**: the comparison replaces the Response area, and the request form folds to one line (`GET /api/tasks?status=Done`, **Edit** to unfold it, **Run**). The tab is marked ⇄.
- **Ways in**: **Compare…** on a request page (2 clicks: Compare… → Previous call), or a list row's ⋯ → **Compare…** (3 clicks with the pick). Picking: the list's top row becomes the Compare header: **A** (the call you started from), ⇄, and a dashed **B · Pick a call below**, with *Any call, any endpoint. Expand a row for its earlier calls. Esc cancels.* Rows show **Pick as B** on hover.
- **Header row**: **[A chip] ⇄ [B chip] ✕**. Both chips are named the same way, *source · time* (App · 17:34:36, Your run · 17:35:02, Staging · 17:35:10, with a status dot); when two names would be the same, the chips show only what tells them apart (*status=Done* vs *status=Draft*). Clicking a chip lists everything it can show, grouped: *This endpoint* (the app's calls), *Picked in the list*, *Your run*, *Same request, other environment* (sends it there) and **Another call in the list…**. ⇄ swaps; ✕ or Esc closes.
- Under it: the count (*10 changes*) and **Fields | Lines** (Fields first; Lines is the detail).
- **Fields**: one list of changes in sections: **Request · 2** (method, server, path, query values, headers, body fields; *Same request* when nothing differs), **Response · 8** (status, then each JSON field as `old → new`; an added or removed object is one row, *+ items[2] · added · 4 fields*, that unfolds into its fields) and **Response headers · n** (only when headers other than Date differ). Identical responses: *✓ Identical · status, body and headers* (the request section still shows).
- Each response row has **⋯**: **Ignore items[].id** (*for this endpoint, on every item*: list positions don't matter) and **Copy path**. Ignored fields are left out of both views and remembered per site; *1 ignored · Show* at the end brings them back.
- **Lines**: the request differences folded into one line (*Request · 2 query status, header x-trace*), then the response body as a unified diff of the changed stretches only (*⋯ 3 unchanged lines* between them), with the changed part of each line highlighted.
- **Run** while comparing makes your run the B side. If another environment doesn't answer, the comparison still opens with *B didn't answer* (the reason, and the CORS hint), **Retry** and **Pick another B**.

**Simulate response…** and **Run in bulk…** (⋯ → Change the app's call / Send copies) open as their own card above the Response; the response stays visible below. The Simulation card closes (✕) only while it's Off. Closing Bulk stops a run in progress.

Details:

- **Query**: a Key / Value table. **+ Add parameter** adds a row, the duplicate icon copies a row with the next index (`filters[0].name` → `filters[1].name`), × removes it. Both tables keep their action icons in a fixed column, so they line up on every row. **Edit as text** / **Edit as table** sits at the right end of the Query / Headers / Body tab row; the tab labels carry the counts. When a request was opened from the API docs, **+ N optional** next to **+ Add parameter** adds the documented optional params it left out (hover for their names). **Edit as text** switches to one `key:value` per line:

  ```
  projectId:42
  pageNumber:1
  pageSize:20
  filters[0].name:Release
  filters[0].operator:contains
  ```

  The first `:` splits the key from the value, so values can contain `:` (times, URLs). `key=value` lines and a pasted `?a=1&b=2` query string or full URL also work. A line with no separator is flagged and ignored.
- **Body**: for POST/PUT/PATCH. Edit JSON, form data or raw text; JSON is coloured as you type (keys, strings, numbers, true/false, null). JSON typing helps: Enter keeps the indent (one more after `{` or `[`, and pressing Enter between `{}` puts the closing brace on its own line), typing `}` or `]` on an empty line steps back, pasted JSON comes in formatted (indented to where it lands, or the whole body when it replaces it), a pasted `"key": value` (from **Key + value**) lands at the cursor's indent with the commas around it fixed (into an empty body it becomes `{ "key": value }`), and the body is formatted when you leave the editor if it's valid JSON. Ctrl+Z undoes any of these. Under the editor, one line: the body type, **Format** and *valid JSON* (or the error).
- **Headers**: editable like Params: a Name / Value table with **+ Add header** and a remove (×) icon per row, or **Edit as text** with one `Name: value` per line. Icons on each row: **copy value**; for Authorization, tokens, cookies and API keys (masked until you click it) the **eye** to show or hide; for `Bearer …` values a **key** that copies just the token. Invalid header names are flagged, and headers browsers don't let pages set (Cookie, Host, Origin, Referer, Content-Length…) are marked as ignored. A saved rule sends exactly the headers in the table, so removing a row removes that header. Cookies the browser attaches on its own aren't visible to the page, so they don't appear here; a short note under the table says so. Response headers in the Response tab have Copy buttons too.
- **Response**: what the app received, with highlighted JSON (Raw/Pretty, Wrap, Copy) and response headers. After **Send copy**, this tab opens on your copy's response. Tabs at the top switch between **Copy** (your Send copy), **App** (what the app got) and **Compare**; each shows its status code, and ← / → move between them.
  - **Compare** (when there are two or more responses): pick **A** and **B** from App, Copy and earlier calls to the same endpoint, using the same dropdown as the status picker (each entry shows its status code; ⇅ swaps them). Two views, one at a time: **Summary** (JSON only, the default) lists each difference by path (`items[0].name  "Hyper" → "Test"`): amber for changed, green for only in B, red for only in A, plus a status change if any. **Code** is the line diff: **Unified** (one column, red − lines only in A, green + lines only in B) or **Side by side** (A on the left, B on the right, changed lines paired with the exact differing part highlighted). Both have line numbers; **Only changes** hides unchanged stretches behind "⋯ N unchanged lines". The layout you pick is remembered.

- **Simulate response** (**Simulate** in the Response header, or ⋯ → Change the app's call → Simulate response…; for the app's own calls) changes what the app gets back from this endpoint. It opens as a card above the Response. The card is the one place that shows the simulation's state, as a chip next to its title:
  - **Off**: the app gets the real response. The card is one row: the picker (*Pick what the app should get*). Only now can the card be closed (✕).
  - **Draft**: a fake answer is picked but not live; *Not live. The app still gets the real response.* Below the picker: **Delay**, the options of the chosen answer, **Keep applying | Just once**, and one button: **Apply** (with **Keep applying** it makes it live and has the app repeat the call now, so the Response shows what it got) (with **Just once** it waits for the app's next call and is used once).
  - **Live · keeps applying**: *The app gets this on every call. Changes apply right away.* Editing the answer, status, body or delay updates it at once. **Turn off**.
  - **Live · just once**: *Waiting for the app's next call. Used once, then off.* **Turn off**.
  - **Used**: the next call got it; the Response shows that call. *Used on the app's 16:24 call. The app gets the real response again.* **Arm again**.
  - **Turn off** (or picking Real response while live) goes back to Off and shows the app's last real response right away. The only message outside the card: *Simulation turned off · Undo*.
  Opening a call whose endpoint has a live simulation opens the card in that state.
  The picker lists **Real response**, **Edited response**, **Error · 400 Bad Request** … **Error · 504 Gateway Timeout** (one entry per status), **Network failure** and **No response**:
  - **Edited response**: the server's data in an editor, ready to change. When there's no real response yet, or the call failed (4xx/5xx), and the API docs describe this endpoint, it starts from the docs' success example and status instead (*Filled in from the API docs' example*); **Use the docs' example** switches to it at any time. Above it: the **status** (200, 201, 202, 204) and **type** (JSON, Text, HTML) on the left; the JSON check, **{ } Format** and **↺ Real data** on the right.
  - **Error**: the app gets a standard error object (*Standard error body · Edit body* to change it).
  - **Network failure**: as if the server can't be reached (fetch rejects with "Failed to fetch", XHR fires its error event).
  - **No response**: the call never answers, so the app keeps loading (aborting still works).
  **Delay**: No delay, +1 s, +3 s, +10 s or Custom… in ms, with any answer.
  **Run** in Draft previews what the app would get. Nothing is sent: the Response gets a dashed purple outline, a **Preview** label, *Nothing sent* and **Clear**. Otherwise Run sends the request as usual.
  One **Changed** tag marks it everywhere (it also covers rewrites and mocks; hover for which): on the endpoint in the list (hover for what the app gets), on each call that got a fake answer, in the Response header, and on the rule in Rules (next to *Error · 500 · every call*). The Edited bar is only about edits to the request; Reset and Save leave the simulation alone (a live simulation stays in the rule). Continue on a paused call sends it with the card's setting.

- **Bulk**: send the request many times, each with generated data, e.g. create 15 tasks with different names and statuses in one go. Requests go to the real server; the app doesn't see them.
  - The table lists the JSON body's fields (or the query params when there's no body), each with a **value for each request**. A plain value stays the same every time; `{{placeholders}}` change per request.
  - Lists stay lists: a list of plain values or empty objects (`"tags": ["a","b"]`, `"groups": [{}, {}]`) is one field holding the whole JSON array, sent as a collection, and you can edit it as JSON (placeholders work inside it). In a list of objects with fields, each value is its own field (`members[0].email`), and each item gets a different generated person.
  - **✨ Vary all** fills in sensible values from each field's name, type and the API docs: `Write release notes {{i}}`, `{{name}}`, `{{email}}`, `{{uuid}}` for ids, `{{cycle:Draft|Active|Done}}` for enums, `{{datetime}}` for dates. The ✨ on a row does the same for one field; **↺ Reset** goes back to the request's own values.
  - Placeholders (type `{` in a value to pick one from a list; ↑/↓ and Enter or Tab insert it, and for `int`, `pick` and `cycle` the part to edit is selected): `{{i}}` (1, 2, 3…; `{{i:100}}` starts at 100), `{{name}}`, `{{firstName}}`, `{{lastName}}`, `{{email}}` (matches the name), `{{phone}}`, `{{city}}`, `{{company}}`, `{{word}}`, `{{words:3}}`, `{{sentence}}`, `{{uuid}}`, `{{int:1-100}}`, `{{number:1-100}}`, `{{bool}}`, `{{date}}`, `{{datetime}}`, `{{now}}`, `{{pick:A|B|C}}` (random) and `{{cycle:A|B|C}}` (in turn). An empty option (`{{cycle:A|B|}}`) sends an empty value, handy for testing validation. Numbers and booleans keep their JSON type.
  - **Query params as placeholders**: `{{projectId}}` copies the value of this request's `projectId` query param (the name isn't case-sensitive; `{{param:projectId}}` is the explicit form). Params are listed first when you type `{`. A placeholder that is neither a generator nor a param is sent empty, shown as — in the table, with a warning naming it.
  - **Requests** is an editable table of every request that will be sent, one column per changing field (**All fields** shows every field). Values are generated once and kept, so what you see is exactly what's sent; **↻ New values** generates fresh ones. Click any cell to change it, e.g. an id that doesn't exist in this database (edited cells turn amber and keep their JSON type; Enter saves, Esc cancels). Empty values show as —. To skip some requests, click **Select rows** and untick them. **Raw** shows the same requests as JSON, exactly the bodies (or URLs) that will be sent, with a copy button. Edits survive new values and count changes; **↺ Clear edits** undoes them.
  - At the top: how many requests (up to 500), a **One by one | 5 at a time** toggle, and **▶ Run N** (N leaves out skipped rows; it reads **Stop · 3/10** while sending). Results appear right under it.
  - Everything else (the parameter table, Vary all, Reset, Table/Raw, Select rows, New values, All fields and the help text) is under **Customize values**, closed by default.
  - Results: a summary (`201 × 9`, `400 × 3`, average time, **Copy results** as JSON) and one row per request with the values sent, the new id or the validation error, status, size and time. Click a row to see what was sent and what came back. An error shared by several requests (e.g. the server can't be reached) is shown once at the top instead of on every row.

Edits are kept while you switch tabs.

**The Edited bar under the URL row** is the one place for anything contextual, so nothing else stacks up above the tabs:

- When something differs from the app's original call it shows what changed (e.g. "✎ Changed: params, delay"), a switch and a save button. **Keep applying** (on, the default): **Save** keeps rewriting every matching call until you remove the rule in Setup. **Just once** (off): only the next matching call is rewritten. **Apply to app** follows the same switch, and so does the Simulate card (**Keep applying** / **Just once**). Rules replace the whole query string, so a lasting rule also overrides filters you later change in the app.
- After saving it shows "Saved · keeps applying" (or "Saved · just once") with **View in Setup**; it shows that too when you open a call a lasting rule already rewrote.
- Messages (Applied, Copied, a failed request…) appear in the same bar with their action on the right, and an **✕** to dismiss.

**Breakpoints (pause before send)**: in ⋯, **Pause the next call** or **Pause every call** to this endpoint. When the app makes that call, it's held: the panel opens on it (even if minimized) with a "Paused" banner, and the app keeps waiting. Edit anything (route, params, headers, body, Simulate), then use the buttons in the header:

- **Continue**: sends it with your edits (and any simulation). With no edits, it goes through as it was.
- **Send unchanged**: lets the original through; saved rules still apply.
- **Drop**: cancels it; the app gets a network error.

If several calls are paused, deciding one opens the next. If the app gives up on a call (abort), it's released. Breakpoints are listed in **Setup → Overrides**, where you can switch them off or remove them. Synchronous XHR can't be paused.

Actions, in the request screen's header next to **‹ All requests**:

- **Apply to app**: saves the change and gets the app to repeat the call, so the page shows the result. It's greyed out (*Nothing to apply yet. Edit the request first*) until the request differs from the app's call or a simulation is live. It picks how by itself, and the menu says which before you click: It's also under **Save ▾ → Save and apply to app** in the edit bar.
  - **The call came from a button or field** (*Re-runs “Search” on the page*): it re-runs that (clicking the button, or replaying the search input or dropdown change), or else sends focus/visibility events that make React Query, SWR and similar libraries refetch. The page keeps its state. If the app still doesn't repeat the call, a toast counts down *Reloading in 3 s* with **Cancel** (the change stays saved either way).
  - **The call happened while the page loaded** (or on a timer; *Reloads the page*): a quick refetch nudge, then the page reloads. Rules apply before the app's first call, so the reloaded page gets the change; your open request tabs come back.
  - Afterwards one line says what happened: *Applied: re-ran “Search”*, *Applied: the app refetched*, or the reload.
- **Send copy**: sends the edited request yourself and shows the response in the Response tab. The app doesn't see it.
- **⋯**: **Pause the next call** / **Pause every call** (breakpoints), and **Save and reload page** for calls the app only makes on page load.
- The **copy icon** at the end of the route row: **Copy as cURL** or **Copy as fetch**.

### Settings

Changes save right away; a small **✓ Saved** confirms each one. Each row has its label on the left, the control on the right and a short description below.

- **Appearance**: **Theme** (Light, Dark (default) or System), **Position** (Left, Right (default) or Floating; a panel docked top or bottom in an older version moves to the right), **When docked** (Push aside (default) or Overlay; the ⓘ explains; hidden while Floating). Push aside also moves the page's fixed parts that would sit under the panel, which a margin on the page can't reach: full-width bars and backdrops get narrower, drawers, side sheets and toasts against that side move over, and centred dialogs move to the middle of what's left. Elements that animate their own position are only moved through their margin, so their animations keep working. It's rechecked as the page changes, and everything goes back when the panel closes or switches to Overlay.
- **Shortcut**: **Show / hide** with the current key (default **Ctrl+Y**, Control+Y on Mac too) and **Change ↗** (opens `chrome://extensions/shortcuts`; managed by Chrome, so it works on any page; "Not set" if another extension took it). Chrome keeps a shortcut you already had when the extension updates; the new default applies to new installs, or set it under Change ↗.
- **Import & export**: one JSON file, `restless_settings_<date>_<time>.json` (e.g. `restless_settings_2026-11-18_09-41-07.json`).
  - **Export…** opens a dialog with what's here, counted: **Environments and users** (*3 environments (with Default) · 4 users*), with **Include tokens** under it (on; *Anyone with the file can send requests as these users*; off saves users without their tokens), **Rules** (rules, mock endpoints and breakpoints), **API docs** (the loaded docs, or their link when they were too big to keep), **Stopped endpoints** (Stop capturing) and **Pinned endpoints**. Empty parts are greyed out. The file name is shown before **Export**. Captured requests and the panel's own settings aren't included.
  - **Import…** picks a file and shows what's in it (*exported Nov 18, 2026, 09:41*, and from which site when it's another), each part ticked, and **How**: **Add to what's here** (default: environments with the same id or URL, users with the same id, and rules for the same endpoint are updated; a user whose token is already in that environment isn't added twice; nothing is removed) or **Replace what's here** (each ticked part is replaced by the file's). API docs always replace the current docs. Users imported without a token show *no token*; Edit adds it. **Import** shows *Imported 2 environments, 4 users, 2 rules, API docs, 1 stopped endpoint* with **Undo**, which puts everything back as it was. A file that isn't a RESTless settings file is refused with a message.
- **Advanced** (collapsed): **Max open tabs (1–20)** (default 5), **Request count on icon**, **Recorded clicks on host → Forget recorded clicks** (which button made which call, used by Apply to app), and **Reset to defaults**, which asks first, then restores the settings above and turns Keep after reload off for this site. Rules, profiles, environments, captured requests and the capture switch are kept.

The recording switch for the site is above the request list (**Recording / Off**) and on the *Recording is off* screen. Keep after reload is in the list's **⋯**.

Appearance settings sync through Chrome and apply on every site.

### Variables

Use `{{name}}` in a request's path, query params, headers or body, and RESTless fills it in when the request is sent.

- **Where they live:** **Setup → Variables**: one list for this site, the same whichever environment you send to. Click a row to edit it (name and value); **⋯** has **Edit**, **Duplicate** and **Delete** (with Undo); **+ Variable** adds one. (0.90's per-environment variables are merged into the list when you update, unless the name already exists.)
- **Typing:** `{{` opens a list of variables with their values and the built-ins, filtered as you type; ↑ ↓, Enter or Tab, Esc. In the body, `{{names}}` are purple, or red when they have no value. A path with variables shows where it really goes (`→ /api/tasks/148`) under the field; params and headers show it in a tooltip and get a red outline when a variable is missing.
- **Sending:** if a `{{name}}` has no value, **Run** stops and says which one, with **Add variable** and **Send anyway** (sends the `{{name}}` as written). In a JSON body a variable inside a string is escaped for JSON; a bare one (`"id": {{taskId}}`) goes in as a number, true/false/null or JSON when its value is one, else as a string. The body check accepts bare variables (*valid JSON (with variables)*). **Duplicate request** keeps the `{{names}}`. **Send many** placeholders can use your variables too.
- **Built-ins:** `{{$uuid}}`, `{{$timestamp}}` (Unix seconds), `{{$now}}` (ISO date and time), `{{$randomInt}}` (0–1000).
- **Chaining (Save as…):** hover a line of a JSON response on the request screen: next to **Value** and **Key + value** there's **Save as…**. Name it (from the key) and keep **Update from every response of METHOD /path** on to have it follow that endpoint. Then every successful response from it (your **Run**, or the app's own calls) updates the value, and Run says *Updated {{taskId}}*. The variable's row shows where it updates from (`↻ POST /api/tasks · id`); edit it to **Stop updating**.
- **Saved** for this site, and part of **Settings → Export / Import** (with environments and users).

### Buttons on list items

One-tap buttons on each item of a list (*Open task*, *Archive*), so you can try an endpoint on any row without building UI for it.

**Make one (2 taps):**
- **From a list:** open the list call in Requests → Response → **Items**. With no buttons yet, the first item has a dashed **+ Add button**. Tap it, then **Add button**. RESTless picks what it sends: a call you already made to one of these items (`/api/tasks/2/archive`), an API docs endpoint under the list, or else opening one (`GET /api/tasks/{id}`).
- **From a request:** after a successful **Run** of a request with an id in its path, a note asks *Make this a button on each task?* Tap **Add**, then **Add button**. (**✕** hides it for that endpoint.) **⋯ → Add as a button…** does the same at any time.

The dialog has a name (prefilled; leave it or change it), where it goes (*On each task of /api/tasks*) and one sentence of preview: *Pressing it on "Hyper" sends GET /api/tasks/1.* Values are matched for you: an id that equals a field of the items (or has its name) comes from the item, a value in the list's address from the list call, the rest stays as it is. Only what it couldn't match is shown (*Which field is this?*).

**Customize** has everything else: what it sends (from a list) or which list it goes on (from a request), every part and where it comes from (this item's field, the list call, a variable, or a fixed value), the full request, and two options: **Ask before sending** (on for DELETE) and **Refresh the app's list after** (on for anything but GET).

After **Add button** you land on the list's Items, where the new button pulses on the first item, with a one-time tip: *Tap to try it on "Hyper"*. Pressing a button sends the request like **Run** (active environment and user, `{{variables}}` filled), shows the status on that row and a note with **Open** (the exact request). More than two buttons collapse into **▾**, which also has **Add a button…**.

No list loaded yet? The dialog offers **Load the list now** (it loads `/api/tasks` for `/api/tasks/2`). **Setup → Buttons** is for managing them (switch, edit, duplicate, delete); empty, it has **Try an example**, which starts from your most recent list.

## How it works

- `core.js` runs in the page's main world at `document_start` and wraps `fetch` and `XMLHttpRequest`. Native form submits are recorded too.
- A request that starts within 2 s of a click, input, change or submit is linked to that element, along with how it was triggered. The link is saved in `localStorage` (a structural path + visible text), so the next Alt-hover works even after a reload.
- Tables: the text in the hovered table or list is matched against recent response bodies.
- Rules (`method + origin + path` → replacement query params and/or body) are kept in the site's `localStorage`, so they apply synchronously before the app's first request on load.
- The picked user (Send to / Send as) only signs your own requests (Run, Bulk, API Docs, Compare); the app's own calls always keep their own login.

## Limits

- **Apply to app** re-runs the button that made a call, so that button must have been clicked once on this page.
- Requests from service workers, WebSockets, `navigator.sendBeacon`, and cross-origin iframes the extension can't access aren't captured.
- Rules don't rewrite native (non-JS) form submissions.
- Clearing site data removes the rules, capture settings and recorded clicks.
- Apply to app doesn't re-run checkboxes or radio buttons, because clicking them would toggle your filter off. Those fall through to the focus events, then the reload countdown.

## Demo

```
node demo/server.js   # http://localhost:5173
```

A registration form (JSON POST) and a task table loaded with `projectId`, `status` and `filters[0].name`, with a search box, a status dropdown, and a refetch when the tab becomes visible.
