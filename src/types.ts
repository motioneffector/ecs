/**
 * Type definitions for @motioneffector/ecs
 */

import type { Database } from '@motioneffector/sql'

/**
 * Supported field types for component schemas
 */
export type FieldType = 'string' | 'number' | 'boolean' | 'json'

/**
 * Schema definition for a component
 * Maps field names to their types
 */
export type ComponentSchema = Record<string, FieldType>

/**
 * Component definition created by defineComponent()
 */
export interface ComponentDefinition<T extends ComponentSchema = ComponentSchema> {
  readonly name: string
  readonly schema: T
}

/**
 * Infer the TypeScript type from a component schema
 */
export type InferComponentData<T extends ComponentSchema> = {
  [K in keyof T]: T[K] extends 'string'
    ? string
    : T[K] extends 'number'
      ? number
      : T[K] extends 'boolean'
        ? boolean
        : T[K] extends 'json'
          ? unknown
          : never
}

/**
 * Entity ID type - can be auto-generated UUID or custom string
 */
export type EntityId = string

/**
 * Component data with optional fields for partial updates
 */
export type PartialComponentData<T extends ComponentSchema> = Partial<InferComponentData<T>>

/**
 * Query options for filtering entities
 */
export interface QueryOptions<T extends ComponentSchema> {
  filter?: (data: InferComponentData<T>) => boolean
  exclude?: ComponentDefinition[]
}

/**
 * Result of queryWithData - entity with component data
 */
export type QueryResult<T extends ComponentDefinition[]> = {
  entityId: EntityId
} & {
  [K in T[number]['name']]: InferComponentData<Extract<T[number], { name: K }>['schema']>
}

/**
 * Archetype definition - a collection of component definitions
 */
export interface ArchetypeDefinition {
  readonly components: readonly ComponentDefinition[]
}

/**
 * Data for creating an entity from an archetype
 */
export type ArchetypeData<T extends readonly ComponentDefinition[]> = {
  [K in T[number]['name']]: InferComponentData<Extract<T[number], { name: K }>['schema']>
}

/**
 * Event callback types
 */
export type EntityCreatedCallback = (entityId: EntityId) => void
export type EntityDestroyedCallback = (entityId: EntityId) => void
export type ComponentAddedCallback<T extends ComponentSchema> = (
  entityId: EntityId,
  data: InferComponentData<T>
) => void
export type ComponentRemovedCallback = (entityId: EntityId) => void
export type ComponentUpdatedCallback<T extends ComponentSchema> = (
  entityId: EntityId,
  oldData: InferComponentData<T>,
  newData: InferComponentData<T>
) => void

/**
 * Unsubscribe function returned by event subscriptions
 */
export type UnsubscribeFunction = () => void

/**
 * Transaction callback type
 */
export type TransactionCallback<T> = (ecs: ECS) => T

/**
 * Main ECS interface
 */
export interface ECS {
  // Initialization
  initialize(): Promise<void>

  // Entity operations
  createEntity(customId?: EntityId): EntityId
  destroyEntity(entityId: EntityId): boolean

  // Component operations
  addComponent<T extends ComponentSchema>(
    entityId: EntityId,
    component: ComponentDefinition<T>,
    data: InferComponentData<T>
  ): EntityId
  getComponent<T extends ComponentSchema>(
    entityId: EntityId,
    component: ComponentDefinition<T>
  ): InferComponentData<T> | null
  updateComponent<T extends ComponentSchema>(
    entityId: EntityId,
    component: ComponentDefinition<T>,
    data: PartialComponentData<T>
  ): EntityId
  removeComponent<T extends ComponentSchema>(
    entityId: EntityId,
    component: ComponentDefinition<T>
  ): EntityId
  hasComponent<T extends ComponentSchema>(
    entityId: EntityId,
    component: ComponentDefinition<T>
  ): boolean

  // Query operations
  query<T extends ComponentSchema>(
    components: ComponentDefinition<T>[],
    options?: QueryOptions<T>
  ): EntityId[]
  queryWithData<T extends ComponentDefinition[]>(
    components: T,
    options?: QueryOptions<T[number]['schema']>
  ): QueryResult<T>[]
  rawQuery<T = unknown>(sql: string, params?: unknown[]): T[]

  // Bulk operations
  addComponentBulk<T extends ComponentSchema>(
    entityIds: EntityId[],
    component: ComponentDefinition<T>,
    data: InferComponentData<T>
  ): void
  removeComponentBulk<T extends ComponentSchema>(
    entityIds: EntityId[],
    component: ComponentDefinition<T>
  ): void

  // Transaction support
  transaction<T>(callback: TransactionCallback<T>): Promise<T>

  // Event subscriptions
  onEntityCreated(callback: EntityCreatedCallback): UnsubscribeFunction
  onEntityDestroyed(callback: EntityDestroyedCallback): UnsubscribeFunction
  onComponentAdded<T extends ComponentSchema>(
    component: ComponentDefinition<T>,
    callback: ComponentAddedCallback<T>
  ): UnsubscribeFunction
  onComponentRemoved<T extends ComponentSchema>(
    component: ComponentDefinition<T>,
    callback: ComponentRemovedCallback
  ): UnsubscribeFunction
  onComponentUpdated<T extends ComponentSchema>(
    component: ComponentDefinition<T>,
    callback: ComponentUpdatedCallback<T>
  ): UnsubscribeFunction

  // Archetype support
  defineArchetype<T extends readonly ComponentDefinition[]>(
    components: T
  ): ArchetypeDefinition
  createFromArchetype<T extends readonly ComponentDefinition[]>(
    archetype: ArchetypeDefinition,
    data: ArchetypeData<T>
  ): EntityId

  // Index management
  addIndex<T extends ComponentSchema>(
    component: ComponentDefinition<T>,
    field: keyof InferComponentData<T>
  ): void

  // Database access
  getDatabase(): Database
}
