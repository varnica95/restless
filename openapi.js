// RESTless: OpenAPI / Swagger support (runs in the page, next to core.js and ui.js).
// Reads an OpenAPI 3.x or Swagger 2.0 document, lists its operations, builds sample requests,
// finds the operation behind a captured URL and checks a response against the documented schema.
(() => {
  if (window.__apiPeekSpec) return;
  const KEY = '__apiPeek.spec';
  const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
  const JSONISH = /json/i;

  let current = null; // normalised spec
  let loadedFromStorage = false;
  let version = 0;
  const listeners = new Set();
  const changed = () => { version++; listeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } }); };

  // ---------- $ref resolution
  function makeResolver(doc) {
    return function resolve(schema, seen = new Set()) {
      let s = schema;
      while (s && typeof s === 'object' && typeof s.$ref === 'string') {
        if (seen.has(s.$ref)) return {};
        seen.add(s.$ref);
        if (!s.$ref.startsWith('#/')) return {};
        let t = doc;
        for (const part of s.$ref.slice(2).split('/')) t = t?.[part.replace(/~1/g, '/').replace(/~0/g, '~')];
        // OpenAPI 3.1 allows siblings next to $ref (nullable, description…): keep them.
        const rest = { ...s };
        delete rest.$ref;
        s = t && typeof t === 'object' ? (Object.keys(rest).length ? { ...t, ...rest } : t) : {};
      }
      return s || {};
    };
  }

  const refName = (schema) => (schema && typeof schema.$ref === 'string' ? schema.$ref.split('/').pop() : null);

  function pickContent(content) {
    if (!content || typeof content !== 'object') return null;
    const types = Object.keys(content);
    const ct = types.find((t) => /^application\/json/i.test(t)) || types.find((t) => JSONISH.test(t)) || types[0];
    return ct ? { contentType: ct, schema: content[ct]?.schema || null, example: content[ct]?.example ?? firstExample(content[ct]?.examples) } : null;
  }
  const firstExample = (examples) => {
    if (!examples || typeof examples !== 'object') return undefined;
    const first = Object.values(examples)[0];
    return first && typeof first === 'object' && 'value' in first ? first.value : undefined;
  };

  const escRx = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tplPattern = (tpl) => tpl.split(/\{[^}]+\}/).map(escRx).join('[^/]+');

  // ---------- Normalise OpenAPI 3 / Swagger 2 into one shape
  function normalize(doc, sourceUrl) {
    if (!doc || typeof doc !== 'object') throw new Error('The file is not a JSON object.');
    const v3 = typeof doc.openapi === 'string';
    const v2 = String(doc.swagger || '').startsWith('2');
    if (!v3 && !v2) throw new Error('This JSON is not an OpenAPI or Swagger document (no "openapi" or "swagger" field).');
    if (!doc.paths || typeof doc.paths !== 'object') throw new Error('The document has no "paths".');
    const resolve = makeResolver(doc);
    const src = sourceUrl ? new URL(sourceUrl, location.href) : new URL(location.href);
    let base;
    if (v3) {
      let server = (doc.servers && doc.servers[0] && doc.servers[0].url) || '/';
      server = server.replace(/\{([^}]+)\}/g, (_, k) => doc.servers[0].variables?.[k]?.default ?? '');
      base = new URL(server, src.origin + src.pathname);
      // "/" relative to the spec URL means the spec's own origin
      if (!/^[a-z]+:\/\//i.test(server)) base = new URL(server.startsWith('/') ? server : `/${server}`, src.origin);
    } else {
      const scheme = (doc.schemes && doc.schemes[0]) || src.protocol.replace(':', '');
      base = new URL(`${scheme}://${doc.host || src.host}${doc.basePath || ''}`);
    }
    const basePath = base.pathname.replace(/\/+$/, '');
    // Every server the docs list (absolute), for the "Calls go to" picker
    const servers = [];
    if (v3) {
      for (const sv of doc.servers || []) {
        try {
          const raw = String(sv.url || '/').replace(/\{([^}]+)\}/g, (_, k) => sv.variables?.[k]?.default ?? '');
          servers.push((/^[a-z]+:\/\//i.test(raw) ? new URL(raw) : new URL(raw.startsWith('/') ? raw : `/${raw}`, src.origin)).href.replace(/\/+$/, ''));
        } catch { /* skip */ }
      }
    }
    if (!servers.length) servers.push(base.href.replace(/\/+$/, ''));
    const ops = [];
    for (const [p, item] of Object.entries(doc.paths)) {
      if (!item || typeof item !== 'object') continue;
      const shared = item.parameters || [];
      for (const m of METHODS) {
        const op = item[m];
        if (!op) continue;
        const params = [];
        const byKey = new Map();
        for (const raw of [...shared, ...(op.parameters || [])]) {
          const prm = resolve(raw);
          if (!prm || !prm.name) continue;
          byKey.set(`${prm.in}:${prm.name}`, prm);
        }
        let body = null;
        for (const prm of byKey.values()) {
          if (prm.in === 'body') { body = { contentType: (op.consumes || doc.consumes || ['application/json'])[0], schema: prm.schema || null, required: !!prm.required }; continue; }
          if (prm.in === 'formData') continue;
          const schema = prm.schema || (prm.type ? { type: prm.type, format: prm.format, enum: prm.enum, default: prm.default, items: prm.items } : {});
          params.push({ name: prm.name, in: prm.in, required: !!prm.required || prm.in === 'path', schema, example: prm.example ?? firstExample(prm.examples), description: prm.description || '' });
        }
        if (v3 && op.requestBody) {
          const rb = resolve(op.requestBody);
          const c = pickContent(rb.content);
          if (c) body = { ...c, required: !!rb.required };
        } else if (v2 && !body) {
          const form = [...byKey.values()].filter((x) => x.in === 'formData');
          if (form.length) {
            const consumes = (op.consumes || doc.consumes || ['application/x-www-form-urlencoded'])[0];
            body = { contentType: consumes, schema: { type: 'object', required: form.filter((f) => f.required).map((f) => f.name), properties: Object.fromEntries(form.map((f) => [f.name, { type: f.type === 'file' ? 'string' : f.type, format: f.type === 'file' ? 'binary' : f.format }])) } };
          }
        }
        const responses = {};
        for (const [code, r0] of Object.entries(op.responses || {})) {
          const r = resolve(r0);
          if (v3) {
            const c = pickContent(r.content);
            responses[code] = { description: r.description || '', schema: c?.schema || null, contentType: c?.contentType || null, example: c?.example };
          } else responses[code] = { description: r.description || '', schema: r.schema || null, contentType: r.schema ? 'application/json' : null };
        }
        const tpl = p.replace(/\/+$/, '') || '/';
        const nParams = (tpl.match(/\{[^}]+\}/g) || []).length;
        const rx = (prefix) => new RegExp(`^${(prefix + tpl).split(/\{[^}]+\}/).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]+')}/?$`, 'i');
        ops.push({
          id: `${m.toUpperCase()} ${p}`, method: m.toUpperCase(), path: p, summary: op.summary || '', description: op.description || '',
          operationId: op.operationId || '', tag: (op.tags && op.tags[0]) || 'Other', deprecated: !!op.deprecated,
          params, body, responses, nParams, tpl, rxFull: rx(basePath), rxBare: basePath ? rx('') : null,
          rxSuffix: new RegExp(`${tplPattern(tpl)}/?$`, 'i'),
        });
      }
    }
    // Literal paths first, so /api/tasks/search wins over /api/tasks/{id}
    const ordered = [...ops].sort((a, b) => a.nParams - b.nParams || b.path.length - a.path.length);
    return {
      title: doc.info?.title || 'API', version: doc.info?.version || '', kind: v3 ? `OpenAPI ${doc.openapi}` : `Swagger ${doc.swagger}`,
      sourceUrl: sourceUrl || null, base: base.href.replace(/\/+$/, ''), basePath, ops, ordered, resolve, doc,
      specBase: base.href.replace(/\/+$/, ''), servers, server: { mode: 'auto', reason: 'docs' },
    };
  }

  // ---------- Sample values
  function sample(schema, spec, depth = 0, seen = new Set(), name = '') {
    if (!schema) return null;
    const ref = refName(schema);
    if (ref) { if (seen.has(ref) || depth > 8) return ref && depth > 8 ? null : {}; seen = new Set(seen).add(ref); }
    const s = spec.resolve(schema);
    if (s.example !== undefined) return s.example;
    if (Array.isArray(s.examples) && s.examples.length) return s.examples[0];
    if (s.default !== undefined) return s.default;
    if (s.const !== undefined) return s.const;
    if (Array.isArray(s.enum) && s.enum.length) return s.enum.find((x) => x !== null) ?? s.enum[0];
    if (s.allOf) {
      const parts = s.allOf.map((x) => sample(x, spec, depth + 1, seen, name));
      if (parts.every((x) => x && typeof x === 'object' && !Array.isArray(x))) return Object.assign({}, ...parts);
      return parts.find((x) => x != null) ?? null;
    }
    if (s.oneOf || s.anyOf) {
      const alts = (s.oneOf || s.anyOf).filter((x) => spec.resolve(x).type !== 'null');
      return alts.length ? sample(alts[0], spec, depth + 1, seen, name) : null;
    }
    let type = s.type;
    if (Array.isArray(type)) type = type.find((t) => t !== 'null') || 'null';
    if (!type) type = s.properties ? 'object' : s.items ? 'array' : null;
    switch (type) {
      case 'object': {
        if (depth > 8) return {};
        const out = {};
        for (const [k, v] of Object.entries(s.properties || {})) {
          const pv = spec.resolve(v);
          if (pv.readOnly) continue;
          out[k] = sample(v, spec, depth + 1, seen, k);
        }
        if (!s.properties && s.additionalProperties && typeof s.additionalProperties === 'object') out.key = sample(s.additionalProperties, spec, depth + 1, seen, 'key');
        return out;
      }
      case 'array': return depth > 8 ? [] : [sample(s.items, spec, depth + 1, seen, name)].filter((x) => x !== undefined);
      case 'integer': return s.minimum != null ? Math.ceil(s.minimum) : 1;
      case 'number': return s.minimum != null ? s.minimum : 1.5;
      case 'boolean': return true;
      case 'null': return null;
      case 'string': {
        const f = s.format || '';
        if (f === 'date-time') return new Date().toISOString();
        if (f === 'date') return new Date().toISOString().slice(0, 10);
        if (f === 'time') return '12:00:00';
        if (f === 'uuid') return '00000000-0000-0000-0000-000000000000';
        if (f === 'email' || /email/i.test(name)) return 'ana@example.com';
        if (f === 'uri' || f === 'url') return 'https://example.com';
        if (f === 'binary' || f === 'byte') return '';
        return name ? `${name}` : 'string';
      }
      default: return null;
    }
  }

  // Value for a query / path / header parameter
  function paramSample(p, spec) {
    if (p.example !== undefined) return String(p.example);
    const s = spec.resolve(p.schema || {});
    if (s.example !== undefined) return String(s.example);
    if (s.default !== undefined) return String(s.default);
    const v = sample(p.schema, spec, 0, new Set(), p.name);
    if (v == null || typeof v === 'object') return '';
    return String(v);
  }
  const hasValue = (p, spec) => {
    const s = spec.resolve(p.schema || {});
    return p.example !== undefined || s.example !== undefined || s.default !== undefined || Array.isArray(s.enum);
  };

  // Builds { method, url, headers, body, bodyKind, notes } for "Try this endpoint"
  function buildRequest(op, spec) {
    const notes = [];
    const pathFilled = [];
    let path = op.path.replace(/\{([^}]+)\}/g, (_, name) => {
      const p = op.params.find((x) => x.in === 'path' && x.name === name) || { name, schema: { type: 'string' } };
      const v = paramSample(p, spec) || name;
      pathFilled.push(`${name} = ${v}`);
      return encodeURIComponent(v);
    });
    if (!path.startsWith('/')) path = `/${path}`;
    const url = new URL(spec.base + path);
    const skipped = [];
    for (const p of op.params.filter((x) => x.in === 'query')) {
      if (p.required || hasValue(p, spec)) url.searchParams.append(p.name, paramSample(p, spec));
      else skipped.push(p.name);
    }
    const headers = {};
    for (const p of op.params.filter((x) => x.in === 'header')) {
      if (p.required) headers[p.name.toLowerCase()] = paramSample(p, spec);
    }
    let body = null;
    let bodyKind = null;
    if (op.body && !['GET', 'HEAD'].includes(op.method)) {
      const ct = op.body.contentType || 'application/json';
      const value = op.body.example !== undefined ? op.body.example : sample(op.body.schema, spec);
      if (JSONISH.test(ct)) { body = JSON.stringify(value ?? {}, null, 2); bodyKind = 'json'; headers['content-type'] = 'application/json'; }
      else if (/x-www-form-urlencoded/i.test(ct)) {
        const sp = new URLSearchParams();
        for (const [k, v] of Object.entries(value && typeof value === 'object' ? value : {})) sp.append(k, v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
        body = sp.toString(); bodyKind = 'urlencoded'; headers['content-type'] = 'application/x-www-form-urlencoded';
      } else if (/multipart/i.test(ct)) {
        const fields = Object.entries(value && typeof value === 'object' ? value : {}).map(([k, v]) => [k, v == null ? '' : String(v)]);
        body = JSON.stringify(fields, null, 2); bodyKind = 'formdata';
        notes.push('This endpoint takes multipart form data: file fields are sent as empty text.');
      } else { body = typeof value === 'string' ? value : ''; bodyKind = 'text'; headers['content-type'] = ct; }
    }
    // Optional query params that were left out, with a sample value each (for "+ N optional" next to Add parameter).
    const optional = op.params.filter((x) => x.in === 'query' && skipped.includes(x.name)).map((x) => [x.name, paramSample(x, spec)]);
    return { method: op.method, url: url.href, headers, body, bodyKind, notes, pathFilled, optional };
  }

  // ---------- Matching a request to an operation
  const matchCache = new Map();
  function match(method, url) {
    if (!current) return null;
    let u;
    try { u = new URL(url, location.href); } catch { return null; }
    const key = `${version}|${method}|${u.pathname}`;
    if (matchCache.has(key)) return matchCache.get(key);
    const m = String(method || 'GET').toUpperCase();
    let found = current.ordered.find((o) => o.method === m && o.rxFull.test(u.pathname))
      || current.ordered.find((o) => o.method === m && o.rxBare && o.rxBare.test(u.pathname)) || null;
    if (matchCache.size > 2000) matchCache.clear();
    matchCache.set(key, found);
    return found;
  }

  function responseFor(op, status) {
    const codes = Object.keys(op.responses);
    const s = String(status);
    const key = codes.find((c) => c === s) || codes.find((c) => c.toUpperCase() === `${s[0]}XX`) || codes.find((c) => c === 'default');
    return { key: key || null, res: key ? op.responses[key] : null, documented: codes };
  }

  // ---------- Validation
  // Returns [{ path, kind, level: 'error'|'warn'|'info', msg, count }] grouped by path pattern.
  function validate(value, schema, spec) {
    const raw = [];
    const MAX = 400;
    const push = (path, kind, level, msg) => { if (raw.length < MAX) raw.push({ path, kind, level, msg }); };
    const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
    const describe = (v) => { const t = typeOf(v); return t === 'string' ? `"${v.length > 30 ? `${v.slice(0, 30)}…` : v}"` : t === 'object' ? 'an object' : t === 'array' ? 'an array' : String(v); };

    const isNullable = (s, wasRef) => s.nullable === true || (Array.isArray(s.type) && s.type.includes('null')) || s.type === 'null'
      || ((s.oneOf || s.anyOf) || []).some((x) => spec.resolve(x).type === 'null') || (wasRef && s['x-nullable'] === true);

    function merged(s) {
      if (!s.allOf) return s;
      const out = { ...s, properties: { ...(s.properties || {}) }, required: [...(s.required || [])] };
      delete out.allOf;
      for (const part0 of s.allOf) {
        const part = merged(spec.resolve(part0));
        Object.assign(out.properties, part.properties || {});
        out.required.push(...(part.required || []));
        if (!out.type && part.type) out.type = part.type;
        if (part.nullable) out.nullable = true;
        if (!out.items && part.items) out.items = part.items;
        if (!out.enum && part.enum) out.enum = part.enum;
        if (!out.format && part.format) out.format = part.format;
      }
      // a nullable wrapper around a single $ref (Swashbuckle style)
      return out;
    }

    function check(v, schema0, path, depth) {
      if (!schema0 || depth > 40) return;
      const wasRef = !!schema0.$ref;
      const s = merged(spec.resolve(schema0));
      if (v === null) {
        if (isNullable(s, wasRef)) return;
        // A bare $ref can't say "nullable" in OpenAPI 3.0, so null there is only a warning.
        push(path, 'null', 'warn', wasRef && !s.type ? 'is null; the docs don\'t mark it nullable' : 'is null, but the docs don\'t allow null');
        return;
      }
      if (s.oneOf || s.anyOf) {
        const alts = (s.oneOf || s.anyOf).filter((x) => spec.resolve(x).type !== 'null');
        let best = null;
        for (const alt of alts) {
          const before = raw.length;
          check(v, alt, path, depth + 1);
          const got = raw.splice(before);
          if (!got.some((x) => x.level === 'error')) { raw.push(...got); return; }
          if (!best || got.length < best.length) best = got;
        }
        if (best) raw.push(...best);
        if (!s.type && !s.properties) return;
      }
      let types = s.type ? (Array.isArray(s.type) ? s.type : [s.type]) : (s.properties ? ['object'] : s.items ? ['array'] : null);
      if (types) {
        const t = typeOf(v);
        const ok = types.some((x) => x === t || (x === 'number' && t === 'integer'));
        if (!ok) {
          push(path, 'type', 'error', `is ${t === 'integer' || t === 'number' ? `a number (${v})` : t === 'string' ? `a string ${describe(v)}` : t === 'boolean' ? `a boolean (${v})` : `an ${t}`}; the docs say ${types.filter((x) => x !== 'null').join(' or ')}`);
          return;
        }
      }
      if (Array.isArray(s.enum) && s.enum.length && !s.enum.some((e) => e === v)) {
        push(path, 'enum', 'error', `is ${describe(v)}; allowed: ${s.enum.slice(0, 8).map((e) => JSON.stringify(e)).join(', ')}${s.enum.length > 8 ? ', …' : ''}`);
      }
      if (typeof v === 'string' && s.format) {
        if (s.format === 'date-time' && Number.isNaN(Date.parse(v))) push(path, 'format', 'warn', `is ${describe(v)}; not a valid date-time`);
        if (s.format === 'uuid' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) push(path, 'format', 'warn', `is ${describe(v)}; not a valid uuid`);
      }
      if (Array.isArray(v)) {
        if (s.items) v.slice(0, 100).forEach((x, i) => check(x, s.items, `${path}[${i}]`, depth + 1));
        return;
      }
      if (v && typeof v === 'object') {
        const props = s.properties || {};
        for (const r of s.required || []) if (!(r in v)) push(`${path}.${r}`, 'missing', 'error', 'is missing; the docs mark it required');
        for (const [k, x] of Object.entries(v)) {
          if (props[k]) check(x, props[k], `${path}.${k}`, depth + 1);
          else if (s.additionalProperties && typeof s.additionalProperties === 'object') check(x, s.additionalProperties, `${path}.${k}`, depth + 1);
          else if (s.properties && s.additionalProperties !== true) push(`${path}.${k}`, 'extra', 'info', 'isn\'t in the docs');
        }
      }
    }
    check(value, schema, '$', 0);
    // Group the same problem across array items: items[0].owner, items[3].owner → items[*].owner ×2
    const groups = new Map();
    for (const x of raw) {
      const pattern = x.path.replace(/\[\d+\]/g, '[*]');
      const k = `${pattern}|${x.kind}`;
      const g = groups.get(k);
      if (g) { g.count++; g.examples.push(x.path); } else groups.set(k, { ...x, path: pattern, count: 1, examples: [x.path] });
    }
    const order = { error: 0, warn: 1, info: 2 };
    return [...groups.values()].sort((a, b) => order[a.level] - order[b.level]);
  }

  // Full check of one response. Returns null when there is no spec or no matching operation.
  const checkCache = new Map();
  function checkResponse(method, url, status, text, contentType) {
    const op = match(method, url);
    if (!op) return null;
    if (typeof status !== 'number') return { op, state: 'none' };
    const key = `${version}|${op.id}|${status}|${text?.length}|${text?.slice(0, 64)}|${text?.slice(-64)}`;
    if (checkCache.has(key)) return checkCache.get(key);
    const { key: code, res, documented } = responseFor(op, status);
    let out;
    if (!res) out = { op, state: 'undocumented', status, documented };
    else if (!res.schema) out = { op, state: 'noschema', code, status, documented };
    else {
      let data;
      let parsed = true;
      try { data = JSON.parse(text); } catch { parsed = false; }
      if (text == null) out = { op, state: 'nobody', code, status };
      else if (!parsed) out = { op, state: 'notjson', code, status, contentType };
      else {
        const issues = validate(data, res.schema, current);
        const errors = issues.filter((x) => x.level === 'error').length;
        const warns = issues.filter((x) => x.level === 'warn').length;
        out = { op, state: errors ? 'fail' : warns ? 'warn' : 'pass', code, status, issues, errors, warns, schemaName: refName(res.schema) || refName(current.resolve(res.schema).items) };
      }
    }
    if (checkCache.size > 500) checkCache.clear();
    checkCache.set(key, out);
    return out;
  }

  // ---------- What changed between two loaded specs (after Reload)
  // Flattens a schema into { "path": { type, nullable, required, enum } } so two versions can be compared field by field.
  function flatten(schema, spec, prefix, out = new Map(), depth = 0, seen = new Set(), required = true) {
    if (!schema || depth > 8) return out;
    const ref = refName(schema);
    if (ref) { if (seen.has(ref)) return out; seen = new Set(seen).add(ref); }
    let s = spec.resolve(schema);
    if (s.allOf) {
      const m = { ...s, properties: {}, required: [...(s.required || [])] };
      delete m.allOf;
      for (const part0 of s.allOf) {
        const part = spec.resolve(part0);
        Object.assign(m.properties, part.properties || {});
        m.required.push(...(part.required || []));
        if (part.type && !m.type) m.type = part.type;
        if (part.nullable) m.nullable = true;
        if (part.items && !m.items) m.items = part.items;
        if (part.enum && !m.enum) m.enum = part.enum;
        if (part.format && !m.format) m.format = part.format;
        if (part.$ref || refName(part0)) { const inner = spec.resolve(part0); if (inner.properties) Object.assign(m.properties, inner.properties); }
      }
      if (s.properties) Object.assign(m.properties, s.properties);
      s = m;
    }
    const alts = s.oneOf || s.anyOf;
    const nonNull = alts ? alts.filter((x) => spec.resolve(x).type !== 'null') : null;
    const nullable = s.nullable === true || (Array.isArray(s.type) && s.type.includes('null')) || (alts ? nonNull.length < alts.length : false);
    if (nonNull && nonNull.length === 1 && !s.type && !s.properties) {
      flatten(nonNull[0], spec, prefix, out, depth + 1, seen, required);
      const cur = out.get(prefix);
      if (cur) cur.nullable = cur.nullable || nullable;
      return out;
    }
    let type = Array.isArray(s.type) ? s.type.filter((t) => t !== 'null').join('|') : s.type;
    if (!type) type = s.properties ? 'object' : s.items ? 'array' : nonNull ? 'oneOf' : 'any';
    const label = type === 'array' ? `array of ${(() => { const it = spec.resolve(s.items || {}); return refName(s.items) || (Array.isArray(it.type) ? it.type.filter((x) => x !== 'null').join('|') : it.type) || 'any'; })()}` : `${type}${s.format ? ` (${s.format})` : ''}`;
    out.set(prefix, { type: label, nullable, required, enum: Array.isArray(s.enum) ? s.enum.map(String).join(', ') : '' });
    if (type === 'object' || s.properties) {
      const req = new Set(s.required || []);
      for (const [k, v] of Object.entries(s.properties || {})) flatten(v, spec, prefix ? `${prefix}.${k}` : k, out, depth + 1, seen, req.has(k));
      if (s.additionalProperties && typeof s.additionalProperties === 'object' && Object.keys(s.additionalProperties).length) flatten(s.additionalProperties, spec, `${prefix}{*}`, out, depth + 1, seen, false);
    }
    if (s.items) flatten(s.items, spec, `${prefix}[]`, out, depth + 1, seen, true);
    return out;
  }

  function opShape(op, spec) {
    const params = new Map(op.params.map((p) => {
      const s = spec.resolve(p.schema || {});
      return [`${p.in}:${p.name}`, { required: !!p.required, type: `${s.type || 'any'}${s.format ? ` (${s.format})` : ''}`, enum: Array.isArray(s.enum) ? s.enum.join(', ') : '' }];
    }));
    const body = op.body?.schema ? flatten(op.body.schema, spec, '') : new Map();
    const responses = new Map(Object.entries(op.responses).map(([code, r]) => [code, r.schema ? flatten(r.schema, spec, '') : new Map()]));
    return { params, body, responses, deprecated: op.deprecated };
  }

  // Returns { added: [op], removed: [op], changed: [{ op, items: [{ area, kind, text, breaking }] }] }
  function diffSpecs(a, b) {
    const before = new Map(a.ops.map((o) => [o.id, o]));
    const after = new Map(b.ops.map((o) => [o.id, o]));
    const added = b.ops.filter((o) => !before.has(o.id));
    const removed = a.ops.filter((o) => !after.has(o.id));
    const changed = [];
    const fieldName = (p) => p || '(body)';
    const desc = (f) => `${f.type}${f.nullable ? ', nullable' : ''}${f.enum ? ` [${f.enum}]` : ''}`;
    for (const [id, nb] of after) {
      const ob = before.get(id);
      if (!ob) continue;
      const A = opShape(ob, a);
      const B = opShape(nb, b);
      const items = [];
      const add = (area, kind, text, breaking = false) => items.push({ area, kind, text, breaking });
      if (!A.deprecated && B.deprecated) add('endpoint', '~', 'marked deprecated', false);
      // parameters
      for (const [k, p] of B.params) {
        const o = A.params.get(k);
        const [where, name] = k.split(/:(.*)/s);
        if (!o) add('params', '+', `${where} param ${name} (${p.type})${p.required ? ', required' : ''}`, p.required);
        else {
          if (!o.required && p.required) add('params', '~', `${where} param ${name} is now required`, true);
          if (o.required && !p.required) add('params', '~', `${where} param ${name} is now optional`);
          if (o.type !== p.type) add('params', '~', `${where} param ${name}: ${o.type} → ${p.type}`, true);
          if (o.enum !== p.enum) add('params', '~', `${where} param ${name} values: [${o.enum}] → [${p.enum}]`, !!o.enum);
        }
      }
      for (const [k] of A.params) if (!B.params.has(k)) { const [where, name] = k.split(/:(.*)/s); add('params', '-', `${where} param ${name} removed`, true); }
      // request body (sent by the frontend): new required fields and removed fields break callers
      const cmp = (area, X, Y, sending) => {
        for (const [path, f] of Y) {
          const o = X.get(path);
          if (!o) { if (path) add(area, '+', `${fieldName(path)}: ${desc(f)}${f.required ? ', required' : ''}`, sending && f.required); continue; }
          if (o.type !== f.type) add(area, '~', `${fieldName(path)}: ${o.type} → ${f.type}`, true);
          if (o.nullable !== f.nullable) add(area, '~', `${fieldName(path)} is ${f.nullable ? 'now nullable' : 'no longer nullable'}`, sending ? !f.nullable : f.nullable);
          if (o.required !== f.required && path) add(area, '~', `${fieldName(path)} is ${f.required ? 'now required' : 'now optional'}`, sending ? f.required : !f.required);
          if (o.enum !== f.enum) add(area, '~', `${fieldName(path)} values: [${o.enum}] → [${f.enum}]`, true);
        }
        for (const [path] of X) if (!Y.has(path) && path) add(area, '-', `${fieldName(path)} removed`, !sending);
      };
      cmp('request body', A.body, B.body, true);
      for (const [code, Y] of B.responses) {
        const X = A.responses.get(code);
        if (!X) { add(`response ${code}`, '+', `status ${code} is now documented`); continue; }
        cmp(`response ${code}`, X, Y, false);
      }
      for (const [code] of A.responses) if (!B.responses.has(code)) add(`response ${code}`, '-', `status ${code} is no longer documented`, false);
      if (items.length) changed.push({ op: nb, items });
    }
    return { added, removed, changed, breaking: changed.reduce((n, c) => n + c.items.filter((x) => x.breaking).length, 0) + removed.length };
  }

  // ---------- Which server the endpoints live on
  // Docs copied from localhost (or listing localhost in "servers") while the app runs on dev/staging
  // should still send requests where the app does. "Auto" looks at the calls the app made.
  const isLocal = (host) => /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\])$/i.test(host) || /\.(local|localhost|test)$/i.test(host);
  function applyBase(spec, href, info) {
    const u = new URL(href);
    spec.base = (u.origin + u.pathname).replace(/\/+$/, '');
    spec.basePath = u.pathname.replace(/\/+$/, '');
    for (const op of spec.ops) {
      const t = op.tpl === '/' ? '' : op.tpl;
      op.rxFull = new RegExp(`^${escRx(spec.basePath)}${tplPattern(t)}/?$`, 'i');
      op.rxBare = spec.basePath ? new RegExp(`^${tplPattern(t)}/?$`, 'i') : null;
    }
    spec.server = info;
    matchCache.clear(); checkCache.clear();
  }
  function detectServer(spec) {
    const reqs = window.__apiPeekCore?.state?.requests || [];
    const seen = new Set();
    const counts = new Map();
    for (const r of reqs) {
      if (r.manual || r.dryRun) continue;
      let u;
      try { u = new URL(r.url); } catch { continue; }
      const key = `${r.method} ${u.origin}${u.pathname}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (seen.size > 400) break;
      const op = spec.ordered.find((o) => o.method === r.method && o.tpl !== '/' && o.rxSuffix.test(u.pathname));
      if (!op) continue;
      const m = u.pathname.match(op.rxSuffix);
      const base = u.origin + u.pathname.slice(0, m.index).replace(/\/+$/, '');
      counts.set(base, (counts.get(base) || 0) + 1);
    }
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best) return { base: best[0], reason: 'calls', matched: best[1] };
    const sb = new URL(spec.specBase);
    if (isLocal(sb.hostname) && !isLocal(location.hostname)) return { base: (location.origin + sb.pathname).replace(/\/+$/, ''), reason: 'localhost', from: sb.origin };
    return { base: spec.specBase, reason: 'docs' };
  }
  // Re-checks "auto" against the calls captured so far. Cheap; call before using spec.base.
  function autoServer(spec = current) {
    if (!spec || spec.server.mode !== 'auto') return spec?.server || null;
    const d = detectServer(spec);
    if (d.base !== spec.base || d.reason !== spec.server.reason || d.matched !== spec.server.matched) applyBase(spec, d.base, { mode: 'auto', ...d });
    return spec.server;
  }
  function saveServer(pref) {
    const rec = stored();
    if (!rec) return;
    rec.server = pref;
    try { localStorage.setItem(KEY, JSON.stringify(rec)); } catch { /* ignore */ }
  }

  // ---------- Storage (the page's localStorage, like rules). Big specs keep only their URL and are fetched again.
  function save(text, url) {
    try { localStorage.setItem(KEY, JSON.stringify({ url, text, at: Date.now() })); return true; } catch { /* quota */ }
    try { localStorage.setItem(KEY, JSON.stringify({ url, text: null, at: Date.now() })); } catch { /* ignore */ }
    return false;
  }
  function stored() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }

  function useText(text, url, serverPref = null) {
    let doc;
    try { doc = JSON.parse(text); } catch {
      if (/^\s*(openapi|swagger)\s*:/m.test(text)) throw new Error('This is a YAML spec. Load the JSON version instead (Swashbuckle: /swagger/v1/swagger.json).');
      if (/^\s*</.test(text)) throw new Error('Got an HTML page, not the docs. This is probably the Swagger UI page; use the JSON link shown under its title.');
      throw new Error('The response is not valid JSON.');
    }
    const spec = normalize(doc, url);
    if (serverPref && serverPref.mode === 'fixed' && serverPref.base) {
      try { applyBase(spec, serverPref.base, { mode: 'fixed' }); } catch { autoServer(spec); }
    } else autoServer(spec);
    current = spec;
    matchCache.clear(); checkCache.clear();
    changed();
    return spec;
  }

  // Always straight from the server (no-store): a cached copy would make Reload / Refresh show the
  // old docs while the update check, which also skips the cache, keeps saying a new version is out.
  async function fetchText(url) {
    let res;
    try {
      const f = window.__apiPeekCore?.rawFetch || window.fetch.bind(window);
      res = await f(url, { headers: { accept: 'application/json' }, credentials: 'include', cache: 'no-store' });
    } catch {
      throw new Error(`Couldn't reach ${url}. If the docs are on another origin, its server must allow CORS from this page; otherwise paste the JSON or choose the file.`);
    }
    if (!res.ok) throw new Error(`${url} answered ${res.status}${res.statusText ? ` ${res.statusText}` : ''}.`);
    return res.text();
  }

  let pending = null; // { url, server } saved as a link only, not downloaded yet
  const fieldCache = new WeakMap();
  const api = {
    get current() { return current; },
    get version() { return version; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async load(url, serverPref = null) {
      const abs = new URL(url, location.href).href;
      const text = await fetchText(abs);
      const spec = useText(text, abs, serverPref);
      spec.savedFully = save(text, abs);
      if (serverPref) saveServer(serverPref);
      return spec;
    },
    fromText(text, label = null) {
      const spec = useText(text, label);
      spec.savedFully = save(text, label);
      return spec;
    },
    // For settings export/import: what's saved ({ url, text, server }), and putting a saved record back.
    exportRecord() { const s = stored(); return s ? { url: s.url || null, text: s.text || null, server: s.server || null } : null; },
    importRecord(rec) {
      if (!rec || (!rec.text && !rec.url)) { api.clear(); return; }
      try { localStorage.setItem(KEY, JSON.stringify({ url: rec.url || null, text: rec.text || null, server: rec.server || null, at: Date.now() })); } catch { /* quota */ }
      current = null; pending = null; matchCache.clear(); checkCache.clear();
      if (rec.text) { try { useText(rec.text, rec.url || null, rec.server || null); } catch { changed(); } return; }
      pending = { url: rec.url, server: rec.server || null };
      changed();
    },
    restore() {
      loadedFromStorage = true;
      const s = stored();
      if (!s) return;
      if (s.text) { try { useText(s.text, s.url, s.server); } catch { /* ignore broken */ } return; }
      if (!s.url) return;
      // Saved as a link only (too big to keep). Download it now only where capture is on;
      // elsewhere wait until the API Docs tab is opened (renderSpec calls loadPending).
      pending = { url: s.url, server: s.server || null };
      if (window.__apiPeekCore?.capture?.on?.()) api.loadPending().catch(() => {});
    },
    get pending() { return current ? null : pending; },
    // Is there a newer version at the docs' URL? Downloads it quietly (nothing changes here) and compares:
    // { available, changes, from, to, sig } where changes counts new, removed and changed endpoints.
    // Only a version or endpoint change counts, so a reworded description doesn't nag.
    async checkUpdate() {
      const cur = current;
      if (!cur?.sourceUrl) return null;
      const text = await fetchText(cur.sourceUrl);
      let doc;
      try { doc = JSON.parse(text); } catch { return null; }
      if (current !== cur) return null; // reloaded meanwhile
      const next = normalize(doc, cur.sourceUrl);
      const d = diffSpecs(cur, next);
      const changes = d.added.length + d.removed.length + d.changed.length;
      const from = cur.version || null; const to = next.version || null;
      const available = changes > 0 || (!!to && to !== from);
      return { available, changes, from, to, sig: `${to}|${d.added.map((o) => o.id).join()}|${d.removed.map((o) => o.id).join()}|${d.changed.map((c) => c.op.id).join()}|${changes}` };
    },
    async loadPending() {
      if (!pending) throw new Error('Nothing to load.');
      const p = pending;
      const spec = await api.load(p.url, p.server);
      pending = null;
      return spec;
    },
    // Tries the usual places on the given origins. Returns the spec or throws with what was tried.
    async discover(origins) {
      const paths = ['/swagger/v1/swagger.json', '/openapi/v1.json', '/swagger/v2/swagger.json', '/v3/api-docs', '/openapi.json', '/swagger.json', '/api-docs', '/api/swagger.json', '/api/openapi.json'];
      const tried = [];
      for (const o of origins) {
        for (const p of paths) {
          const url = o + p;
          tried.push(url);
          try {
            const text = await fetchText(url);
            if (!/"(openapi|swagger)"\s*:/.test(text.slice(0, 2000))) continue;
            const spec = useText(text, url);
            spec.savedFully = save(text, url);
            return spec;
          } catch { /* next */ }
        }
      }
      throw new Error(`No spec found. Tried ${tried.length} URLs, e.g. ${tried.slice(0, 3).join(', ')}. Enter the URL, paste the JSON, or choose the file.`);
    },
    autoServer: () => autoServer(),
    // mode 'auto' or 'fixed' (with base). Kept for this site.
    setServer(mode, base) {
      if (!current) return;
      if (mode === 'fixed') {
        const u = new URL(base, location.href);
        applyBase(current, u.href, { mode: 'fixed' });
        saveServer({ mode: 'fixed', base: current.base });
      } else {
        current.server = { mode: 'auto' };
        autoServer(current);
        saveServer({ mode: 'auto' });
      }
      changed();
    },
    clear() { current = null; pending = null; try { localStorage.removeItem(KEY); } catch { /* ignore */ } matchCache.clear(); checkCache.clear(); changed(); },
    // Field paths of an operation's request body and responses (e.g. "items[].title"), for searching the docs.
    fieldsOf(op) {
      if (!current || !op) return { body: [], response: [] };
      let f = fieldCache.get(op);
      if (!f) {
        const sh = opShape(op, current);
        f = { body: [...sh.body.keys()].filter(Boolean), response: [...new Set([...sh.responses.values()].flatMap((m) => [...m.keys()]))].filter(Boolean) };
        fieldCache.set(op, f);
      }
      return f;
    },
    match, buildRequest, checkResponse, validate, responseFor, diffSpecs,
    sample: (schema) => (current ? sample(schema, current) : null),
    _normalize: normalize,
  };
  window.__apiPeekSpec = api;
  // Restore the spec saved for this site once the page has started (outside any rendering).
  setTimeout(() => { if (!loadedFromStorage) api.restore(); }, 0);
})();
