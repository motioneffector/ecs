# Queries

Queries find entities based on which components they have. Instead of iterating through all entities manually, you ask the ECS "give me all entities with Position and Health" and get back the matching IDs. Under the hood, this is a SQL JOIN across component tables.

## How It Works

When you query for components, the ECS joins the relevant component tables on entity_id and returns the matching entities.

```
Query: [Position, Health]

component_Position          component_Health
┌───────────┬─────┬─────┐  ┌───────────┬─────┬─────┐
│ entity_id │  x  │  y  │  │ entity_id │ cur │ max │
├───────────┼─────┼─────┤  ├───────────┼─────┼─────┤
│ player-1  │ 100 │ 200 │  │ player-1  │  80 │ 100 │
│ enemy-1   │  50 │  75 │  │ enemy-1   │  30 │  30 │
│ particle  │  10 │  10 │  │           │     │     │
└───────────┴─────┴─────┘  └───────────┴─────┴─────┘

Result: ['player-1', 'enemy-1']  (both have Position AND Health)
```

## Basic Usage

```typescript
// Find all entities with Position
const moveable = ecs.query([Position])

// Find entities with BOTH Position AND Health
const characters = ecs.query([Position, Health])

// Get entities with their component data
const results = ecs.queryWithData([Position, Health])
// results = [
//   { entityId: 'player-1', Position: { x: 100, y: 200 }, Health: { current: 80, max: 100 } },
//   { entityId: 'enemy-1', Position: { x: 50, y: 75 }, Health: { current: 30, max: 30 } }
// ]
```

## Key Points

- **AND logic** - Querying for [A, B] returns entities that have both A and B, not either.

- **Empty query returns all** - `ecs.query([])` returns all entity IDs.

- **Exclude components** - Use the `exclude` option to filter out entities that have certain components.

- **Filter by data** - Use the `filter` option to narrow results by component values.

- **queryWithData** - Returns entities with their component data attached, avoiding separate getComponent calls.

## Examples

### Basic Query

```typescript
// All entities with Position
const entities = ecs.query([Position])

// Loop and get data
for (const id of entities) {
  const pos = ecs.getComponent(id, Position)
  console.log(`Entity ${id} at (${pos.x}, ${pos.y})`)
}
```

### Query with Exclusion

Find entities that have Position but NOT PlayerControlled (i.e., NPCs):

```typescript
const npcs = ecs.query([Position, Health], {
  exclude: [PlayerControlled]
})
```

### Query with Filter

Find entities with low health:

```typescript
const lowHealth = ecs.query([Health], {
  filter: (data) => data.current < data.max * 0.25
})
```

### Query with Data

Get entities and their component data in one call:

```typescript
const results = ecs.queryWithData([Position, Health])

for (const result of results) {
  console.log(`${result.entityId}: HP ${result.Health.current}/${result.Health.max}`)
  console.log(`  Position: (${result.Position.x}, ${result.Position.y})`)
}
```

### Raw SQL Query

For complex queries, use raw SQL:

```typescript
const results = ecs.rawQuery<{ entity_id: string; x: number }>(
  `SELECT entity_id, x FROM "component_Position" WHERE x > ?`,
  [100]
)
```

## Related

- **[Components](Concept-Components)** - What you're querying for
- **[Optimizing with Indexes](Guide-Optimizing-with-Indexes)** - Speed up frequent queries
- **[Query API](API-Queries)** - Full query(), queryWithData(), rawQuery() reference
