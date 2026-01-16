# Components

Components are the data building blocks of an ECS. They define what properties an entity can have, like Position, Health, or Inventory. You define a component schema once, then attach instances of it to any number of entities.

## How It Works

Think of components as database table schemas. When you define a Position component with x and y fields, you're creating a blueprint. Each entity that gets a Position component gets its own row in that table with its own x and y values.

```
Component Definition (schema)     Entity Data (instances)
┌─────────────────────────┐      ┌─────────────────────────┐
│ Position                │      │ component_Position      │
│   x: number             │  →   │ entity_id │  x  │  y   │
│   y: number             │      │ player-1  │ 100 │ 200  │
└─────────────────────────┘      │ enemy-1   │ 50  │ 75   │
                                 └─────────────────────────┘
```

Each entity can have zero or one instance of each component type. An entity can't have two Position components, but it can have Position and Health.

## Basic Usage

```typescript
import { defineComponent } from '@motioneffector/ecs'

// Define a component with typed fields
const Position = defineComponent('Position', {
  x: 'number',
  y: 'number'
})

// Use it with an ECS
const ecs = createECS(db, [Position])
await ecs.initialize()

// Add to an entity
const entity = ecs.createEntity()
ecs.addComponent(entity, Position, { x: 100, y: 200 })

// Read it back
const pos = ecs.getComponent(entity, Position)
// pos = { x: 100, y: 200 }
```

## Key Points

- **Define once, use everywhere** - Component definitions are reusable templates. Define Position once, attach it to thousands of entities.

- **Four field types** - Fields can be `'string'`, `'number'`, `'boolean'`, or `'json'` (for arrays and objects).

- **Immutable definitions** - Component definitions are frozen after creation. You can't modify the schema at runtime.

- **Reserved field name** - The field name `entity_id` is reserved and cannot be used in schemas.

## Examples

### Simple Value Component

```typescript
const Health = defineComponent('Health', {
  current: 'number',
  max: 'number'
})

ecs.addComponent(entity, Health, { current: 80, max: 100 })
```

### Component with JSON Field

For complex nested data, use the `json` type:

```typescript
const Inventory = defineComponent('Inventory', {
  capacity: 'number',
  items: 'json'  // Can store arrays or objects
})

ecs.addComponent(entity, Inventory, {
  capacity: 20,
  items: [
    { id: 'sword', quantity: 1 },
    { id: 'potion', quantity: 5 }
  ]
})
```

### Boolean Flags

```typescript
const PlayerControlled = defineComponent('PlayerControlled', {
  active: 'boolean'
})

ecs.addComponent(entity, PlayerControlled, { active: true })
```

## Related

- **[Entities](Concept-Entities)** - Components attach to entities
- **[Queries](Concept-Queries)** - Find entities by their components
- **[Component Definition API](API-Component-Definition)** - Full defineComponent() reference
- **[Component Operations API](API-Component-Operations)** - add, get, update, remove methods
