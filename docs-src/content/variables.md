---
title: Variables
lead: Reuse values like IDs and tokens with {{name}}, and chain requests.
---
[[shots: variables | Variables on the Rules tab]]

## Use a variable

Type `{{name}}` in a request's path, query params, headers or body. Typing `{{` lists your variables.

- A variable with no value turns red, and **Run** asks before sending.
- In a JSON body, `"id": {{taskId}}` and `"note": "Task {{taskId}}"` both work.
- Built-ins need no setup: `{{$uuid}}`, `{{$timestamp}}`, `{{$now}}`, `{{$randomInt}}`.

## Global or per environment

- **Global** variables work everywhere.
- An **environment's** own variables apply while you send there, and win over a global one with the same name.

Manage them under **Rules → Variables**: click one to edit it, or use **⋯** to move, copy or delete it.

## Chain requests

1. Run a request, then hover a line of the JSON response.
2. Click **Save as…**, name it and press **Save**.
3. Use `{{name}}` in the next request.

With **Update from every response** on, the variable follows that endpoint: your runs and the app's own calls keep it current.

> **Good to know:** variables are saved for this site and included in **Settings → Export**.
