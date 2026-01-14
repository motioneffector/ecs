# Optimizing with Indexes

This guide shows you how to add database indexes to speed up queries on frequently-accessed component fields.

## Prerequisites

Before starting, you should:

- [Understand how queries work](Concept-Queries)
- Have an ECS with components that you query frequently

## Overview

We'll cover:

1. Understanding when indexes help
2. Adding indexes to component fields
3. Measuring performance improvements

## Step 1: Understand When Indexes Help

Indexes speed up queries that filter by specific field values. They're most useful when:

- You have many entities with a component (thousands+)
- You frequently filter by a specific field
- The field has varied values (not just true/false)

```typescript
// Without index: scans all Position components
const nearbyEntities = ecs.query([Position], {
  filter: (pos) => pos.x >= 100 && pos.x <= 200
})

// With index on 'x': database can quickly find matching rows
```

## Step 2: Add Indexes

Use `addIndex` after initializing the ECS:

```typescript
import { createECS, defineComponent } from '@motioneffector/ecs'
import { createDatabase } from '@motioneffector/sql'

const Position = defineComponent('Position', {
  x: 'number',
  y: 'number',
  room: 'string'
})

const db = await createDatabase()
const ecs = createECS(db, [Position])
await ecs.initialize()

// Add indexes on frequently-queried fields
ecs.addIndex(Position, 'x')
ecs.addIndex(Position, 'y')
ecs.addIndex(Position, 'room')
```

The index is created on the component's database table. You only need to add each index once.

## Step 3: Measure Performance

Test with realistic data volumes to see the difference:

```typescript
// Create many entities
for (let i = 0; i < 10000; i++) {
  const entity = ecs.createEntity()
  ecs.addComponent(entity, Position, {
    x: Math.random() * 1000,
    y: Math.random() * 1000,
    room: `room-${Math.floor(Math.random() * 100)}`
  })
}

// Query without index (before adding)
console.time('query-no-index')
const results1 = ecs.rawQuery(
  `SELECT entity_id FROM "component_Position" WHERE room = ?`,
  ['room-42']
)
console.timeEnd('query-no-index')

// Add index
ecs.addIndex(Position, 'room')

// Query with index
console.time('query-with-index')
const results2 = ecs.rawQuery(
  `SELECT entity_id FROM "component_Position" WHERE room = ?`,
  ['room-42']
)
console.timeEnd('query-with-index')
```

## Complete Example

```typescript
import { createECS, defineComponent } from '@motioneffector/ecs'
import { createDatabase } from '@motioneffector/sql'

const Position = defineComponent('Position', { x: 'number', y: 'number' })
const Team = defineComponent('Team', { name: 'string' })
const Health = defineComponent('Health', { current: 'number', max: 'number' })

const db = await createDatabase()
const ecs = createECS(db, [Position, Team, Health])
await ecs.initialize()

// Add indexes on fields we'll query frequently
ecs.addIndex(Team, 'name')      // For "find all enemies" queries
ecs.addIndex(Health, 'current') // For "find low health entities" queries

// Create test data
for (let i = 0; i < 5000; i++) {
  const entity = ecs.createEntity()
  ecs.addComponent(entity, Position, {
    x: Math.random() * 1000,
    y: Math.random() * 1000
  })
  ecs.addComponent(entity, Team, {
    name: Math.random() > 0.5 ? 'player' : 'enemy'
  })
  ecs.addComponent(entity, Health, {
    current: Math.floor(Math.random() * 100),
    max: 100
  })
}

// These queries benefit from indexes
const enemies = ecs.rawQuery<{ entity_id: string }>(
  `SELECT entity_id FROM "component_Team" WHERE name = ?`,
  ['enemy']
)
console.log(`Found ${enemies.length} enemies`)

const lowHealth = ecs.rawQuery<{ entity_id: string }>(
  `SELECT entity_id FROM "component_Health" WHERE current < ?`,
  [25]
)
console.log(`Found ${lowHealth.length} low health entities`)
```

## Variations

### Composite Queries with Indexes

When filtering on multiple fields, indexes on each field help:

```typescript
ecs.addIndex(Position, 'x')
ecs.addIndex(Position, 'y')

// Both indexes can help with range queries
const inArea = ecs.rawQuery<{ entity_id: string }>(
  `SELECT entity_id FROM "component_Position"
   WHERE x >= ? AND x <= ? AND y >= ? AND y <= ?`,
  [100, 200, 100, 200]
)
```

### Index on Join Fields

For complex multi-component queries, indexes help the joins:

```typescript
// entity_id is already indexed (it's the primary key)
// but additional field indexes help filter conditions

const damagedEnemies = ecs.rawQuery<{ entity_id: string }>(
  `SELECT t.entity_id
   FROM "component_Team" t
   JOIN "component_Health" h ON t.entity_id = h.entity_id
   WHERE t.name = ? AND h.current < h.max`,
  ['enemy']
)
```

## Troubleshooting

### No Performance Improvement

**Symptom:** Query time is similar with and without index.

**Cause:** Small data set, or query doesn't filter on indexed field.

**Solution:** Indexes help most with large data sets (1000+ rows) and queries that filter on the indexed column.

### Index Already Exists

**Symptom:** Error when adding index.

**Cause:** Index was already added previously.

**Solution:** addIndex uses CREATE INDEX IF NOT EXISTS, so this shouldn't error. If it does, the field name might be invalid.

## See Also

- **[Queries Concept](Concept-Queries)** - Understanding query basics
- **[Query API](API-Queries)** - query(), rawQuery() reference
- **[Advanced API](API-Advanced)** - addIndex() reference
