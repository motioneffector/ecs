# @motioneffector/ecs

A SQL-backed Entity Component System that brings database persistence, ACID guarantees, and powerful querying to game state management.

[![npm version](https://img.shields.io/npm/v/@motioneffector/ecs.svg)](https://www.npmjs.com/package/@motioneffector/ecs)
[![license](https://img.shields.io/npm/l/@motioneffector/ecs.svg)](https://github.com/motioneffector/ecs/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

**[Try the interactive demo →](https://motioneffector.github.io/ecs/)**

## Features

- **SQL-Backed Persistence** - Entities and components stored in SQLite tables
- **ACID Transactions** - Full transaction support with automatic rollback
- **Type-Safe Components** - Complete TypeScript inference for component data
- **Powerful Queries** - Filter entities by components with predicates
- **Event System** - Subscribe to entity and component lifecycle events
- **Automatic Indexing** - Optimize queries with field-level indexes
- **Archetype Support** - Pre-define entity templates for common patterns
- **Bulk Operations** - Efficient batch add/remove for multiple entities

[Read the full manual →](https://github.com/motioneffector/ecs/wiki)

## Quick Start

```typescript
import { createECS, defineComponent } from '@motioneffector/ecs'
import { createDatabase } from '@motioneffector/sql'

// Define component schemas
const Position = defineComponent('Position', { x: 'number', y: 'number' })
const Health = defineComponent('Health', { current: 'number', max: 'number' })

// Initialize ECS with your database
const db = createDatabase(':memory:')
const ecs = createECS(db, [Position, Health])
await ecs.initialize()

// Create entities and add components
const player = ecs.createEntity('player-1')
ecs.addComponent(player, Position, { x: 100, y: 200 })
ecs.addComponent(player, Health, { current: 80, max: 100 })

// Query entities by components
const entities = ecs.query([Position, Health])
```

## Testing & Validation

- **Comprehensive test suite** - 325 unit tests covering core functionality
- **Fuzz tested** - Randomized input testing to catch edge cases
- **Strict TypeScript** - Full type coverage with no `any` types
- **ACID guarantees** - Full transaction support with rollback
- **Minimal dependencies** - Only @motioneffector/sql as peer dependency

## License

MIT © [motioneffector](https://github.com/motioneffector)
