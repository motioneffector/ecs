# Your First ECS

This guide walks you through creating a working Entity Component System in about 5 minutes.

By the end, you'll have an ECS with Position and Health components, a player entity, and a query that finds it.

## What We're Building

A simple game state system where:
- Entities can have Position (x, y coordinates) and Health (current/max HP)
- We can create a player entity with both components
- We can query to find all entities that have both components

## Step 1: Define Component Schemas

Components are data templates. Define them once, then attach instances to entities.

```typescript
import { defineComponent } from '@motioneffector/ecs'

const Position = defineComponent('Position', {
  x: 'number',
  y: 'number'
})

const Health = defineComponent('Health', {
  current: 'number',
  max: 'number'
})
```

Each field has a type: `'string'`, `'number'`, `'boolean'`, or `'json'` for complex data.

## Step 2: Create the Database and ECS

The ECS needs a database to store entity and component data. Pass your component definitions when creating the ECS.

```typescript
import { createDatabase } from '@motioneffector/sql'
import { createECS } from '@motioneffector/ecs'

const db = await createDatabase()  // In-memory database
const ecs = createECS(db, [Position, Health])
```

## Step 3: Initialize

Initialize creates the database tables for your components. Call this once before using the ECS.

```typescript
await ecs.initialize()
```

## Step 4: Create an Entity

Entities are just unique IDs. Create one, then add components to give it data.

```typescript
const player = ecs.createEntity()
// player = "0190a5b7-..."  (auto-generated UUID)
```

You can also provide a custom ID:

```typescript
const player = ecs.createEntity('player-1')
```

## Step 5: Add Components

Attach component data to your entity. The data must match the schema you defined.

```typescript
ecs.addComponent(player, Position, { x: 100, y: 200 })
ecs.addComponent(player, Health, { current: 80, max: 100 })
```

## Step 6: Query Entities

Find entities that have specific components. This returns an array of entity IDs.

```typescript
const entities = ecs.query([Position, Health])
// entities = ['player-1']

// Get component data for an entity
const pos = ecs.getComponent(player, Position)
// pos = { x: 100, y: 200 }

const hp = ecs.getComponent(player, Health)
// hp = { current: 80, max: 100 }
```

## The Complete Code

Here's everything together:

```typescript
import { createDatabase } from '@motioneffector/sql'
import { createECS, defineComponent } from '@motioneffector/ecs'

// 1. Define components
const Position = defineComponent('Position', {
  x: 'number',
  y: 'number'
})

const Health = defineComponent('Health', {
  current: 'number',
  max: 'number'
})

// 2. Create database and ECS
const db = await createDatabase()
const ecs = createECS(db, [Position, Health])

// 3. Initialize (creates tables)
await ecs.initialize()

// 4. Create an entity
const player = ecs.createEntity('player-1')

// 5. Add components
ecs.addComponent(player, Position, { x: 100, y: 200 })
ecs.addComponent(player, Health, { current: 80, max: 100 })

// 6. Query
const entities = ecs.query([Position, Health])
console.log(entities)  // ['player-1']

const pos = ecs.getComponent(player, Position)
console.log(pos)  // { x: 100, y: 200 }
```

## What's Next?

Now that you have the basics:

- **[Understand Components better](Concept-Components)** - Learn about field types and validation
- **[Learn about Queries](Concept-Queries)** - Filter entities by component data
- **[Handle events](Guide-Working-with-Events)** - React when entities or components change
- **[Explore the API](API-ECS-Core)** - Full reference when you need details
