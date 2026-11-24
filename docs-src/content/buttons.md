---
title: Buttons
lead: One-tap buttons on each item of a list. Two taps to make one.
---
## Make a button

**From a list:** open the list call in **Requests**, then **Items** in its response. Tap the dashed **+ Add button** on the first item, then **Add button**.

**From a request:** after a successful **Run** of `/api/tasks/1` (any request with an id in its path), tap **Add** on *Make this a button on each task?*, then **Add button**. Or use **⋯ → Add as a button…**

The dialog shows the name (prefilled) and what pressing it does: *Pressing it on "Hyper" sends GET /api/tasks/1.* If RESTless can't tell where a value comes from, it asks: *Which field is this?*

## Try it

You land on the list's **Items**. The new button pulses on the first item. Tap it: the status shows on that row, and **Open** in the note opens the exact request.

## Customize

Under **Customize** in the dialog:

- **It sends** (from a list) or **On the items of** (from a request).
- **Fill from**: for each id, query value or body field, a field of the item, a value from the list call (`list.projectId`), a variable, or a fixed value.
- **Ask before sending**: on by default for DELETE.
- **Refresh the app's list after**: on by default for anything but GET.

> **Tip:** use the list call or a variable for ids that change between pages, projects or environments; fix only what never changes.

## No list yet?

The dialog offers **Load the list now**. In **Setup → Buttons**, **Try an example** starts from your most recent list.

## Manage them

**Setup → Buttons**: switch one off, click it to edit, or **⋯** to duplicate or delete it.
