# Test Specification: @motioneffector/ecs

## Overview

Comprehensive test suite for the SQL-backed Entity Component System. Covers entity management, component CRUD operations, queries, transactions, events, archetypes, and database integration.

---

## `defineComponent()`

### Basic Functionality

✓ creates component definition with name
✓ creates component definition with schema
✓ accepts string field type
✓ accepts number field type
✓ accepts boolean field type
✓ accepts json field type
✓ returns frozen component definition

### Validation

✓ throws ValidationError for empty name
✓ throws ValidationError for empty schema
✓ throws ValidationError for invalid field type
✓ throws ValidationError for reserved field name "entity_id"

---

## `createECS()`

### Basic Functionality

✓ creates ECS with database and components
✓ accepts empty components array
✓ returns object with all expected methods
✓ does not initialize database immediately

### Validation

✓ throws ValidationError for invalid database
✓ throws ValidationError for duplicate component names

---

## `ecs.initialize()`

### Schema Creation

✓ creates entities table
✓ creates component tables for each component
✓ component tables have entity_id primary key
✓ component tables have correct column types
✓ string fields become TEXT columns
✓ number fields become REAL columns
✓ boolean fields become INTEGER columns
✓ json fields become TEXT columns
✓ sets up foreign key to entities table
✓ sets up CASCADE delete on foreign key

### Idempotent

✓ can be called multiple times safely
✓ does not drop existing data on re-init

### Errors

✓ throws DatabaseError on SQL failure

---

## `ecs.createEntity()`

### Basic Creation

✓ creates entity with auto-generated UUID
✓ creates entity with custom id
✓ returns entity id
✓ adds entry to entities table
✓ stores created_at timestamp

### UUID Format

✓ generates UUID v7 format
✓ generated UUIDs are unique
✓ generated UUIDs are sortable by time

### Validation

✓ throws ValidationError for duplicate custom id
✓ throws ValidationError for empty string id

---

## `ecs.destroyEntity()`

### Basic Destruction

✓ removes entity from entities table
✓ cascades delete to all component tables
✓ returns true for existing entity
✓ returns false for non-existent entity

### Events

✓ fires onEntityDestroyed event
✓ fires onComponentRemoved for each component

---

## `ecs.addComponent()`

### Basic Addition

✓ adds component data to entity
✓ stores all schema fields
✓ returns entity id for chaining

### Field Types

✓ stores string values correctly
✓ stores number values correctly
✓ stores boolean true as 1
✓ stores boolean false as 0
✓ stores json values as serialized string
✓ retrieves json values as parsed objects

### Validation

✓ throws ValidationError for non-existent entity
✓ throws ValidationError for undefined component
✓ throws ValidationError for missing required field
✓ throws ValidationError for wrong field type
✓ throws ValidationError if component already exists on entity

### Events

✓ fires onComponentAdded event
✓ event includes entity id and component data

---

## `ecs.getComponent()`

### Basic Retrieval

✓ returns component data for entity
✓ returns null if entity lacks component
✓ returns null for non-existent entity
✓ returns all schema fields

### Field Types

✓ returns strings as strings
✓ returns numbers as numbers
✓ returns booleans as booleans
✓ returns json as parsed objects

---

## `ecs.updateComponent()`

### Partial Updates

✓ updates single field
✓ updates multiple fields
✓ preserves unspecified fields
✓ returns entity id for chaining

### Field Types

✓ updates string values
✓ updates number values
✓ updates boolean values
✓ updates json values

### Validation

✓ throws ValidationError for non-existent entity
✓ throws ValidationError if component not on entity
✓ throws ValidationError for invalid field type
✓ throws ValidationError for unknown field

### Events

✓ fires onComponentUpdated event
✓ event includes old and new data

---

## `ecs.removeComponent()`

### Basic Removal

✓ removes component from entity
✓ returns entity id for chaining
✓ does nothing if component not present

### Validation

✓ throws ValidationError for non-existent entity

### Events

✓ fires onComponentRemoved event
✓ event includes entity id

---

## `ecs.hasComponent()`

### Basic Check

✓ returns true if entity has component
✓ returns false if entity lacks component
✓ returns false for non-existent entity

---

## `ecs.query()`

### Basic Query

✓ returns entity ids with all specified components
✓ returns empty array if no matches
✓ requires all components (AND logic)

### With Filter

✓ applies filter function to results
✓ filter receives component data
✓ only returns entities passing filter

### With Exclude

✓ excludes entities with specified components
✓ combines with required components correctly

### Performance

✓ handles 1000 entities efficiently
✓ uses indexed lookups

---

## `ecs.queryWithData()`

### Basic Query

✓ returns entity ids with component data
✓ returns object with entityId property
✓ includes data for each queried component
✓ component data keyed by component name

### With Filter

✓ applies filter function
✓ filter receives all component data

---

## `ecs.rawQuery()`

### SQL Execution

✓ executes arbitrary SQL query
✓ returns result rows
✓ supports parameterized queries
✓ handles SELECT queries
✓ handles aggregate queries

### Validation

✓ throws DatabaseError for invalid SQL

---

## `ecs.transaction()`

### Basic Transaction

✓ executes callback in transaction
✓ commits on success
✓ all operations visible after commit

### Rollback

✓ rolls back on error
✓ entity not created on rollback
✓ component not added on rollback
✓ throws the original error

### Nested Transactions

✓ supports nested transaction calls
✓ inner rollback rolls back outer

---

## Bulk Operations

### `ecs.addComponentBulk()`

✓ adds component to multiple entities
✓ uses single transaction
✓ all or nothing on error
✓ fires events for each entity

### `ecs.removeComponentBulk()`

✓ removes component from multiple entities
✓ uses single transaction
✓ fires events for each entity

---

## Event System

### `onEntityCreated`

✓ fires when entity created
✓ receives entity id
✓ multiple listeners supported

### `onEntityDestroyed`

✓ fires when entity destroyed
✓ receives entity id

### `onComponentAdded`

✓ fires for specific component type
✓ receives entity id and data
✓ fires after data committed

### `onComponentRemoved`

✓ fires for specific component type
✓ receives entity id
✓ fires after removal committed

### `onComponentUpdated`

✓ fires for specific component type
✓ receives entity id, old data, new data
✓ fires after update committed

### Unsubscribe

✓ returns unsubscribe function
✓ unsubscribe stops events
✓ other listeners unaffected

---

## Archetypes

### `defineArchetype()`

✓ creates archetype from component list
✓ validates all components exist
✓ returns archetype definition

### `createFromArchetype()`

✓ creates entity with all archetype components
✓ accepts initial data for each component
✓ returns entity id
✓ fires onComponentAdded for each

### Validation

✓ throws ValidationError for missing component data
✓ validates each component's data

---

## `ecs.addIndex()`

### Index Creation

✓ creates index on component field
✓ index speeds up queries on that field
✓ can create multiple indexes
✓ index persists across restarts

### Validation

✓ throws ValidationError for unknown component
✓ throws ValidationError for unknown field

---

## `ecs.getDatabase()`

### Database Access

✓ returns underlying database instance
✓ can execute direct SQL on database

---

## Integration Tests

### Complex Workflows

✓ create entity, add components, query, update, destroy
✓ multiple entity types coexist
✓ large scale operations complete

### Persistence

✓ data survives database close/reopen
✓ queries work after restore
✓ events fire after restore

---

## Edge Cases

### Empty State

✓ query returns empty for no entities
✓ getComponent returns null for no entities

### Large Data

✓ handles 10000 entities
✓ handles component with large json field
✓ handles many components per entity

### Concurrent Operations

✓ transactions serialize correctly
✓ no data corruption under load

### Unicode

✓ handles unicode in string fields
✓ handles unicode in entity ids
✓ handles unicode in json fields

---

## Summary

Total test cases: 181

- defineComponent: 11 tests
- createECS: 6 tests
- ecs.initialize: 13 tests
- ecs.createEntity: 9 tests
- ecs.destroyEntity: 6 tests
- ecs.addComponent: 16 tests
- ecs.getComponent: 8 tests
- ecs.updateComponent: 15 tests
- ecs.removeComponent: 6 tests
- ecs.hasComponent: 3 tests
- ecs.query: 10 tests
- ecs.queryWithData: 6 tests
- ecs.rawQuery: 6 tests
- ecs.transaction: 9 tests
- Bulk Operations: 7 tests
- Event System: 18 tests
- Archetypes: 8 tests
- ecs.addIndex: 6 tests
- ecs.getDatabase: 2 tests
- Integration Tests: 6 tests
- Edge Cases: 11 tests
