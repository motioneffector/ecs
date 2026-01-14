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

## Advanced Validation Tests

### SQL Injection Prevention

✓ escapes SQL keywords in component names
✓ handles component name "SELECT"
✓ handles component name "WHERE"
✓ handles component name "DROP"
✓ handles component name "DELETE"
✓ handles field name with SQL keywords
✓ handles entity id with SQL injection attempt

### Special Characters

✓ handles component name with spaces
✓ handles component name with hyphens
✓ handles component name with underscores
✓ handles field name with special characters
✓ handles backticks in component names
✓ handles quotes in component names

### Length Limits

✓ handles very long entity id (1000 chars)
✓ handles very long string field value (10MB)
✓ handles component name at boundary length
✓ handles entity id with only whitespace gets trimmed

### Null and Undefined Handling

✓ throws ValidationError for null component definition
✓ throws ValidationError for undefined component definition
✓ throws ValidationError for null entity id
✓ throws ValidationError for undefined field value
✓ distinguishes between null and undefined in json fields

---

## Error Message Validation

### defineComponent Errors

✓ ValidationError includes field name for empty name
✓ ValidationError includes field name for invalid type
✓ ValidationError message is descriptive for reserved field

### Entity Operation Errors

✓ ValidationError for non-existent entity includes entity id
✓ ValidationError for duplicate id includes the id value
✓ ValidationError message explains why operation failed

### Component Operation Errors

✓ ValidationError for missing field lists field name
✓ ValidationError for wrong type shows expected vs actual
✓ ValidationError for unregistered component includes component name
✓ DatabaseError preserves original error as cause
✓ error messages are user-friendly and actionable

### Query Errors

✓ empty component array returns all entities
✓ query with no matches returns empty array not null
✓ DatabaseError for invalid SQL includes SQL snippet

---

## Performance and Stress Tests

### Large Scale Entity Operations

✓ handles 100000 entities efficiently
✓ createEntity maintains constant time with many entities
✓ destroyEntity maintains constant time with many entities
✓ memory usage stays reasonable with 50000 entities

### Large Schema Operations

✓ handles component with 100 fields
✓ handles component with 50 string fields
✓ addComponent with large schema completes quickly
✓ getComponent with large schema completes quickly

### Large Data Operations

✓ handles 1MB JSON field value
✓ handles 10MB string field value
✓ handles deeply nested JSON (100 levels)
✓ handles JSON array with 10000 elements
✓ handles entity with 50 components attached

### Query Performance

✓ query with 5 components on 10000 entities is fast
✓ query with exclude on large dataset is fast
✓ query with filter on large dataset is fast
✓ queryWithData returns results in reasonable time
✓ multiple indexes improve query performance measurably

### Bulk Operation Performance

✓ addComponentBulk with 1000 entities completes quickly
✓ removeComponentBulk with 1000 entities completes quickly
✓ bulk operations faster than individual operations

---

## Concurrency and Transaction Tests

### Concurrent Transactions

✓ multiple simultaneous transactions execute correctly
✓ nested transactions within parallel operations work
✓ transaction rollback in one doesn't affect others
✓ concurrent reads during transaction see committed data

### Race Conditions

✓ concurrent entity creation generates unique ids
✓ concurrent component addition doesn't corrupt data
✓ concurrent updates to same component serialize correctly
✓ concurrent queries return consistent results

### Transaction Isolation

✓ uncommitted changes not visible outside transaction
✓ rolled back transaction leaves no side effects
✓ transaction callback receives correct ECS instance
✓ transaction can call other ECS methods safely

### Lock Contention

✓ high concurrency doesn't cause deadlocks
✓ long-running transaction doesn't block unrelated operations
✓ database handles multiple connections correctly

---

## Advanced Integration Tests

### Multi-Archetype Systems

✓ game with Player Enemy Item archetypes works together
✓ querying across different archetypes works correctly
✓ destroying entity with archetype removes all components
✓ archetype entities can have additional components added

### Complex Event Scenarios

✓ event handler can safely modify ECS
✓ event handler throwing error doesn't corrupt state
✓ removing component in event handler works
✓ unsubscribing within event handler works
✓ event handlers execute in registration order
✓ bulk operations fire events in correct order

### State Management Patterns

✓ ECS persists across application restart
✓ multiple ECS instances with same DB work correctly
✓ ECS cleanup releases resources properly
✓ re-initializing ECS preserves existing data

### Complex Query Patterns

✓ query with 10 component requirements works
✓ query with exclude list of 5 components works
✓ combining filter and exclude works correctly
✓ queryWithData with complex filter works
✓ chaining multiple queries works efficiently

---

## Data Integrity Tests

### Foreign Key Constraints

✓ orphaned component rows cannot exist
✓ deleting entity cascades to all 20 components
✓ foreign key violation throws DatabaseError
✓ cascade delete works with bulk operations

### Data Type Integrity

✓ boolean stored as 0 or 1 only
✓ number preserves floating point precision
✓ json serialization preserves data types
✓ string encoding handles all UTF-8 correctly

### Schema Validation

✓ schema cannot be modified after definition
✓ component definition is truly frozen
✓ attempting to modify schema throws error

---

## Cleanup and Resource Management

### Memory Management

✓ destroying 10000 entities doesn't leak memory
✓ event handlers are garbage collected after unsubscribe
✓ query results don't retain unnecessary references

### Database Cleanup

✓ component tables cleaned up on entity destruction
✓ indexes don't bloat database over time
✓ vacuuming database reclaims space

---

## Summary

Total test cases: 266

**Core Functionality (181 tests):**
- defineComponent: 11 tests
- createECS: 6 tests
- ecs.initialize: 13 tests
- ecs.createEntity: 10 tests
- ecs.destroyEntity: 6 tests
- ecs.addComponent: 16 tests
- ecs.getComponent: 8 tests
- ecs.updateComponent: 14 tests
- ecs.removeComponent: 6 tests
- ecs.hasComponent: 3 tests
- ecs.query: 10 tests
- ecs.queryWithData: 6 tests
- ecs.rawQuery: 6 tests
- ecs.transaction: 9 tests
- Bulk Operations: 7 tests
- Event System: 17 tests
- Archetypes: 9 tests
- ecs.addIndex: 6 tests
- ecs.getDatabase: 2 tests
- Integration Tests: 6 tests
- Edge Cases: 10 tests

**Extended Test Suite (85 tests):**
- Advanced Validation Tests: 22 tests
- Error Message Validation: 14 tests
- Performance and Stress Tests: 23 tests
- Concurrency and Transaction Tests: 15 tests
- Advanced Integration Tests: 15 tests
- Data Integrity Tests: 10 tests
- Cleanup and Resource Management: 5 tests
