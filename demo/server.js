// Demo backend for trying RESTless: `node demo/server.js` then open http://localhost:5173
// It behaves like a small ASP.NET API: Swagger at /swagger/v1/swagger.json and ProblemDetails errors.
const http = require('http');
const fs = require('fs');
const path = require('path');

const TASKS = [
  { id: 1, name: 'Hyper', status: 'Draft', owner: 'Ana' },
  { id: 2, name: 'Hyperloop study', status: 'Draft', owner: 'Ivan' },
  { id: 3, name: 'Test', status: 'Draft', owner: 'Marko' },
  { id: 4, name: 'Test automation', status: 'Draft', owner: 'Petra' },
  { id: 5, name: 'Rollout', status: 'Active', owner: 'Luka' },
];
// Deliberate drift from the spec, to show the schema check: the spec says every task has a dueDate,
// and task 6 has no owner although the spec says owner can't be null.
const extraTask = { id: 6, name: 'Retro', status: 'Done', owner: null };

const traceId = () => `00-${[...Array(32)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')}-${[...Array(16)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')}-00`;

const SPEC = {
  openapi: '3.0.1',
  info: { title: 'Tasks API', version: '1.4' },
  paths: {
    '/api/tasks': {
      get: {
        tags: ['Tasks'], summary: 'List tasks', operationId: 'GetTasks',
        parameters: [
          { name: 'projectId', in: 'query', schema: { type: 'integer', format: 'int32' } },
          { name: 'pageNumber', in: 'query', schema: { type: 'integer', format: 'int32', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', format: 'int32', default: 20 } },
          { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/TaskStatus' } },
        ],
        responses: { 200: { description: 'Success', content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskPage' } } } } },
      },
      post: {
        tags: ['Tasks'], summary: 'Create a task', operationId: 'CreateTask',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateTaskRequest' } } } },
        responses: {
          201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Task' } } } },
          400: { description: 'Bad Request', content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ValidationProblemDetails' } } } },
        },
      },
    },
    '/api/tasks/search': {
      post: {
        tags: ['Tasks'], summary: 'Search tasks', operationId: 'SearchTasks',
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskSearch' } } } },
        responses: { 200: { description: 'Success', content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskPage' } } } } },
      },
    },
    '/api/tasks/{id}': {
      get: {
        tags: ['Tasks'], summary: 'Get one task', operationId: 'GetTask',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', format: 'int32' }, example: 3 }],
        responses: {
          200: { description: 'Success', content: { 'application/json': { schema: { $ref: '#/components/schemas/Task' } } } },
          404: { description: 'Not Found', content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } },
        },
      },
    },
    '/api/tasks/{id}/archive': {
      post: {
        tags: ['Tasks'], summary: 'Archive a task (new, not in the UI yet)', operationId: 'ArchiveTask',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer', format: 'int32' } }],
        responses: { 204: { description: 'No Content' } },
      },
    },
    '/api/reports/summary': {
      get: {
        tags: ['Reports'], summary: 'Counts per status (new)', operationId: 'GetSummary',
        parameters: [{ name: 'from', in: 'query', schema: { type: 'string', format: 'date' } }],
        responses: { 200: { description: 'Success', content: { 'application/json': { schema: { $ref: '#/components/schemas/Summary' } } } } },
      },
    },
    '/api/projects/close': {
      post: {
        tags: ['Projects'], summary: 'Close a project', operationId: 'CloseProject',
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/CloseProjectCommand' } } } },
        responses: {
          200: { description: 'Success', content: { 'application/json': { schema: { type: 'object', properties: { closed: { type: 'boolean' }, projectId: { type: 'integer' } } } } } },
          400: { description: 'Bad Request', content: { 'application/json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } },
        },
      },
    },
    '/api/admin/audit': {
      get: {
        tags: ['Admin'], summary: 'Audit log (Auditor role)', operationId: 'GetAudit',
        responses: { 200: { description: 'Success' }, 403: { description: 'Forbidden', content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } } } },
      },
    },
    '/api/notifications': {
      get: {
        tags: ['Notifications'], summary: 'Poll notifications', operationId: 'GetNotifications',
        parameters: [{ name: 'since', in: 'query', schema: { type: 'integer' } }],
        responses: { 200: { description: 'Success', content: { 'application/json': { schema: { $ref: '#/components/schemas/NotificationPage' } } } } },
      },
    },
    '/api/register': {
      post: {
        tags: ['Account'], summary: 'Register', operationId: 'Register',
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } } },
        responses: {
          201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterResult' } } } },
          400: { description: 'Bad Request', content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ValidationProblemDetails' } } } },
        },
      },
    },
  },
  components: {
    schemas: {
      TaskStatus: { enum: ['Draft', 'Active', 'Done'], type: 'string' },
      Task: {
        required: ['id', 'name', 'status', 'owner', 'dueDate'], type: 'object', additionalProperties: false,
        properties: {
          id: { type: 'integer', format: 'int32' }, name: { type: 'string' }, status: { $ref: '#/components/schemas/TaskStatus' },
          owner: { type: 'string' }, dueDate: { type: 'string', format: 'date-time' },
        },
      },
      TaskPage: {
        type: 'object',
        properties: { projectId: { type: 'integer' }, items: { type: 'array', items: { $ref: '#/components/schemas/Task' } }, total: { type: 'integer' } },
        required: ['items', 'total'],
      },
      TaskSearch: { type: 'object', properties: { status: { $ref: '#/components/schemas/TaskStatus' }, names: { type: 'array', items: { type: 'string' }, example: ['Test'] } } },
      CreateTaskRequest: {
        type: 'object', required: ['name'],
        properties: { name: { type: 'string', minLength: 1, example: 'Write release notes' }, status: { $ref: '#/components/schemas/TaskStatus' }, owner: { type: 'string', nullable: true }, dueDate: { type: 'string', format: 'date-time' } },
      },
      CloseProjectCommand: { type: 'object', required: ['projectId'], properties: { projectId: { type: 'integer', format: 'int32', example: 42 }, reason: { type: 'string', nullable: true, example: 'Scope changed' } } },
      Summary: { type: 'object', properties: { total: { type: 'integer' }, byStatus: { type: 'object', additionalProperties: { type: 'integer' } } } },
      NotificationPage: {
        type: 'object',
        properties: { unread: { type: 'integer' }, items: { type: 'array', items: { type: 'object', properties: { id: { type: 'integer' }, text: { type: 'string' }, read: { type: 'boolean' } } } } },
      },
      RegisterRequest: {
        type: 'object', required: ['email', 'password'],
        properties: { email: { type: 'string', format: 'email' }, name: { type: 'string', nullable: true }, password: { type: 'string', example: 'S3cret!pass' }, marketingOptIn: { type: 'boolean' } },
      },
      RegisterResult: { type: 'object', properties: { ok: { type: 'boolean' }, userId: { type: 'integer' }, received: { type: 'object', additionalProperties: true } } },
      ProblemDetails: {
        type: 'object', additionalProperties: {},
        properties: { type: { type: 'string', nullable: true }, title: { type: 'string', nullable: true }, status: { type: 'integer', nullable: true }, detail: { type: 'string', nullable: true }, instance: { type: 'string', nullable: true } },
      },
      ValidationProblemDetails: {
        type: 'object', additionalProperties: {},
        properties: {
          type: { type: 'string', nullable: true }, title: { type: 'string', nullable: true }, status: { type: 'integer', nullable: true }, detail: { type: 'string', nullable: true }, instance: { type: 'string', nullable: true },
          errors: { type: 'object', additionalProperties: { type: 'array', items: { type: 'string' } } },
        },
      },
    },
  },
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const json = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
  const problem = (code, obj) => {
    res.writeHead(code, { 'content-type': 'application/problem+json' });
    res.end(JSON.stringify({ ...obj, status: code, traceId: traceId() }));
  };
  const readJson = (fn) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      let data;
      try { data = JSON.parse(body || '{}'); } catch {
        return problem(400, { type: 'https://tools.ietf.org/html/rfc9110#section-15.5.1', title: 'One or more validation errors occurred.', errors: { $: ['The JSON value could not be converted.'] } });
      }
      return fn(data);
    });
  };
  const all = () => [...TASKS, extraTask];

  if (url.pathname === '/swagger/v1/swagger.json') return json(200, SPEC);
  if (url.pathname === '/api/tasks' && req.method === 'GET') {
    const status = url.searchParams.get('status');
    const names = [...url.searchParams.entries()].filter(([k]) => /^filters\[\d+\]\.name$/.test(k)).map(([, v]) => v.toLowerCase());
    const items = all().filter((t) => (!status || t.status === status) && (!names.length || names.some((n) => t.name.toLowerCase().includes(n))));
    return json(200, { ...(url.searchParams.has('projectId') ? { projectId: Number(url.searchParams.get('projectId')) } : {}), items, total: items.length, seen: { tenant: req.headers['x-tenant'] || null, debug: req.headers['x-debug'] || null, auth: !!req.headers.authorization } });
  }
  if (url.pathname === '/api/tasks' && req.method === 'POST') {
    return readJson((d) => {
      const errors = {};
      if (!d.name || !String(d.name).trim()) errors.Name = ['The Name field is required.'];
      // A planted bug for edge-case testing: very long names crash the "database".
      if (typeof d.name === 'string' && d.name.length > 5000) return problem(500, { type: 'https://tools.ietf.org/html/rfc9110#section-15.6.1', title: 'An error occurred while processing your request.', detail: 'String or binary data would be truncated in table Tasks, column Name.', instance: url.pathname });
      if (d.status && !['Draft', 'Active', 'Done'].includes(d.status)) errors.Status = [`The value '${d.status}' is not valid for Status.`];
      if (d.dueDate && Number.isNaN(Date.parse(d.dueDate))) errors.DueDate = ['The DueDate field must be a valid date.'];
      if (Object.keys(errors).length) return problem(400, { type: 'https://tools.ietf.org/html/rfc9110#section-15.5.1', title: 'One or more validation errors occurred.', errors });
      const t = { id: 100 + Math.floor(Math.random() * 900), name: d.name, status: d.status || 'Draft', owner: d.owner || 'Ana', dueDate: d.dueDate || new Date().toISOString() };
      return json(201, t);
    });
  }
  let m = url.pathname.match(/^\/api\/tasks\/(\d+)$/);
  if (m && req.method === 'GET') {
    const t = all().find((x) => x.id === Number(m[1]));
    if (!t) return problem(404, { type: 'https://tools.ietf.org/html/rfc9110#section-15.5.5', title: 'Not Found', detail: `Task ${m[1]} does not exist.`, instance: url.pathname });
    return json(200, t);
  }
  m = url.pathname.match(/^\/api\/tasks\/(\d+)\/archive$/);
  if (m && req.method === 'POST') {
    return problem(500, {
      type: 'https://tools.ietf.org/html/rfc9110#section-15.6.1', title: 'An error occurred while processing your request.',
      detail: 'Object reference not set to an instance of an object.', instance: url.pathname,
      exception: { details: `System.NullReferenceException: Object reference not set to an instance of an object.\n   at Tasks.Api.Services.TaskService.ArchiveAsync(Int32 id) in /src/Tasks.Api/Services/TaskService.cs:line 87\n   at Tasks.Api.Controllers.TasksController.Archive(Int32 id) in /src/Tasks.Api/Controllers/TasksController.cs:line 54`, path: url.pathname, endpoint: 'Tasks.Api.Controllers.TasksController.Archive (Tasks.Api)' },
    });
  }
  if (url.pathname === '/api/projects/close' && req.method === 'POST') {
    return readJson((d) => {
      const id = d.projectId ?? d.ProjectId;
      const errors = {};
      if (!id || Number(id) <= 0) errors.ProjectId = ['Property is empty!'];
      if (d.reason != null && String(d.reason).length > 200) errors.Reason = ['Must be 200 characters or fewer.'];
      if (Object.keys(errors).length) {
        // FluentValidation-style body, as many ASP.NET APIs return it
        res.writeHead(400, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ title: 'Validation failed!', status: 400, type: 'ValidationException', instance: `POST ${url.pathname}`, errors, traceId: traceId() }));
      }
      return json(200, { closed: true, projectId: id });
    });
  }
  if (url.pathname === '/api/admin/audit' && req.method === 'GET') {
    // Who's asking: the roles in the bearer token (no token → 401; Admin or Auditor → the log).
    const tok = String(req.headers.authorization || '').replace(/^bearer\s+/i, '');
    let roles = null;
    try { const pl = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString()); roles = [].concat(pl.roles || pl.role || pl['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || []); } catch { /* no token */ }
    if (!roles) return problem(401, { type: 'https://tools.ietf.org/html/rfc9110#section-15.5.2', title: 'Unauthorized', instance: url.pathname });
    if (roles.some((r) => /admin|auditor/i.test(r))) return json(200, { items: [{ at: new Date().toISOString(), who: 'ana@example.com', what: 'Deleted task 41' }] });
    return problem(403, { type: 'https://tools.ietf.org/html/rfc9110#section-15.5.4', title: 'Forbidden', detail: 'This endpoint requires the Auditor role.', instance: url.pathname });
  }
  if (url.pathname === '/api/reports/summary' && req.method === 'GET') {
    const byStatus = {};
    for (const t of all()) byStatus[t.status] = (byStatus[t.status] || 0) + 1;
    return json(200, { total: all().length, byStatus });
  }
  if (url.pathname === '/api/tasks/search' && req.method === 'POST') {
    return readJson((q) => {
      const names = (q.names || []).map((n) => String(n).toLowerCase());
      const items = all().filter((t) => (!q.status || t.status === q.status) && (!names.length || names.some((n) => t.name.toLowerCase().includes(n))));
      return json(200, { items, total: items.length, via: 'POST /api/tasks/search' });
    });
  }
  if (url.pathname === '/api/notifications' && req.method === 'GET') {
    const since = Number(url.searchParams.get('since')) || 0;
    const items = Array.from({ length: 40 }, (_, i) => ({ id: since + i, text: `Notification ${since + i}`, read: i % 3 === 0 }));
    return json(200, { unread: items.filter((n) => !n.read).length, items });
  }
  if (url.pathname === '/api/register' && req.method === 'POST') {
    return readJson((data) => {
      const errors = {};
      if (!data.email) errors.Email = ['The Email field is required.'];
      else if (!/^[^@\s]+@[^@\s]+$/.test(data.email)) errors.Email = ['The Email field is not a valid e-mail address.'];
      if (!data.password) errors.Password = ['The Password field is required.'];
      else if (String(data.password).length < 8) errors.Password = ['The field Password must be a string with a minimum length of 8.'];
      if (Object.keys(errors).length) return problem(400, { type: 'https://tools.ietf.org/html/rfc9110#section-15.5.1', title: 'One or more validation errors occurred.', errors });
      return json(201, { ok: true, userId: 42, received: data });
    });
  }
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return fs.createReadStream(path.join(__dirname, 'index.html')).pipe(res);
  }
  return problem(404, { type: 'https://tools.ietf.org/html/rfc9110#section-15.5.5', title: 'Not Found', instance: url.pathname });
});

const port = Number(process.env.PORT) || 5173;
server.listen(port, () => console.log(`RESTless demo on http://localhost:${port}`));
