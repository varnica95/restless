---
title: Buttons
lead: Turn a request into a button on each item of a list, and run it for one row with a click.
---
## Make a button

1. Open a request: one the app made, one from **API Docs → Try it**, or your own. Make it work for one item, e.g. `POST /api/tasks/1/archive`.
2. Choose **⋯ → Add as a button…**
3. Name it and pick **On the items of**: the list it belongs to. RESTless offers recent GET calls that return a list, and list endpoints from the API docs.
4. Check **Fill from**: where each id, query value or body field comes from.
5. Press **Add button**.

## Where the values come from

- **This item**: any field of the row, nested too (`assignee.id`).
- **The list call**: ids and query values in its address, like `list.projectId` from `/api/tasks?projectId=42`.
- **Variables**: a `{{name}}` from Setup → Variables.
- **Fixed value**: the same for every item.

RESTless fills these in for you. An id that matches a field of the items, by value or by name, comes from the item. A value in the list's address comes from the list call. Everything else stays fixed. The **Preview** shows the exact request for the first item.

> **Tip:** hardcode only what never changes. Use the list call or a variable for ids that change between pages, projects or environments.

## Use it

Open the list call in **Requests**. Its response opens on **Items**: one row per item, with your buttons. Pressing one sends the request like **Run** does, with the active environment, user and variables. The status shows on that row, and **Open** in the note opens the exact request.

- **Ask before sending** confirms first (on by default for DELETE).
- **Refresh the app's list after** makes the app load its list again after a success, so you see the change on the page.

## Manage them

**Setup → Buttons**: switch a button off, click it to edit, or use **⋯** to duplicate or delete it.

> **Good to know:** buttons are saved for this site. They show inside RESTless, not on the app's page.
