# ECS Core API

Functions for creating and initializing the ECS instance.

---

## `createECS()`

Creates an ECS instance backed by a SQL database. The ECS manages entities and components, providing persistence and querying.

**Signature:**

```typescript
function createECS(
  database: Database,
  components: readonly ComponentDefinition[]
): ECS
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `database` | `Database` | Yes | Database instance from @motioneffector/sql |
| `components` | `ComponentDefinition[]` | Yes | Array of component definitions to register |

**Returns:** `ECS` — The ECS instance with all management methods.

**Example:**

```typescript
import { createECS, defineComponent } from '@motioneffector/ecs'
import { createDatabase } from '@motioneffector/sql'

const Position = defineComponent('Position', { x: 'number', y: 'number' })
const Health = defineComponent('Health', { current: 'number', max: 'number' })

const db = await createDatabase()
const ecs = createECS(db, [Position, Health])
```

**Throws:**

- `ValidationError` — Database is null or undefined
- `ValidationError` — Components array contains duplicate names

---

## `ECS.initialize()`

Creates database tables for entities and all registered components. Call this once before using the ECS.

**Signature:**

```typescript
initialize(): Promise<void>
```

**Parameters:** None

**Returns:** `Promise<void>` — Resolves when initialization is complete.

**Example:**

```typescript
const ecs = createECS(db, [Position, Health])
await ecs.initialize()

// Now ready to create entities and add components
const entity = ecs.createEntity()
```

**Throws:**

- `DatabaseError` — Table creation fails

---

## `ECS.getDatabase()`

Returns the underlying database instance. Useful for advanced operations or debugging.

**Signature:**

```typescript
getDatabase(): Database
```

**Parameters:** None

**Returns:** `Database` — The database instance passed to createECS().

**Example:**

```typescript
const db = ecs.getDatabase()

// Use for advanced SQL operations
const tables = db.getTables()
console.log(tables)
```

---

## Types

### `ECS`

The main ECS interface with all entity and component management methods.

```typescript
interface ECS {
  // Initialization
  initialize(): Promise<void>

  // Entity operations
  createEntity(customId?: EntityId): EntityId
  destroyEntity(entityId: EntityId): boolean

  // Component operations
  addComponent<T extends ComponentSchema>(entityId: EntityId, component: ComponentDefinition<T>, data: InferComponentData<T>): EntityId
  getComponent<T extends ComponentSchema>(entityId: EntityId, component: ComponentDefinition<T>): InferComponentData<T> | null
  updateComponent<T extends ComponentSchema>(entityId: EntityId, component: ComponentDefinition<T>, data: Partial<InferComponentData<T>>): EntityId
  removeComponent<T extends ComponentSchema>(entityId: EntityId, component: ComponentDefinition<T>): EntityId
  hasComponent<T extends ComponentSchema>(entityId: EntityId, component: ComponentDefinition<T>): boolean

  // Query operations
  query<T extends ComponentSchema>(components: ComponentDefinition<T>[], options?: QueryOptions<T>): EntityId[]
  queryWithData<T extends ComponentDefinition[]>(components: T, options?: QueryOptions<T[number]['schema']>): QueryResult<T>[]
  rawQuery<T = unknown>(sql: string, params?: unknown[]): T[]

  // Bulk operations
  addComponentBulk<T extends ComponentSchema>(entityIds: EntityId[], component: ComponentDefinition<T>, data: InferComponentData<T>): void
  removeComponentBulk<T extends ComponentSchema>(entityIds: EntityId[], component: ComponentDefinition<T>): void

  // Transaction support
  transaction<T>(callback: TransactionCallback<T>): Promise<T>

  // Event subscriptions
  onEntityCreated(callback: EntityCreatedCallback): UnsubscribeFunction
  onEntityDestroyed(callback: EntityDestroyedCallback): UnsubscribeFunction
  onComponentAdded<T extends ComponentSchema>(component: ComponentDefinition<T>, callback: ComponentAddedCallback<T>): UnsubscribeFunction
  onComponentRemoved<T extends ComponentSchema>(component: ComponentDefinition<T>, callback: ComponentRemovedCallback): UnsubscribeFunction
  onComponentUpdated<T extends ComponentSchema>(component: ComponentDefinition<T>, callback: ComponentUpdatedCallback<T>): UnsubscribeFunction

  // Archetype support
  defineArchetype(components: readonly ComponentDefinition[]): ArchetypeDefinition
  createFromArchetype<T extends readonly ComponentDefinition[]>(archetype: ArchetypeDefinition, data: ArchetypeData<T>): EntityId

  // Index management
  addIndex<T extends ComponentSchema>(component: ComponentDefinition<T>, field: keyof InferComponentData<T>): void

  // Database access
  getDatabase(): Database
}
```

### `EntityId`

```typescript
type EntityId = string
```

Entity identifiers are strings - either auto-generated UUIDv7 or custom IDs you provide.
