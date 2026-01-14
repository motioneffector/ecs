# Changelog

All notable changes to @motioneffector/ecs will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-13

### Added

- Initial release of @motioneffector/ecs
- SQL-backed Entity Component System implementation
- Core ECS operations:
  - `createEntity()` - Create entities with auto-generated UUID v7 or custom IDs
  - `destroyEntity()` - Delete entities with cascading component removal
  - `addComponent()` - Attach component data to entities
  - `getComponent()` - Retrieve component data from entities
  - `updateComponent()` - Partial update of component data
  - `removeComponent()` - Remove components from entities
  - `hasComponent()` - Check if entity has a component
- Query operations:
  - `query()` - Find entities by component composition with filters and exclusions
  - `queryWithData()` - Query entities and return component data
  - `rawQuery()` - Execute arbitrary SQL queries
- Bulk operations:
  - `addComponentBulk()` - Add component to multiple entities
  - `removeComponentBulk()` - Remove component from multiple entities
- Transaction support:
  - `transaction()` - Execute operations in ACID transaction
- Event system:
  - `onEntityCreated()` - Subscribe to entity creation events
  - `onEntityDestroyed()` - Subscribe to entity destruction events
  - `onComponentAdded()` - Subscribe to component addition events
  - `onComponentRemoved()` - Subscribe to component removal events
  - `onComponentUpdated()` - Subscribe to component update events
- Archetype support:
  - `defineArchetype()` - Create entity templates with multiple components
  - `createFromArchetype()` - Instantiate entities from archetypes
- Performance features:
  - `addIndex()` - Create database indexes on component fields
- Utility:
  - `getDatabase()` - Access underlying database instance
- Component definition with `defineComponent()`
- Support for field types: string, number, boolean, json
- Automatic SQL schema generation and table creation
- UUID v7 timestamp-sortable entity IDs
- Comprehensive type safety with TypeScript
- Event-driven architecture with unsubscribe support
- Zero runtime dependencies (peer dependency on @motioneffector/sql)

### Developer Experience

- Full TypeScript type definitions
- Comprehensive JSDoc documentation
- Test suite with 289 test cases
- ESLint and Prettier configuration
- Vite-based build system
