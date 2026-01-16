# Queries API

Functions for finding entities by their components.

---

## `ECS.query()`

Finds entities that have all specified components. Returns entity IDs.

**Signature:**

```typescript
query<T extends ComponentSchema>(
  components: ComponentDefinition<T>[],
  options?: QueryOptions<T>
): EntityId[]
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `components` | `ComponentDefinition<T>[]` | Yes | Components entities must have (AND logic) |
| `options` | `QueryOptions<T>` | No | Filter and exclude options |

**Returns:** `EntityId[]` — Array of matching entity IDs.

**Example:**

```typescript
// All entities with Position
const moveable = ecs.query([Position])

// Entities with both Position AND Health
const characters = ecs.query([Position, Health])

// All entities (empty component array)
const allEntities = ecs.query([])

// With filter
const lowHealth = ecs.query([Health], {
  filter: (data) => data.current < 25
})

// With exclusion
const npcs = ecs.query([Position, Health], {
  exclude: [PlayerControlled]
})
```

---

## `ECS.queryWithData()`

Finds entities and returns them with their component data attached. Avoids separate getComponent calls.

**Signature:**

```typescript
queryWithData<T extends ComponentDefinition[]>(
  components: T,
  options?: QueryOptions<T[number]['schema']>
): QueryResult<T>[]
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `components` | `T` | Yes | Components to query and return data for |
| `options` | `QueryOptions` | No | Filter and exclude options |

**Returns:** `QueryResult<T>[]` — Array of objects with entityId and component data.

**Example:**

```typescript
const results = ecs.queryWithData([Position, Health])

for (const result of results) {
  console.log(`Entity: ${result.entityId}`)
  console.log(`  Position: (${result.Position.x}, ${result.Position.y})`)
  console.log(`  Health: ${result.Health.current}/${result.Health.max}`)
}
```

---

## `ECS.rawQuery()`

Executes a raw SQL query against the database. For advanced queries that can't be expressed with query().

**Signature:**

```typescript
rawQuery<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): T[]
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sql` | `string` | Yes | SQL query string |
| `params` | `unknown[]` | No | Parameter values for placeholders |

**Returns:** `T[]` — Array of result rows.

**Example:**

```typescript
// Find entities with x > 100
const results = ecs.rawQuery<{ entity_id: string; x: number }>(
  `SELECT entity_id, x FROM "component_Position" WHERE x > ?`,
  [100]
)

// Join multiple component tables
const query = `
  SELECT p.entity_id, p.x, p.y, h.current, h.max
  FROM "component_Position" p
  JOIN "component_Health" h ON p.entity_id = h.entity_id
  WHERE h.current < h.max * 0.5
`
const damaged = ecs.rawQuery(query)
```

**Throws:**

- `DatabaseError` — SQL execution fails

---

## Types

### `QueryOptions<T>`

```typescript
interface QueryOptions<T extends ComponentSchema> {
  filter?: (data: InferComponentData<T>) => boolean
  exclude?: ComponentDefinition[]
}
```

| Property | Type | Description |
|----------|------|-------------|
| `filter` | `(data) => boolean` | Predicate to filter results by component data |
| `exclude` | `ComponentDefinition[]` | Components that matching entities must NOT have |

### `QueryResult<T>`

```typescript
type QueryResult<T extends ComponentDefinition[]> = {
  entityId: EntityId
} & {
  [K in T[number]['name']]: InferComponentData<Extract<T[number], { name: K }>['schema']>
}
```

Result object from queryWithData(), containing the entity ID and data for each queried component keyed by component name.

```typescript
// For queryWithData([Position, Health]):
{
  entityId: "player-1",
  Position: { x: 100, y: 200 },
  Health: { current: 80, max: 100 }
}
```
