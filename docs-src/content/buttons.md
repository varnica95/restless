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

**From a list:** open the list call in **Requests**, then **Tools ▾ → Buttons**. Tap the dashed **+ Add button** on the first item, then **Add button**.

**From a request:** after a successful **Run** of `/api/tasks/1` (any request with an id in its path), tap **Add** on *Make this a button on each task?*, then **Add button**. Or use **Tools ▾ → Buttons**

**Change…**, next to the request, picks any endpoint: the ones that fit the list, every API docs endpoint, and the calls you've made, with search. The parameters fill in from the list.

The dialog has the **Button name**, the **Data source** (the list it goes on) and the **Request**: its method and path, then **Parameters**, each value with where it comes from (`stepId → item.id`). The full body is folded under **Request body**. An **amber** value is one RESTless couldn't place: check it.

## Choose a value

Tap a value:

- **From data**: a field of each item (`item.id`, `item.number`, `item.title`…), with a sample.
- **Custom value**: type it, e.g. `123`. In a JSON body `5` stays a number, `true` a boolean; anything else is text.
- **Ask each time**: the button asks for it when you press it, with the last answer filled in. Saved as `{{ask.status}}`.

Switching between the two keeps both until you close the dialog.

## Query parameters

- **+ Add query parameter**: type a name; if the items have a field with that name, it's used.
- **×**: don't send this one (**Restore** brings it back).
- **Optional** (for values from data): left out when the item has no value, instead of not sending the request. Saved as `{{item.status?}}`.

## Try it

You land in the list's **Buttons** (Tools ▾); **← Request** goes back. The new button pulses on the first item. Tap it: the status shows on that row, and **Open** in the note opens the exact request. Click the status to see the response under the row; an error opens by itself.

- **DELETE** buttons ask before sending.
- Any button that isn't a GET makes the app load its list again after it works.

## Pages and parents

A button belongs to the list's path, with ids as "any id": it shows on page 2, with other filters, and on `/projects/8/tasks` when you made it on `/projects/7/tasks`.

## No list yet?

The dialog offers **Load the list now**. In **Setup → Buttons**, **Try an example** starts from your most recent list.

## Many buttons

Each row shows one button: the one you used last, or the one you keep there. **▾** next to it, with the number of others, lists the rest grouped by method (**Open**, **Change**, **Delete**), each with its path. With more than 7 there's a search box.

## Run on several

Tick the items (Shift+click ticks a range, the box above the list ticks all), then press **Archive on 4** in the bar (▾ for another button).

- It sends for each one after another. Each row shows its status.
- The bar shows how it went (*Archive: 3 ✓ · 1 ✕*), with **Retry failed** for the ones that didn't work.
- Asked values and the DELETE confirmation come once for all of them.

## One item

Opening one item, like `GET /api/tasks/2`, offers Buttons in Tools ▾ too, with its list's buttons for that item.

## Review and send

To send different values just once: **▾ → Review and send…**, the eye next to any button in **▾**, or **Shift+click** the button. The box shows the request for that item with its values filled in, and the request body. Change what you need, then **Send** (Ctrl+Enter). **Reset** puts the item's values back. Nothing is saved to the button.

- Values the button asks for each time are fields in the same box.
- **Review before sending** in the button's dialog opens this box on every press.

## Manage them

**Buttons (20) ▾** above the items lists every button, with search: click one to edit it, the **pin** keeps it on the rows, the **bin** deletes it, and **Add a button…** is at the end. **Setup → Buttons** lists every button: click one to edit it, **⋯** to delete it.
