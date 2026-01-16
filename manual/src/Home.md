# @motioneffector/ecs

An Entity Component System that stores your game state in SQL tables. Instead of managing objects in memory, you define component schemas and the ECS handles persistence, querying, and transactions automatically. Think of entities as database rows and components as the tables they belong to.

## I want to...

| Goal | Where to go |
|------|-------------|
| Get up and running quickly | [Your First ECS](Your-First-ECS) |
| Understand what components are | [Components](Concept-Components) |
| Understand how queries work | [Queries](Concept-Queries) |
| Handle entity lifecycle events | [Working with Events](Guide-Working-with-Events) |
| Use transactions for complex operations | [Using Transactions](Guide-Using-Transactions) |
| Look up a specific method | [API Reference](API-ECS-Core) |

## Key Concepts

### Components

Components are typed data schemas. You define a component once (like "Position" with x and y fields), then attach instances of it to any entity. Each entity can have zero or one of each component type.

### Entities

Entities are unique identifiers with no data of their own. They're just IDs that components attach to. Create an entity, add components to give it properties, query to find entities with specific components.

### Queries

Queries find entities based on which components they have. Ask for "all entities with Position and Health" and get back the matching entity IDs. Add filters to narrow by component data values.

## Quick Example

```typescript
import { createECS, defineComponent } from '@motioneffector/ecs'
import { createDatabase } from '@motioneffector/sql'

// Define your component schemas
const Position = defineComponent('Position', { x: 'number', y: 'number' })
const Health = defineComponent('Health', { current: 'number', max: 'number' })

// Create the ECS backed by a database
const db = await createDatabase()
const ecs = createECS(db, [Position, Health])
await ecs.initialize()

// Create an entity and add components
const player = ecs.createEntity()
ecs.addComponent(player, Position, { x: 100, y: 200 })
ecs.addComponent(player, Health, { current: 80, max: 100 })

// Query entities that have both components
const entities = ecs.query([Position, Health])
// entities = [player]

// Get component data
const pos = ecs.getComponent(player, Position)
// pos = { x: 100, y: 200 }
```

---

**[Full API Reference →](API-ECS-Core)**
