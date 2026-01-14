/**
 * @motioneffector/ecs - SQL-backed Entity Component System
 *
 * A lightweight ECS implementation that stores components in SQL tables,
 * providing persistence, queryability, and ACID guarantees for game state.
 */

// Main factory functions
export { defineComponent } from './component'
export { createECS } from './ecs'

// Error classes
export { ECSError, ValidationError, DatabaseError } from './errors'

// Type exports
export type {
  FieldType,
  ComponentSchema,
  ComponentDefinition,
  InferComponentData,
  PartialComponentData,
  EntityId,
  QueryOptions,
  QueryResult,
  ArchetypeDefinition,
  ArchetypeData,
  EntityCreatedCallback,
  EntityDestroyedCallback,
  ComponentAddedCallback,
  ComponentRemovedCallback,
  ComponentUpdatedCallback,
  UnsubscribeFunction,
  TransactionCallback,
  ECS,
} from './types'
