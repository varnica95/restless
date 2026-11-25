---
title: Buttons
lead: One-tap buttons on each item of a list. Two taps to make one.
---
## What a button is

A request with `{{item.x}}` placeholders, for example:

```
POST /api/steps/{{item.id}}/complete
{ "taskId": {{item.taskId}}, "subtaskId": {{item.subtaskId}} }
```

Pressing it on a step fills each placeholder from that step's object in the list response. Your `{{variables}}` work too; everything else is sent as written.

## Make one

**From a list:** open the list call in **Requests**, then **Items** in its response. Tap the dashed **+ Add button** on the first item, then **Add button**.

**From a request:** after a successful **Run** of `/api/tasks/1` (any request with an id in its path), tap **Add** on *Make this a button on each task?*, then **Add button**. Or use **⋯ → Add as a button…**

The dialog has the **Button name**, the **Data source** (the list it goes on) and the **Request**: its method and path, then **Parameters**, each value with where it comes from (`stepId → item.id`). The full body is folded under **Request body**. An **amber** value is one RESTless couldn't place: check it.

## Choose a value

Tap a value:

- **From data**: a field of each item (`item.id`, `item.number`, `item.title`…), with a sample.
- **Custom value**: type it, e.g. `123`. In a JSON body `5` stays a number, `true` a boolean; anything else is text.

Switching between the two keeps both until you close the dialog.

## Try it

You land on the list's **Items**. The new button pulses on the first item. Tap it: the status shows on that row, and **Open** in the note opens the exact request.

- **DELETE** buttons ask before sending.
- Any button that isn't a GET makes the app load its list again after it works.

## Pages and parents

A button belongs to the list's path, with ids as "any id": it shows on page 2, with other filters, and on `/projects/8/tasks` when you made it on `/projects/7/tasks`.

## No list yet?

The dialog offers **Load the list now**. In **Setup → Buttons**, **Try an example** starts from your most recent list.

## Manage them

**Buttons ▾** above the items: **Edit**, **Delete** or **Add a button…**. **Setup → Buttons** lists every button: click one to edit it, **⋯** to delete it.
