class _ extends Error {
  constructor(d) {
    super(d), this.name = "ECSError";
  }
}
class s extends _ {
  constructor(d, p) {
    super(d), this.field = p, this.name = "ValidationError";
  }
}
class b extends _ {
  constructor(d, p) {
    super(d), this.cause = p, this.name = "DatabaseError";
  }
}
function L(i, d) {
  if (!i || i.trim() === "")
    throw new s("Component name cannot be empty", "name");
  if (Object.keys(d).length === 0)
    throw new s("Component schema cannot be empty", "schema");
  if ("entity_id" in d)
    throw new s(
      'Field name "entity_id" is reserved and cannot be used',
      "entity_id"
    );
  const p = /* @__PURE__ */ new Set(["string", "number", "boolean", "json"]);
  for (const [$, T] of Object.entries(d))
    if (!p.has(T))
      throw new s(
        `Invalid field type "${T}" for field "${$}". Must be one of: ${[...p].join(", ")}`,
        $
      );
  const g = Object.freeze({ ...d });
  return Object.freeze({
    name: i.trim(),
    schema: g
  });
}
function H(i, d) {
  if (i == null)
    throw new s("Invalid database instance", "database");
  const p = /* @__PURE__ */ new Set();
  for (const e of d) {
    if (p.has(e.name))
      throw new s(
        `Duplicate component name: "${e.name}"`,
        "components"
      );
    p.add(e.name);
  }
  const g = /* @__PURE__ */ new Map();
  for (const e of d)
    g.set(e.name, e);
  const C = [], $ = [], T = /* @__PURE__ */ new Map(), y = /* @__PURE__ */ new Map(), x = /* @__PURE__ */ new Map();
  function h(e) {
    return `"${e.replace(/"/g, '""')}"`;
  }
  function D(e) {
    return `component_${e.name}`;
  }
  function S(e) {
    return h(D(e));
  }
  function j(e, n) {
    return n === "json" ? JSON.stringify(e) : n === "boolean" ? e ? 1 : 0 : e;
  }
  function v(e, n) {
    return n === "json" && typeof e == "string" ? JSON.parse(e) : n === "boolean" ? e === 1 : e;
  }
  const A = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
  function F(e, n, o = !1) {
    const r = e.schema;
    if (!o) {
      for (const t of Object.keys(r))
        if (!(t in n))
          throw new s(
            `Missing required field "${t}" for component "${e.name}"`,
            t
          );
    }
    for (const [t, a] of Object.entries(n)) {
      if (A.has(t))
        throw new s(
          `Field name "${t}" is forbidden for security reasons`,
          t
        );
      if (!Object.hasOwn(r, t))
        throw new s(
          `Unknown field "${t}" for component "${e.name}"`,
          t
        );
      const c = r[t], f = typeof a;
      switch (c) {
        case "string":
          if (f !== "string")
            throw new s(
              `Field "${t}" must be a string, got ${f}`,
              t
            );
          break;
        case "number":
          if (f !== "number")
            throw new s(
              `Field "${t}" must be a number, got ${f}`,
              t
            );
          break;
        case "boolean":
          if (f !== "boolean")
            throw new s(
              `Field "${t}" must be a boolean, got ${f}`,
              t
            );
          break;
        case "json":
          break;
        default:
          throw new s(
            `Invalid field type for "${t}" in component "${e.name}"`,
            t
          );
      }
    }
  }
  function R(e) {
    return i.get(
      "SELECT id FROM entities WHERE id = ?",
      [e]
    ) !== void 0;
  }
  const u = {
    initialize() {
      try {
        i.exec(`
          CREATE TABLE IF NOT EXISTS entities (
            id TEXT PRIMARY KEY,
            created_at INTEGER NOT NULL
          )
        `);
        for (const e of d) {
          const n = S(e), o = [`${h("entity_id")} TEXT PRIMARY KEY`];
          for (const [r, t] of Object.entries(e.schema)) {
            let a;
            switch (t) {
              case "string":
                a = "TEXT";
                break;
              case "number":
                a = "REAL";
                break;
              case "boolean":
                a = "INTEGER";
                break;
              case "json":
                a = "TEXT";
                break;
            }
            o.push(`${h(r)} ${a} NOT NULL`);
          }
          o.push(`FOREIGN KEY (${h("entity_id")}) REFERENCES entities(id) ON DELETE CASCADE`), i.exec(`
            CREATE TABLE IF NOT EXISTS ${n} (
              ${o.join(`,
              `)}
            )
          `);
        }
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(new b(
          `Failed to initialize ECS: ${e instanceof Error ? e.message : String(e)}`,
          e
        ));
      }
    },
    createEntity(e) {
      const n = e ?? M();
      if (e !== void 0) {
        if (typeof e != "string" || e.trim() === "")
          throw new s("Entity ID must be a non-empty string", "id");
        if (i.get(
          "SELECT id FROM entities WHERE id = ?",
          [e]
        ))
          throw new s(`Entity with ID "${e}" already exists`, "id");
      }
      const o = Date.now();
      i.run("INSERT INTO entities (id, created_at) VALUES (?, ?)", [n, o]);
      for (const r of C)
        try {
          r(n);
        } catch (t) {
          console.error("Error in onEntityCreated handler:", t);
        }
      return n;
    },
    destroyEntity(e) {
      if (!R(e))
        return !1;
      const n = [];
      for (const r of d)
        u.hasComponent(e, r) && n.push(r);
      for (const r of n) {
        const t = y.get(r.name) ?? [];
        for (const a of t)
          try {
            a(e);
          } catch (c) {
            console.error("Error in onComponentRemoved handler:", c);
          }
      }
      if (i.run("DELETE FROM entities WHERE id = ?", [e]).changes > 0) {
        for (const r of $)
          try {
            r(e);
          } catch (t) {
            console.error("Error in onEntityDestroyed handler:", t);
          }
        return !0;
      }
      return !1;
    },
    addComponent(e, n, o) {
      if (!R(e))
        throw new s(`Entity "${e}" does not exist`, "entityId");
      if (!g.has(n.name))
        throw new s(
          `Component "${n.name}" is not registered with this ECS instance`,
          "component"
        );
      if (u.hasComponent(e, n))
        throw new s(
          `Entity "${e}" already has component "${n.name}"`,
          "component"
        );
      F(n, o);
      const r = S(n), t = Object.keys(n.schema), a = t.map((m) => h(m)), c = t.map((m) => {
        const l = n.schema[m];
        if (!l) throw new s(`Unknown field type for "${m}"`, m);
        return j(o[m], l);
      }), f = t.map(() => "?").join(", ");
      i.run(
        `INSERT INTO ${r} (${h("entity_id")}, ${a.join(", ")}) VALUES (?, ${f})`,
        [e, ...c]
      );
      const E = T.get(n.name) ?? [];
      for (const m of E)
        try {
          m(e, o);
        } catch (l) {
          console.error("Error in onComponentAdded handler:", l);
        }
      return e;
    },
    getComponent(e, n) {
      if (!R(e))
        return null;
      const o = S(n), r = i.get(
        `SELECT * FROM ${o} WHERE ${h("entity_id")} = ?`,
        [e]
      );
      if (!r)
        return null;
      const t = {};
      for (const [a, c] of Object.entries(n.schema))
        t[a] = v(r[a], c);
      return t;
    },
    updateComponent(e, n, o) {
      if (!R(e))
        throw new s(`Entity "${e}" does not exist`, "entityId");
      if (!u.hasComponent(e, n))
        throw new s(
          `Entity "${e}" does not have component "${n.name}"`,
          "component"
        );
      F(n, o, !0);
      const r = u.getComponent(e, n);
      if (!r)
        throw new s(
          `Entity "${e}" does not have component "${n.name}"`,
          "component"
        );
      const t = S(n), a = Object.keys(o), c = a.map((l) => {
        const w = n.schema[l];
        if (!w) throw new s(`Unknown field type for "${l}"`, l);
        return j(o[l], w);
      }), f = a.map((l) => `${h(l)} = ?`).join(", ");
      i.run(
        `UPDATE ${t} SET ${f} WHERE ${h("entity_id")} = ?`,
        [...c, e]
      );
      const E = u.getComponent(e, n);
      if (!E)
        throw new b("Failed to retrieve updated component data");
      const m = x.get(n.name) ?? [];
      for (const l of m)
        try {
          l(e, r, E);
        } catch (w) {
          console.error("Error in onComponentUpdated handler:", w);
        }
      return e;
    },
    removeComponent(e, n) {
      if (!R(e))
        throw new s(`Entity "${e}" does not exist`, "entityId");
      const o = u.hasComponent(e, n), r = S(n);
      if (i.run(`DELETE FROM ${r} WHERE ${h("entity_id")} = ?`, [e]), o) {
        const t = y.get(n.name) ?? [];
        for (const a of t)
          try {
            a(e);
          } catch (c) {
            console.error("Error in onComponentRemoved handler:", c);
          }
      }
      return e;
    },
    hasComponent(e, n) {
      return R(e) ? u.getComponent(e, n) !== null : !1;
    },
    query(e, n) {
      if (e.length === 0)
        return i.all("SELECT id FROM entities").map((E) => E.id);
      const r = e.map((f) => S(f)).map((f, E) => {
        if (E === 0)
          return `${f} t0`;
        const m = `t${String(E)}`;
        return `INNER JOIN ${f} ${m} ON t0.${h("entity_id")} = ${m}.${h("entity_id")}`;
      }).join(" "), t = `SELECT t0.${h("entity_id")} FROM ${r}`;
      let c = i.all(t).map((f) => f.entity_id);
      if (n != null && n.exclude && n.exclude.length > 0) {
        const f = /* @__PURE__ */ new Set();
        for (const E of n.exclude) {
          const m = S(E), l = i.all(
            `SELECT ${h("entity_id")} FROM ${m}`
          );
          for (const w of l)
            f.add(w.entity_id);
        }
        c = c.filter((E) => !f.has(E));
      }
      if (n != null && n.filter) {
        const f = n.filter;
        c = c.filter((E) => {
          if (e.length === 1 && e[0]) {
            const l = e[0], w = u.getComponent(E, l);
            return w !== null && f(w);
          }
          const m = {};
          for (const l of e) {
            const w = u.getComponent(E, l);
            w !== null && (m[l.name] = w);
          }
          return f(m);
        });
      }
      return c;
    },
    queryWithData(e, n) {
      return u.query(e, n).map((r) => {
        const t = { entityId: r };
        for (const a of e) {
          const c = u.getComponent(r, a);
          c !== null && (t[a.name] = c);
        }
        return t;
      });
    },
    rawQuery(e, n) {
      try {
        return i.all(e, n);
      } catch (o) {
        throw new b(
          `Raw query failed: ${o instanceof Error ? o.message : String(o)}`,
          o
        );
      }
    },
    addComponentBulk(e, n, o) {
      i.transaction(() => {
        for (const r of e)
          u.addComponent(r, n, o);
      }).catch(() => {
      });
    },
    removeComponentBulk(e, n) {
      i.transaction(() => {
        for (const o of e)
          u.removeComponent(o, n);
      }).catch(() => {
      });
    },
    async transaction(e) {
      return await i.transaction(() => e(u));
    },
    onEntityCreated(e) {
      return C.push(e), () => {
        const n = C.indexOf(e);
        n !== -1 && C.splice(n, 1);
      };
    },
    onEntityDestroyed(e) {
      return $.push(e), () => {
        const n = $.indexOf(e);
        n !== -1 && $.splice(n, 1);
      };
    },
    onComponentAdded(e, n) {
      let o = T.get(e.name);
      return o || (o = [], T.set(e.name, o)), o.push(n), () => {
        const r = T.get(e.name);
        if (r) {
          const t = r.indexOf(n);
          t !== -1 && r.splice(t, 1);
        }
      };
    },
    onComponentRemoved(e, n) {
      let o = y.get(e.name);
      return o || (o = [], y.set(e.name, o)), o.push(n), () => {
        const r = y.get(e.name);
        if (r) {
          const t = r.indexOf(n);
          t !== -1 && r.splice(t, 1);
        }
      };
    },
    onComponentUpdated(e, n) {
      let o = x.get(e.name);
      return o || (o = [], x.set(e.name, o)), o.push(n), () => {
        const r = x.get(e.name);
        if (r) {
          const t = r.indexOf(n);
          t !== -1 && r.splice(t, 1);
        }
      };
    },
    defineArchetype(e) {
      for (const n of e)
        if (!g.has(n.name))
          throw new s(
            `Component "${n.name}" is not registered with this ECS instance`,
            "components"
          );
      return { components: e };
    },
    createFromArchetype(e, n) {
      const o = u.createEntity();
      for (const r of e.components) {
        const t = n[r.name];
        if (t === void 0)
          throw new s(
            `Missing data for component "${r.name}" in archetype`,
            r.name
          );
        u.addComponent(o, r, t);
      }
      return o;
    },
    addIndex(e, n) {
      if (!g.has(e.name))
        throw new s(
          `Component "${e.name}" is not registered with this ECS instance`,
          "component"
        );
      if (!(n in e.schema))
        throw new s(
          `Field "${String(n)}" does not exist in component "${e.name}"`,
          String(n)
        );
      const o = S(e), r = String(n), t = D(e), a = h(`idx_${t}_${r}`);
      try {
        i.exec(`CREATE INDEX IF NOT EXISTS ${a} ON ${o} (${h(r)})`);
      } catch (c) {
        throw new b(
          `Failed to create index: ${c instanceof Error ? c.message : String(c)}`,
          c
        );
      }
    },
    getDatabase() {
      return i;
    }
  };
  return u;
}
let O = 0, N = 0;
function M() {
  let i = Date.now();
  i === O ? (N++, N >= 4096 && (i = Date.now(), N = 0)) : i > O ? (N = 0, O = i) : (i = O, N++, N >= 4096 && (i = O + 1, O = i, N = 0)), O = i;
  const d = typeof globalThis.crypto < "u" ? globalThis.crypto : typeof crypto < "u" ? crypto : null, p = N.toString(16).padStart(3, "0");
  if (!d) {
    const y = Array.from(
      { length: 16 },
      () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")
    ).join(""), x = i.toString(16).padStart(12, "0");
    return `${x.slice(0, 8)}-${x.slice(8, 12)}-7${p}-${y.slice(0, 4)}-${y.slice(4, 16)}`;
  }
  const g = d.getRandomValues(new Uint8Array(8)), C = Array.from(g).map((y) => y.toString(16).padStart(2, "0")).join(""), $ = i.toString(16).padStart(12, "0");
  return `${$.slice(0, 8)}-${$.slice(8, 12)}-7${p}-${C.slice(0, 4)}-${C.slice(4, 16)}`;
}
export {
  b as DatabaseError,
  _ as ECSError,
  s as ValidationError,
  H as createECS,
  L as defineComponent
};
