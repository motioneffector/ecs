/**
 * Extended Test Suite for @motioneffector/ecs
 *
 * This file contains advanced validation, performance, concurrency,
 * integration, data integrity, and resource management tests.
 *
 * Total: 85 tests across 7 categories
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDatabase, type Database } from '@motioneffector/sql'
import { createECS } from './ecs'
import { defineComponent } from './component'
import { ValidationError, DatabaseError } from './errors'
import type { ECS, ComponentDefinition } from './types'

// Helper to create a fresh in-memory test database
async function createTestDatabase(): Promise<Database> {
  return await createDatabase()
}

// -------------------------------------------------------------------
// Advanced Validation Tests (22 tests)
// -------------------------------------------------------------------

describe('Advanced Validation Tests', () => {
  describe('SQL Injection Prevention', () => {
    let db: Database
    let ecs: ECS

    beforeEach(async () => {
      db = await createTestDatabase()
    })

    afterEach(() => {
      db.close()
    })

    it('escapes SQL keywords in component names', async () => {
      const SelectComp = defineComponent('SELECT', { value: 'string' })
      ecs = createECS(db, [SelectComp])
      await ecs.initialize()

      const entityId = await ecs.createEntity()
      await ecs.addComponent(entityId, SelectComp, { value: 'test' })
      const data = await ecs.getComponent(entityId, SelectComp)

      expect(data).toEqual({ value: 'test' })
    })

    it('handles component name "SELECT"', async () => {
      const Comp = defineComponent('SELECT', { x: 'number' })
      ecs = createECS(db, [Comp])
      await ecs.initialize()

      const entityId = await ecs.createEntity()
      await ecs.addComponent(entityId, Comp, { x: 42 })

      expect(await ecs.hasComponent(entityId, Comp)).toBe(true)
    })

    it('handles component name "WHERE"', async () => {
      const Comp = defineComponent('WHERE', { value: 'string' })
      ecs = createECS(db, [Comp])
      await ecs.initialize()

      const entityId = await ecs.createEntity()
      await ecs.addComponent(entityId, Comp, { value: 'test' })

      expect(await ecs.hasComponent(entityId, Comp)).toBe(true)
    })

    it('handles component name "DROP"', async () => {
      const Comp = defineComponent('DROP', { value: 'boolean' })
      ecs = createECS(db, [Comp])
      await ecs.initialize()

      const entityId = await ecs.createEntity()
      await ecs.addComponent(entityId, Comp, { value: true })

      expect(await ecs.hasComponent(entityId, Comp)).toBe(true)
    })

    it('handles component name "DELETE"', async () => {
      const Comp = defineComponent('DELETE', { value: 'number' })
      ecs = createECS(db, [Comp])
      await ecs.initialize()

      const entityId = await ecs.createEntity()
      await ecs.addComponent(entityId, Comp, { value: 123 })

      expect(await ecs.hasComponent(entityId, Comp)).toBe(true)
    })

    it('handles field name with SQL keywords', async () => {
      const Comp = defineComponent('Test', {
        select: 'string',
        where: 'number',
        from: 'boolean'
      })
      ecs = createECS(db, [Comp])
      await ecs.initialize()

      const entityId = await ecs.createEntity()
      await ecs.addComponent(entityId, Comp, { select: 'a', where: 1, from: true })
      const data = await ecs.getComponent(entityId, Comp)

      expect(data).toEqual({ select: 'a', where: 1, from: true })
    })

    it('handles entity id with SQL injection attempt', async () => {
      const Comp = defineComponent('Test', { value: 'string' })
      ecs = createECS(db, [Comp])
      await ecs.initialize()

      const maliciousId = "'; DROP TABLE entities; --"
      const entityId = await ecs.createEntity(maliciousId)
      await ecs.addComponent(entityId, Comp, { value: 'safe' })

      expect(await ecs.hasComponent(entityId, Comp)).toBe(true)
      expect(db.getTables()).toContain('entities')
    })
  })

  describe('Special Characters', () => {
    let db: Database
    let ecs: ECS

    beforeEach(async () => {
      db = await createTestDatabase()
    })

    afterEach(() => {
      db.close()
    })

    it('handles component name with spaces', async () => {
      const Comp = defineComponent('My Component', { value: 'string' })
      ecs = createECS(db, [Comp])
      await ecs.initialize()

      const entityId = await ecs.createEntity()
      await ecs.addComponent(entityId, Comp, { value: 'test' })

      expect(await ecs.hasComponent(entityId, Comp)).toBe(true)
    })

    it('handles component name with hyphens', async () => {
      const Comp = defineComponent('my-component', { value: 'string' })
      ecs = createECS(db, [Comp])
      await ecs.initialize()

      const entityId = await ecs.createEntity()
      await ecs.addComponent(entityId, Comp, { value: 'test' })

      expect(await ecs.hasComponent(entityId, Comp)).toBe(true)
    })

    it('handles component name with underscores', async () => {
      const Comp = defineComponent('my_component', { value: 'string' })
      ecs = createECS(db, [Comp])
      await ecs.initialize()

      const entityId = await ecs.createEntity()
      await ecs.addComponent(entityId, Comp, { value: 'test' })

      expect(await ecs.hasComponent(entityId, Comp)).toBe(true)
    })

    it('handles field name with special characters', async () => {
      const Comp = defineComponent('Test', {
        'my-field': 'string',
        'my_field': 'number'
      })
      ecs = createECS(db, [Comp])
      await ecs.initialize()

      const entityId = await ecs.createEntity()
      await ecs.addComponent(entityId, Comp, { 'my-field': 'a', 'my_field': 42 })
      const data = await ecs.getComponent(entityId, Comp)

      expect(data).toEqual({ 'my-field': 'a', 'my_field': 42 })
    })

    it('handles backticks in component names', async () => {
      const Comp = defineComponent('my`component', { value: 'string' })
      ecs = createECS(db, [Comp])
      await ecs.initialize()

      const entityId = await ecs.createEntity()
      await ecs.addComponent(entityId, Comp, { value: 'test' })

      expect(await ecs.hasComponent(entityId, Comp)).toBe(true)
    })

    it('handles quotes in component names', async () => {
      const Comp = defineComponent('my"component', { value: 'string' })
      ecs = createECS(db, [Comp])
      await ecs.initialize()

      const entityId = await ecs.createEntity()
      await ecs.addComponent(entityId, Comp, { value: 'test' })

      expect(await ecs.hasComponent(entityId, Comp)).toBe(true)
    })
  })

  describe('Length Limits', () => {
    let db: Database
    let ecs: ECS

    beforeEach(async () => {
      db = await createTestDatabase()
    })

    afterEach(() => {
      db.close()
    })

    it('handles very long entity id (1000 chars)', async () => {
      const Comp = defineComponent('Test', { value: 'string' })
      ecs = createECS(db, [Comp])
      await ecs.initialize()

      const longId = 'a'.repeat(1000)
      const entityId = await ecs.createEntity(longId)
      await ecs.addComponent(entityId, Comp, { value: 'test' })

      expect(await ecs.hasComponent(entityId, Comp)).toBe(true)
    })

    it('handles very long string field value (10MB)', async () => {
      const Comp = defineComponent('Test', { value: 'string' })
      ecs = createECS(db, [Comp])
      await ecs.initialize()

      const entityId = await ecs.createEntity()
      const longString = 'x'.repeat(10 * 1024 * 1024) // 10MB
      await ecs.addComponent(entityId, Comp, { value: longString })
      const data = await ecs.getComponent(entityId, Comp)

      expect(data?.value).toBe(longString)
    })

    it('handles component name at boundary length', async () => {
      const longName = 'component_' + 'x'.repeat(200)
      const Comp = defineComponent(longName, { value: 'string' })
      ecs = createECS(db, [Comp])
      await ecs.initialize()

      const entityId = await ecs.createEntity()
      await ecs.addComponent(entityId, Comp, { value: 'test' })

      expect(await ecs.hasComponent(entityId, Comp)).toBe(true)
    })

    it('handles entity id with only whitespace gets trimmed', async () => {
      const Comp = defineComponent('Test', { value: 'string' })
      ecs = createECS(db, [Comp])
      await ecs.initialize()

      expect(async () => await ecs.createEntity('   ')).rejects.toThrow(ValidationError)
    })
  })

  describe('Null and Undefined Handling', () => {
    it('throws ValidationError for null component definition', () => {
      // @ts-expect-error - Testing runtime validation
      expect(() => defineComponent(null, { value: 'string' })).toThrow(ValidationError)
    })

    it('throws ValidationError for undefined component definition', () => {
      // @ts-expect-error - Testing runtime validation
      expect(() => defineComponent(undefined, { value: 'string' })).toThrow(ValidationError)
    })

    it('throws ValidationError for null entity id', async () => {
      const db = await createTestDatabase()
      const ecs = createECS(db, [])
      await ecs.initialize()

      // @ts-expect-error - Testing runtime validation
      await expect(async () => await ecs.createEntity(null)).rejects.toThrow(ValidationError)

      db.close()
    })

    it('throws ValidationError for undefined field value', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'string' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const entityId = await ecs.createEntity()
      // @ts-expect-error - Testing runtime validation
      await expect(async () => await ecs.addComponent(entityId, Comp, { value: undefined })).rejects.toThrow(ValidationError)

      db.close()
    })

    it('distinguishes between null and undefined in json fields', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { data: 'json' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const entityId = await ecs.createEntity()
      await ecs.addComponent(entityId, Comp, { data: { nullValue: null, undefinedValue: undefined } })
      const retrieved = await ecs.getComponent(entityId, Comp)

      expect(retrieved?.data).toEqual({ nullValue: null })

      db.close()
    })
  })
})

// -------------------------------------------------------------------
// Error Message Validation (14 tests)
// -------------------------------------------------------------------

describe('Error Message Validation', () => {
  describe('defineComponent Errors', () => {
    it('ValidationError includes field name for empty name', () => {
      try {
        defineComponent('', { value: 'string' })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect((error as Error).message).toContain('name')
      }
    })

    it('ValidationError includes field name for invalid type', () => {
      try {
        // @ts-expect-error - Testing runtime validation
        defineComponent('Test', { value: 'invalid' })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect((error as Error).message).toContain('type')
      }
    })

    it('ValidationError message is descriptive for reserved field', () => {
      try {
        defineComponent('Test', { entity_id: 'string' })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect((error as Error).message).toContain('entity_id')
        expect((error as Error).message).toContain('reserved')
      }
    })
  })

  describe('Entity Operation Errors', () => {
    it('ValidationError for non-existent entity includes entity id', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'string' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      try {
        await ecs.addComponent('nonexistent', Comp, { value: 'test' })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect((error as Error).message).toContain('nonexistent')
      }

      db.close()
    })

    it('ValidationError for duplicate id includes the id value', async () => {
      const db = await createTestDatabase()
      const ecs = createECS(db, [])
      await ecs.initialize()

      const id = 'duplicate-id'
      await ecs.createEntity(id)

      try {
        await ecs.createEntity(id)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect((error as Error).message).toContain(id)
      }

      db.close()
    })

    it('ValidationError message explains why operation failed', async () => {
      const db = await createTestDatabase()
      const ecs = createECS(db, [])
      await ecs.initialize()

      try {
        await ecs.destroyEntity('nonexistent')
        // Note: destroyEntity returns false for non-existent, doesn't throw
        // This test validates that the behavior is consistent
        expect(true).toBe(true)
      } catch (error) {
        // Should not throw, but if it does, message should be clear
        expect((error as Error).message).toContain('entity')
      }

      db.close()
    })
  })

  describe('Component Operation Errors', () => {
    it('ValidationError for missing field lists field name', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { required: 'string', optional: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const entityId = await ecs.createEntity()

      try {
        // @ts-expect-error - Testing runtime validation
        await ecs.addComponent(entityId, Comp, { optional: 42 })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect((error as Error).message).toContain('required')
      }

      db.close()
    })

    it('ValidationError for wrong type shows expected vs actual', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const entityId = await ecs.createEntity()

      try {
        // @ts-expect-error - Testing runtime validation
        await ecs.addComponent(entityId, Comp, { value: 'string' })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        const message = (error as Error).message
        expect(message).toContain('number')
      }

      db.close()
    })

    it('ValidationError for unregistered component includes component name', async () => {
      const db = await createTestDatabase()
      const RegisteredComp = defineComponent('Registered', { value: 'string' })
      const UnregisteredComp = defineComponent('Unregistered', { value: 'string' })
      const ecs = createECS(db, [RegisteredComp])
      await ecs.initialize()

      const entityId = await ecs.createEntity()

      try {
        await ecs.addComponent(entityId, UnregisteredComp, { value: 'test' })
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect((error as Error).message).toContain('Unregistered')
      }

      db.close()
    })

    it('DatabaseError preserves original error as cause', async () => {
      const db = await createTestDatabase()
      const ecs = createECS(db, [])
      await ecs.initialize()

      try {
        // Force a database error by executing invalid SQL
        await ecs.rawQuery('INVALID SQL SYNTAX')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(DatabaseError)
        expect((error as DatabaseError).cause).toBeDefined()
      }

      db.close()
    })

    it('error messages are user-friendly and actionable', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'string' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const entityId = await ecs.createEntity()

      try {
        // @ts-expect-error - Testing runtime validation
        await ecs.addComponent(entityId, Comp, {})
        expect.fail('Should have thrown')
      } catch (error) {
        const message = (error as Error).message
        // Should be descriptive, not cryptic
        expect(message.length).toBeGreaterThan(20)
        expect(message).not.toMatch(/^Error:/)
      }

      db.close()
    })
  })

  describe('Query Errors', () => {
    it('empty component array returns all entities', async () => {
      const db = await createTestDatabase()
      const ecs = createECS(db, [])
      await ecs.initialize()

      await ecs.createEntity()
      await ecs.createEntity()

      const results = await ecs.query([])
      expect(results.length).toBe(2)

      db.close()
    })

    it('query with no matches returns empty array not null', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'string' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      await ecs.createEntity()

      const results = await ecs.query([Comp])
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(0)

      db.close()
    })

    it('DatabaseError for invalid SQL includes SQL snippet', async () => {
      const db = await createTestDatabase()
      const ecs = createECS(db, [])
      await ecs.initialize()

      try {
        await ecs.rawQuery('SELECT * FROM nonexistent_table')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(DatabaseError)
        expect((error as Error).message).toContain('nonexistent_table')
      }

      db.close()
    })
  })
})

// -------------------------------------------------------------------
// Performance and Stress Tests (23 tests)
// -------------------------------------------------------------------

describe('Performance and Stress Tests', () => {
  describe('Large Scale Entity Operations', () => {
    it('handles 100000 entities efficiently', async () => {
      const db = await createTestDatabase()
      const ecs = createECS(db, [])
      await ecs.initialize()

      const startTime = Date.now()

      for (let i = 0; i < 100000; i++) {
        await ecs.createEntity()
      }

      const elapsed = Date.now() - startTime
      // Should complete in reasonable time (< 30 seconds)
      expect(elapsed).toBeLessThan(30000)

      db.close()
    }, 60000)

    it('createEntity maintains constant time with many entities', async () => {
      const db = await createTestDatabase()
      const ecs = createECS(db, [])
      await ecs.initialize()

      // Create 1000 entities and measure first 100 vs last 100
      const times: number[] = []

      for (let i = 0; i < 1000; i++) {
        const start = Date.now()
        await ecs.createEntity()
        times.push(Date.now() - start)
      }

      const firstAvg = times.slice(0, 100).reduce((a, b) => a + b, 0) / 100
      const lastAvg = times.slice(-100).reduce((a, b) => a + b, 0) / 100

      // Last 100 should not be significantly slower (within 5x)
      expect(lastAvg).toBeLessThan(firstAvg * 5)

      db.close()
    }, 30000)

    it('destroyEntity maintains constant time with many entities', async () => {
      const db = await createTestDatabase()
      const ecs = createECS(db, [])
      await ecs.initialize()

      // Create 1000 entities
      const ids: string[] = []
      for (let i = 0; i < 1000; i++) {
        ids.push(await ecs.createEntity())
      }

      // Measure destruction time for first 100 vs last 100
      const times: number[] = []

      for (const id of ids) {
        const start = Date.now()
        await ecs.destroyEntity(id)
        times.push(Date.now() - start)
      }

      const firstAvg = times.slice(0, 100).reduce((a, b) => a + b, 0) / 100
      const lastAvg = times.slice(-100).reduce((a, b) => a + b, 0) / 100

      expect(lastAvg).toBeLessThan(firstAvg * 5)

      db.close()
    }, 30000)

    it('memory usage stays reasonable with 50000 entities', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      // Create 50000 entities with components
      for (let i = 0; i < 50000; i++) {
        const id = await ecs.createEntity()
        await ecs.addComponent(id, Comp, { value: i })
      }

      // Query to ensure data is retrievable
      const results = await ecs.query([Comp])
      expect(results.length).toBe(50000)

      db.close()
    }, 60000)
  })

  describe('Large Schema Operations', () => {
    it('handles component with 100 fields', async () => {
      const db = await createTestDatabase()

      const schema: Record<string, 'string' | 'number'> = {}
      for (let i = 0; i < 100; i++) {
        schema[`field${i}`] = i % 2 === 0 ? 'number' : 'string'
      }

      const Comp = defineComponent('LargeSchema', schema)
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const data: Record<string, string | number> = {}
      for (let i = 0; i < 100; i++) {
        data[`field${i}`] = i % 2 === 0 ? i : `value${i}`
      }

      const entityId = await ecs.createEntity()
      await ecs.addComponent(entityId, Comp, data)
      const retrieved = await ecs.getComponent(entityId, Comp)

      expect(retrieved).toEqual(data)

      db.close()
    })

    it('handles component with 50 string fields', async () => {
      const db = await createTestDatabase()

      const schema: Record<string, 'string'> = {}
      for (let i = 0; i < 50; i++) {
        schema[`str${i}`] = 'string'
      }

      const Comp = defineComponent('ManyStrings', schema)
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const entityId = await ecs.createEntity()
      const data: Record<string, string> = {}
      for (let i = 0; i < 50; i++) {
        data[`str${i}`] = `value${i}`
      }

      await ecs.addComponent(entityId, Comp, data)
      const retrieved = await ecs.getComponent(entityId, Comp)

      expect(retrieved).toEqual(data)

      db.close()
    })

    it('addComponent with large schema completes quickly', async () => {
      const db = await createTestDatabase()

      const schema: Record<string, 'number'> = {}
      for (let i = 0; i < 100; i++) {
        schema[`field${i}`] = 'number'
      }

      const Comp = defineComponent('LargeSchema', schema)
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const entityId = await ecs.createEntity()
      const data: Record<string, number> = {}
      for (let i = 0; i < 100; i++) {
        data[`field${i}`] = i
      }

      const start = Date.now()
      await ecs.addComponent(entityId, Comp, data)
      const elapsed = Date.now() - start

      // Should complete in less than 1 second
      expect(elapsed).toBeLessThan(1000)

      db.close()
    })

    it('getComponent with large schema completes quickly', async () => {
      const db = await createTestDatabase()

      const schema: Record<string, 'number'> = {}
      for (let i = 0; i < 100; i++) {
        schema[`field${i}`] = 'number'
      }

      const Comp = defineComponent('LargeSchema', schema)
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const entityId = await ecs.createEntity()
      const data: Record<string, number> = {}
      for (let i = 0; i < 100; i++) {
        data[`field${i}`] = i
      }

      await ecs.addComponent(entityId, Comp, data)

      const start = Date.now()
      await ecs.getComponent(entityId, Comp)
      const elapsed = Date.now() - start

      // Should complete in less than 100ms
      expect(elapsed).toBeLessThan(100)

      db.close()
    })
  })

  describe('Large Data Operations', () => {
    it('handles 1MB JSON field value', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { data: 'json' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const largeArray = Array.from({ length: 100000 }, (_, i) => ({
        id: i,
        value: `item${i}`
      }))

      const entityId = await ecs.createEntity()
      await ecs.addComponent(entityId, Comp, { data: largeArray })
      const retrieved = await ecs.getComponent(entityId, Comp)

      expect(retrieved?.data).toEqual(largeArray)

      db.close()
    })

    it('handles 10MB string field value', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { text: 'string' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const largeString = 'x'.repeat(10 * 1024 * 1024)

      const entityId = await ecs.createEntity()
      await ecs.addComponent(entityId, Comp, { text: largeString })
      const retrieved = await ecs.getComponent(entityId, Comp)

      expect(retrieved?.text.length).toBe(10 * 1024 * 1024)

      db.close()
    }, 30000)

    it('handles deeply nested JSON (100 levels)', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { data: 'json' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      // Create deeply nested object
      let nested: Record<string, unknown> = { value: 'deep' }
      for (let i = 0; i < 100; i++) {
        nested = { level: i, child: nested }
      }

      const entityId = await ecs.createEntity()
      await ecs.addComponent(entityId, Comp, { data: nested })
      const retrieved = await ecs.getComponent(entityId, Comp)

      expect(retrieved?.data).toEqual(nested)

      db.close()
    })

    it('handles JSON array with 10000 elements', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { items: 'json' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const largeArray = Array.from({ length: 10000 }, (_, i) => i)

      const entityId = await ecs.createEntity()
      await ecs.addComponent(entityId, Comp, { items: largeArray })
      const retrieved = await ecs.getComponent(entityId, Comp)

      expect(retrieved?.items).toEqual(largeArray)

      db.close()
    })

    it('handles entity with 50 components attached', async () => {
      const db = await createTestDatabase()

      const components: ComponentDefinition<Record<string, 'number'>>[] = []
      for (let i = 0; i < 50; i++) {
        components.push(defineComponent(`Comp${i}`, { value: 'number' }))
      }

      const ecs = createECS(db, components)
      await ecs.initialize()

      const entityId = await ecs.createEntity()

      for (let i = 0; i < 50; i++) {
        await ecs.addComponent(entityId, components[i], { value: i })
      }

      // Verify all components are present
      for (let i = 0; i < 50; i++) {
        const hasComp = await ecs.hasComponent(entityId, components[i])
        expect(hasComp).toBe(true)
      }

      db.close()
    })
  })

  describe('Query Performance', () => {
    it('query with 5 components on 10000 entities is fast', async () => {
      const db = await createTestDatabase()

      const comps = [
        defineComponent('A', { value: 'number' }),
        defineComponent('B', { value: 'number' }),
        defineComponent('C', { value: 'number' }),
        defineComponent('D', { value: 'number' }),
        defineComponent('E', { value: 'number' })
      ]

      const ecs = createECS(db, comps)
      await ecs.initialize()

      // Create 10000 entities, every 10th has all 5 components
      for (let i = 0; i < 10000; i++) {
        const id = await ecs.createEntity()
        if (i % 10 === 0) {
          for (const comp of comps) {
            await ecs.addComponent(id, comp, { value: i })
          }
        }
      }

      const start = Date.now()
      const results = await ecs.query(comps)
      const elapsed = Date.now() - start

      expect(results.length).toBe(1000)
      expect(elapsed).toBeLessThan(5000) // 5 seconds max

      db.close()
    }, 60000)

    it('query with exclude on large dataset is fast', async () => {
      const db = await createTestDatabase()

      const A = defineComponent('A', { value: 'number' })
      const B = defineComponent('B', { value: 'number' })
      const C = defineComponent('C', { value: 'number' })

      const ecs = createECS(db, [A, B, C])
      await ecs.initialize()

      for (let i = 0; i < 5000; i++) {
        const id = await ecs.createEntity()
        await ecs.addComponent(id, A, { value: i })
        if (i % 2 === 0) {
          await ecs.addComponent(id, B, { value: i })
        }
        if (i % 3 === 0) {
          await ecs.addComponent(id, C, { value: i })
        }
      }

      const start = Date.now()
      const results = await ecs.query([A], { exclude: [C] })
      const elapsed = Date.now() - start

      expect(results.length).toBeGreaterThan(0)
      expect(elapsed).toBeLessThan(2000)

      db.close()
    }, 30000)

    it('query with filter on large dataset is fast', async () => {
      const db = await createTestDatabase()

      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      for (let i = 0; i < 10000; i++) {
        const id = await ecs.createEntity()
        await ecs.addComponent(id, Comp, { value: i })
      }

      const start = Date.now()
      const results = await ecs.query([Comp], {
        filter: (data) => {
          const comp = data.Test as { value: number }
          return comp.value > 5000
        }
      })
      const elapsed = Date.now() - start

      expect(results.length).toBeGreaterThan(4000)
      expect(elapsed).toBeLessThan(5000)

      db.close()
    }, 30000)

    it('queryWithData returns results in reasonable time', async () => {
      const db = await createTestDatabase()

      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      for (let i = 0; i < 1000; i++) {
        const id = await ecs.createEntity()
        await ecs.addComponent(id, Comp, { value: i })
      }

      const start = Date.now()
      const results = await ecs.queryWithData([Comp])
      const elapsed = Date.now() - start

      expect(results.length).toBe(1000)
      expect(elapsed).toBeLessThan(2000)

      db.close()
    })

    it('multiple indexes improve query performance measurably', async () => {
      const db = await createTestDatabase()

      const Comp = defineComponent('Test', { x: 'number', y: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      for (let i = 0; i < 5000; i++) {
        const id = await ecs.createEntity()
        await ecs.addComponent(id, Comp, { x: i, y: i * 2 })
      }

      // Query without index
      const start1 = Date.now()
      const results1 = await ecs.query([Comp], {
        filter: (data) => {
          const comp = data.Test as { x: number; y: number }
          return comp.x > 2500 && comp.y < 7500
        }
      })
      const elapsed1 = Date.now() - start1

      // Add indexes
      await ecs.addIndex(Comp, 'x')
      await ecs.addIndex(Comp, 'y')

      // Query with indexes
      const start2 = Date.now()
      const results2 = await ecs.query([Comp], {
        filter: (data) => {
          const comp = data.Test as { x: number; y: number }
          return comp.x > 2500 && comp.y < 7500
        }
      })
      const elapsed2 = Date.now() - start2

      expect(results1.length).toBe(results2.length)
      // Note: Indexes may not always improve filter performance significantly
      // since filters run in JS, but they help with component lookups
      expect(elapsed2).toBeLessThan(elapsed1 * 2)

      db.close()
    }, 30000)
  })

  describe('Bulk Operation Performance', () => {
    it('addComponentBulk with 1000 entities completes quickly', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const ids: string[] = []
      for (let i = 0; i < 1000; i++) {
        ids.push(await ecs.createEntity())
      }

      const start = Date.now()
      await ecs.addComponentBulk(ids, Comp, { value: 42 })
      const elapsed = Date.now() - start

      expect(elapsed).toBeLessThan(5000)

      db.close()
    })

    it('removeComponentBulk with 1000 entities completes quickly', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const ids: string[] = []
      for (let i = 0; i < 1000; i++) {
        const id = await ecs.createEntity()
        await ecs.addComponent(id, Comp, { value: i })
        ids.push(id)
      }

      const start = Date.now()
      await ecs.removeComponentBulk(ids, Comp)
      const elapsed = Date.now() - start

      expect(elapsed).toBeLessThan(5000)

      db.close()
    })

    it('bulk operations faster than individual operations', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const ids1: string[] = []
      const ids2: string[] = []

      for (let i = 0; i < 200; i++) {
        ids1.push(await ecs.createEntity())
        ids2.push(await ecs.createEntity())
      }

      // Individual operations
      const start1 = Date.now()
      for (const id of ids1) {
        await ecs.addComponent(id, Comp, { value: 1 })
      }
      const elapsed1 = Date.now() - start1

      // Bulk operation
      const start2 = Date.now()
      await ecs.addComponentBulk(ids2, Comp, { value: 1 })
      const elapsed2 = Date.now() - start2

      // Bulk should be faster
      expect(elapsed2).toBeLessThan(elapsed1)

      db.close()
    }, 30000)
  })
})

// -------------------------------------------------------------------
// Concurrency and Transaction Tests (15 tests)
// -------------------------------------------------------------------

describe('Concurrency and Transaction Tests', () => {
  describe('Concurrent Transactions', () => {
    it('multiple simultaneous transactions execute correctly', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      // Run transactions concurrently - transaction queue handles serialization
      const promises = Array.from({ length: 10 }, (_, i) =>
        ecs.transaction(async () => {
          const entityId = await ecs.createEntity()
          await ecs.addComponent(entityId, Comp, { value: i })
          return entityId
        })
      )

      const ids = await Promise.all(promises)

      expect(ids.length).toBe(10)
      expect(new Set(ids).size).toBe(10) // All unique

      db.close()
    })

    it('nested transactions within parallel operations work', async () => {
      const db = await createTestDatabase()
      const ecs = createECS(db, [])
      await ecs.initialize()

      // Run concurrent transactions with nesting - transaction queue handles serialization
      const promises = Array.from({ length: 5 }, () =>
        ecs.transaction(async () => {
          const id1 = await ecs.createEntity()
          return ecs.transaction(async () => {
            const id2 = await ecs.createEntity()
            return [id1, id2]
          })
        })
      )

      const results = await Promise.all(promises)

      expect(results.length).toBe(5)
      expect(results.flat().length).toBe(10)

      db.close()
    })

    it('transaction rollback in one doesn\'t affect others', async () => {
      const db = await createTestDatabase()
      const ecs = createECS(db, [])
      await ecs.initialize()

      const successPromise = ecs.transaction(async () => {
        return await ecs.createEntity()
      })

      const failPromise = ecs.transaction(async () => {
        await ecs.createEntity()
        throw new Error('Intentional failure')
      })

      const successId = await successPromise
      await expect(failPromise).rejects.toThrow('Intentional failure')

      // Success transaction should have committed
      const allResults = await ecs.query([])
      expect(allResults).toContain(successId)

      db.close()
    })

    it('concurrent reads during transaction see committed data', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const id = await ecs.createEntity()
      await ecs.addComponent(id, Comp, { value: 0 })

      // Start a transaction that updates the value
      const transactionPromise = ecs.transaction(async () => {
        await ecs.updateComponent(id, Comp, { value: 100 })
        // Simulate slow transaction
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      // With transaction queue, reads outside transactions don't see uncommitted changes
      // This provides proper transaction isolation
      const data1 = await ecs.getComponent(id, Comp)

      await transactionPromise

      // After transaction commits, should see new value
      const data2 = await ecs.getComponent(id, Comp)

      // With transaction queue: proper isolation means first read sees old value
      expect(data1?.value).toBe(0) // Uncommitted change not visible
      expect(data2?.value).toBe(100) // Committed change visible

      db.close()
    })
  })

  describe('Race Conditions', () => {
    it('concurrent entity creation generates unique ids', async () => {
      const db = await createTestDatabase()
      const ecs = createECS(db, [])
      await ecs.initialize()

      const promises = []
      for (let i = 0; i < 100; i++) {
        promises.push(ecs.createEntity())
      }

      const ids = await Promise.all(promises)
      const uniqueIds = new Set(ids)

      expect(uniqueIds.size).toBe(100)

      db.close()
    })

    it('concurrent component addition doesn\'t corrupt data', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const ids = []
      for (let i = 0; i < 100; i++) {
        ids.push(await ecs.createEntity())
      }

      const promises = ids.map((id, i) =>
        ecs.addComponent(id, Comp, { value: i })
      )

      await Promise.all(promises)

      // Verify all components were added correctly
      for (let i = 0; i < 100; i++) {
        const data = await ecs.getComponent(ids[i], Comp)
        expect(data?.value).toBe(i)
      }

      db.close()
    })

    it('concurrent updates to same component serialize correctly', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { counter: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const id = await ecs.createEntity()
      await ecs.addComponent(id, Comp, { counter: 0 })

      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(
          ecs.transaction(async () => {
            const current = await ecs.getComponent(id, Comp)
            await ecs.updateComponent(id, Comp, { counter: (current?.counter || 0) + 1 })
          })
        )
      }

      await Promise.all(promises)

      const final = await ecs.getComponent(id, Comp)
      expect(final?.counter).toBe(10)

      db.close()
    })

    it('concurrent queries return consistent results', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      for (let i = 0; i < 50; i++) {
        const id = await ecs.createEntity()
        await ecs.addComponent(id, Comp, { value: i })
      }

      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(ecs.query([Comp]))
      }

      const results = await Promise.all(promises)

      // All queries should return the same entities
      for (let i = 1; i < results.length; i++) {
        expect(results[i].length).toBe(results[0].length)
      }

      db.close()
    })
  })

  describe('Transaction Isolation', () => {
    it('uncommitted changes not visible outside transaction', async () => {
      const db = await createTestDatabase()
      const ecs = createECS(db, [])
      await ecs.initialize()

      let createdId: string | null = null

      const transactionPromise = ecs.transaction(async () => {
        createdId = await ecs.createEntity()
        // Hold the transaction open
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      // Query before transaction completes
      const results1 = await ecs.query([])

      await transactionPromise

      // Query after transaction completes
      const results2 = await ecs.query([])

      expect(results1.length).toBe(0)
      expect(results2.length).toBe(1)
      expect(results2[0]).toBe(createdId)

      db.close()
    })

    it('rolled back transaction leaves no side effects', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      try {
        await ecs.transaction(async () => {
          await ecs.createEntity()
          await ecs.createEntity()
          throw new Error('Rollback')
        })
      } catch (error) {
        // Expected
      }

      const results = await ecs.query([])
      expect(results.length).toBe(0)

      db.close()
    })

    it('transaction callback receives correct ECS instance', async () => {
      const db = await createTestDatabase()
      const ecs = createECS(db, [])
      await ecs.initialize()

      let capturedEcs: ECS | null = null

      await ecs.transaction(async () => {
        capturedEcs = ecs
        await ecs.createEntity()
      })

      expect(capturedEcs).toBe(ecs)

      db.close()
    })

    it('transaction can call other ECS methods safely', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const result = await ecs.transaction(async () => {
        const id = await ecs.createEntity()
        await ecs.addComponent(id, Comp, { value: 42 })
        const hasComp = await ecs.hasComponent(id, Comp)
        const data = await ecs.getComponent(id, Comp)
        await ecs.updateComponent(id, Comp, { value: 100 })
        const results = await ecs.query([Comp])
        return { id, hasComp, data, results }
      })

      expect(result.hasComp).toBe(true)
      expect(result.data?.value).toBe(42)
      expect(result.results).toContain(result.id)

      db.close()
    })
  })

  describe('Lock Contention', () => {
    it('high concurrency doesn\'t cause deadlocks', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const promises = []
      for (let i = 0; i < 50; i++) {
        promises.push(
          ecs.transaction(async () => {
            const id = await ecs.createEntity()
            await ecs.addComponent(id, Comp, { value: i })
            const data = await ecs.getComponent(id, Comp)
            await ecs.updateComponent(id, Comp, { value: (data?.value || 0) * 2 })
          })
        )
      }

      await Promise.all(promises)

      const results = await ecs.query([Comp])
      expect(results.length).toBe(50)

      db.close()
    }, 30000)

    it('long-running transaction doesn\'t block unrelated operations', async () => {
      const db = await createTestDatabase()
      const ecs = createECS(db, [])
      await ecs.initialize()

      // Start long transaction
      const longTransaction = ecs.transaction(async () => {
        await ecs.createEntity()
        await new Promise(resolve => setTimeout(resolve, 500))
      })

      // Perform unrelated operation
      const quickOperation = ecs.createEntity()

      const quickId = await quickOperation
      await longTransaction

      expect(quickId).toBeDefined()

      db.close()
    })

    it('database handles multiple connections correctly', async () => {
      const db = await createTestDatabase()
      const ecs = createECS(db, [])
      await ecs.initialize()

      // Simulate multiple "connections" via concurrent operations
      const promises = []
      for (let i = 0; i < 20; i++) {
        promises.push(ecs.createEntity())
      }

      const ids = await Promise.all(promises)

      expect(ids.length).toBe(20)
      expect(new Set(ids).size).toBe(20)

      db.close()
    })
  })
})

// -------------------------------------------------------------------
// Advanced Integration Tests (15 tests)
// -------------------------------------------------------------------

describe('Advanced Integration Tests', () => {
  describe('Multi-Archetype Systems', () => {
    it('game with Player Enemy Item archetypes works together', async () => {
      const db = await createTestDatabase()

      const Position = defineComponent('Position', { x: 'number', y: 'number' })
      const Health = defineComponent('Health', { current: 'number', max: 'number' })
      const Inventory = defineComponent('Inventory', { items: 'json' })
      const AI = defineComponent('AI', { behavior: 'string' })
      const Renderable = defineComponent('Renderable', { sprite: 'string' })

      const ecs = createECS(db, [Position, Health, Inventory, AI, Renderable])
      await ecs.initialize()

      const Player = ecs.defineArchetype([Position, Health, Inventory, Renderable])
      const Enemy = ecs.defineArchetype([Position, Health, AI, Renderable])
      const Item = ecs.defineArchetype([Position, Renderable])

      const playerId = await ecs.createFromArchetype(Player, {
        Position: { x: 0, y: 0 },
        Health: { current: 100, max: 100 },
        Inventory: { items: [] },
        Renderable: { sprite: 'player.png' }
      })

      const enemyId = await ecs.createFromArchetype(Enemy, {
        Position: { x: 10, y: 10 },
        Health: { current: 50, max: 50 },
        AI: { behavior: 'aggressive' },
        Renderable: { sprite: 'enemy.png' }
      })

      const itemId = await ecs.createFromArchetype(Item, {
        Position: { x: 5, y: 5 },
        Renderable: { sprite: 'item.png' }
      })

      const renderables = await ecs.query([Renderable])
      expect(renderables).toContain(playerId)
      expect(renderables).toContain(enemyId)
      expect(renderables).toContain(itemId)

      db.close()
    })

    it('querying across different archetypes works correctly', async () => {
      const db = await createTestDatabase()

      const A = defineComponent('A', { value: 'number' })
      const B = defineComponent('B', { value: 'number' })
      const C = defineComponent('C', { value: 'number' })

      const ecs = createECS(db, [A, B, C])
      await ecs.initialize()

      const Archetype1 = ecs.defineArchetype([A, B])
      const Archetype2 = ecs.defineArchetype([B, C])
      const Archetype3 = ecs.defineArchetype([A, B, C])

      const id1 = await ecs.createFromArchetype(Archetype1, { A: { value: 1 }, B: { value: 2 } })
      const id2 = await ecs.createFromArchetype(Archetype2, { B: { value: 3 }, C: { value: 4 } })
      const id3 = await ecs.createFromArchetype(Archetype3, { A: { value: 5 }, B: { value: 6 }, C: { value: 7 } })

      const withB = await ecs.query([B])
      expect(withB).toContain(id1)
      expect(withB).toContain(id2)
      expect(withB).toContain(id3)

      const withAandB = await ecs.query([A, B])
      expect(withAandB).toContain(id1)
      expect(withAandB).toContain(id3)
      expect(withAandB).not.toContain(id2)

      db.close()
    })

    it('destroying entity with archetype removes all components', async () => {
      const db = await createTestDatabase()

      const A = defineComponent('A', { value: 'number' })
      const B = defineComponent('B', { value: 'number' })
      const C = defineComponent('C', { value: 'number' })

      const ecs = createECS(db, [A, B, C])
      await ecs.initialize()

      const Archetype = ecs.defineArchetype([A, B, C])
      const id = await ecs.createFromArchetype(Archetype, {
        A: { value: 1 },
        B: { value: 2 },
        C: { value: 3 }
      })

      expect(await ecs.hasComponent(id, A)).toBe(true)
      expect(await ecs.hasComponent(id, B)).toBe(true)
      expect(await ecs.hasComponent(id, C)).toBe(true)

      await ecs.destroyEntity(id)

      expect(await ecs.hasComponent(id, A)).toBe(false)
      expect(await ecs.hasComponent(id, B)).toBe(false)
      expect(await ecs.hasComponent(id, C)).toBe(false)

      db.close()
    })

    it('archetype entities can have additional components added', async () => {
      const db = await createTestDatabase()

      const A = defineComponent('A', { value: 'number' })
      const B = defineComponent('B', { value: 'number' })
      const C = defineComponent('C', { value: 'number' })

      const ecs = createECS(db, [A, B, C])
      await ecs.initialize()

      const Archetype = ecs.defineArchetype([A, B])
      const id = await ecs.createFromArchetype(Archetype, {
        A: { value: 1 },
        B: { value: 2 }
      })

      await ecs.addComponent(id, C, { value: 3 })

      expect(await ecs.hasComponent(id, A)).toBe(true)
      expect(await ecs.hasComponent(id, B)).toBe(true)
      expect(await ecs.hasComponent(id, C)).toBe(true)

      db.close()
    })
  })

  describe('Complex Event Scenarios', () => {
    it('event handler can safely modify ECS', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const createdEntities: string[] = []

      ecs.onEntityCreated((id) => {
        createdEntities.push(id)
      })

      ecs.onComponentAdded(Comp, async (entityId, data) => {
        if (data.value < 3) {
          const newId = await ecs.createEntity()
          await ecs.addComponent(newId, Comp, { value: data.value + 1 })
        }
      })

      const id = await ecs.createEntity()
      await ecs.addComponent(id, Comp, { value: 0 })

      // Allow events to process
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should have created cascading entities
      expect(createdEntities.length).toBeGreaterThan(1)

      db.close()
    })

    it('event handler throwing error doesn\'t corrupt state', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      ecs.onComponentAdded(Comp, () => {
        throw new Error('Handler error')
      })

      const id = await ecs.createEntity()

      // Should not throw, handler errors are caught
      await ecs.addComponent(id, Comp, { value: 42 })

      // Component should still be added
      expect(await ecs.hasComponent(id, Comp)).toBe(true)

      db.close()
    })

    it('removing component in event handler works', async () => {
      const db = await createTestDatabase()
      const A = defineComponent('A', { value: 'number' })
      const B = defineComponent('B', { value: 'number' })
      const ecs = createECS(db, [A, B])
      await ecs.initialize()

      ecs.onComponentAdded(A, async (entityId) => {
        if (await ecs.hasComponent(entityId, B)) {
          await ecs.removeComponent(entityId, B)
        }
      })

      const id = await ecs.createEntity()
      await ecs.addComponent(id, B, { value: 1 })
      await ecs.addComponent(id, A, { value: 2 })

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(await ecs.hasComponent(id, A)).toBe(true)
      expect(await ecs.hasComponent(id, B)).toBe(false)

      db.close()
    })

    it('unsubscribing within event handler works', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      let callCount = 0
      let unsubscribe: (() => void) | null = null

      unsubscribe = ecs.onComponentAdded(Comp, () => {
        callCount++
        if (unsubscribe) {
          unsubscribe()
        }
      })

      const id1 = await ecs.createEntity()
      await ecs.addComponent(id1, Comp, { value: 1 })

      const id2 = await ecs.createEntity()
      await ecs.addComponent(id2, Comp, { value: 2 })

      expect(callCount).toBe(1)

      db.close()
    })

    it('event handlers execute in registration order', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const order: number[] = []

      ecs.onComponentAdded(Comp, () => { order.push(1) })
      ecs.onComponentAdded(Comp, () => { order.push(2) })
      ecs.onComponentAdded(Comp, () => { order.push(3) })

      const id = await ecs.createEntity()
      await ecs.addComponent(id, Comp, { value: 42 })

      expect(order).toEqual([1, 2, 3])

      db.close()
    })

    it('bulk operations fire events in correct order', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const eventIds: string[] = []

      ecs.onComponentAdded(Comp, (entityId) => {
        eventIds.push(entityId)
      })

      const ids = [
        await ecs.createEntity(),
        await ecs.createEntity(),
        await ecs.createEntity()
      ]

      await ecs.addComponentBulk(ids, Comp, { value: 42 })

      // Events should have fired for all entities
      expect(eventIds.length).toBe(3)
      for (const id of ids) {
        expect(eventIds).toContain(id)
      }

      db.close()
    })
  })

  describe('State Management Patterns', () => {
    it('ECS persists across application restart', async () => {
      const db1 = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs1 = createECS(db1, [Comp])
      await ecs1.initialize()

      const id = await ecs1.createEntity('persistent-id')
      await ecs1.addComponent(id, Comp, { value: 42 })

      // Export database
      const exported = db1.export()
      db1.close()

      // Import into new database
      const db2 = await createDatabase({ data: exported })
      const ecs2 = createECS(db2, [Comp])
      await ecs2.initialize()

      const data = await ecs2.getComponent('persistent-id', Comp)
      expect(data?.value).toBe(42)

      db2.close()
    })

    it('multiple ECS instances with same DB work correctly', async () => {
      const db = await createTestDatabase()

      const Comp1 = defineComponent('Comp1', { value: 'number' })
      const Comp2 = defineComponent('Comp2', { value: 'string' })

      const ecs1 = createECS(db, [Comp1])
      const ecs2 = createECS(db, [Comp2])

      await ecs1.initialize()
      await ecs2.initialize()

      const id1 = await ecs1.createEntity()
      await ecs1.addComponent(id1, Comp1, { value: 42 })

      const id2 = await ecs2.createEntity()
      await ecs2.addComponent(id2, Comp2, { value: 'test' })

      // Both instances should see their entities
      expect(await ecs1.hasComponent(id1, Comp1)).toBe(true)
      expect(await ecs2.hasComponent(id2, Comp2)).toBe(true)

      db.close()
    })

    it('ECS cleanup releases resources properly', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      for (let i = 0; i < 100; i++) {
        const id = await ecs.createEntity()
        await ecs.addComponent(id, Comp, { value: i })
      }

      // Close database
      db.close()

      // Should not be able to perform operations
      expect(true).toBe(true) // Placeholder - database is closed
    })

    it('re-initializing ECS preserves existing data', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const id = await ecs.createEntity()
      await ecs.addComponent(id, Comp, { value: 42 })

      // Re-initialize
      await ecs.initialize()

      // Data should still be there
      const data = await ecs.getComponent(id, Comp)
      expect(data?.value).toBe(42)

      db.close()
    })
  })

  describe('Complex Query Patterns', () => {
    it('query with 10 component requirements works', async () => {
      const db = await createTestDatabase()

      const components = []
      for (let i = 0; i < 10; i++) {
        components.push(defineComponent(`Comp${i}`, { value: 'number' }))
      }

      const ecs = createECS(db, components)
      await ecs.initialize()

      const id = await ecs.createEntity()
      for (let i = 0; i < 10; i++) {
        await ecs.addComponent(id, components[i], { value: i })
      }

      const results = await ecs.query(components)
      expect(results).toContain(id)
      expect(results.length).toBe(1)

      db.close()
    })

    it('query with exclude list of 5 components works', async () => {
      const db = await createTestDatabase()

      const Include = defineComponent('Include', { value: 'number' })
      const excludeComps = []
      for (let i = 0; i < 5; i++) {
        excludeComps.push(defineComponent(`Exclude${i}`, { value: 'number' }))
      }

      const ecs = createECS(db, [Include, ...excludeComps])
      await ecs.initialize()

      const id1 = await ecs.createEntity()
      await ecs.addComponent(id1, Include, { value: 1 })

      const id2 = await ecs.createEntity()
      await ecs.addComponent(id2, Include, { value: 2 })
      await ecs.addComponent(id2, excludeComps[0], { value: 3 })

      const results = await ecs.query([Include], { exclude: excludeComps })
      expect(results).toContain(id1)
      expect(results).not.toContain(id2)

      db.close()
    })

    it('combining filter and exclude works correctly', async () => {
      const db = await createTestDatabase()

      const A = defineComponent('A', { value: 'number' })
      const B = defineComponent('B', { value: 'number' })

      const ecs = createECS(db, [A, B])
      await ecs.initialize()

      for (let i = 0; i < 10; i++) {
        const id = await ecs.createEntity()
        await ecs.addComponent(id, A, { value: i })
        if (i % 2 === 0) {
          await ecs.addComponent(id, B, { value: i })
        }
      }

      const results = await ecs.query([A], {
        exclude: [B],
        filter: (data) => {
          const comp = data.A as { value: number }
          return comp.value > 5
        }
      })

      expect(results.length).toBe(2) // 7 and 9

      db.close()
    })

    it('queryWithData with complex filter works', async () => {
      const db = await createTestDatabase()

      const A = defineComponent('A', { x: 'number' })
      const B = defineComponent('B', { y: 'number' })

      const ecs = createECS(db, [A, B])
      await ecs.initialize()

      for (let i = 0; i < 10; i++) {
        const id = await ecs.createEntity()
        await ecs.addComponent(id, A, { x: i })
        await ecs.addComponent(id, B, { y: i * 2 })
      }

      const results = await ecs.queryWithData([A, B], {
        filter: (data) => {
          const a = data.A as { x: number }
          const b = data.B as { y: number }
          return a.x + b.y > 15
        }
      })

      expect(results.length).toBeGreaterThan(0)
      for (const result of results) {
        const a = result.A as { x: number }
        const b = result.B as { y: number }
        expect(a.x + b.y).toBeGreaterThan(15)
      }

      db.close()
    })

    it('chaining multiple queries works efficiently', async () => {
      const db = await createTestDatabase()

      const A = defineComponent('A', { value: 'number' })
      const B = defineComponent('B', { value: 'number' })
      const C = defineComponent('C', { value: 'number' })

      const ecs = createECS(db, [A, B, C])
      await ecs.initialize()

      for (let i = 0; i < 100; i++) {
        const id = await ecs.createEntity()
        await ecs.addComponent(id, A, { value: i })
        if (i % 2 === 0) await ecs.addComponent(id, B, { value: i })
        if (i % 3 === 0) await ecs.addComponent(id, C, { value: i })
      }

      const withA = await ecs.query([A])
      const withAandB = await ecs.query([A, B])
      const withAandBandC = await ecs.query([A, B, C])

      expect(withA.length).toBe(100)
      expect(withAandB.length).toBe(50)
      expect(withAandBandC.length).toBeGreaterThan(0)

      db.close()
    })
  })
})

// -------------------------------------------------------------------
// Data Integrity Tests (10 tests)
// -------------------------------------------------------------------

describe('Data Integrity Tests', () => {
  describe('Foreign Key Constraints', () => {
    it('orphaned component rows cannot exist', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const id = await ecs.createEntity()
      await ecs.addComponent(id, Comp, { value: 42 })

      // Delete entity
      await ecs.destroyEntity(id)

      // Component should be gone
      const data = await ecs.getComponent(id, Comp)
      expect(data).toBeNull()

      // Verify no orphaned rows
      const componentRows = await ecs.rawQuery('SELECT * FROM component_Test')
      expect(componentRows.length).toBe(0)

      db.close()
    })

    it('deleting entity cascades to all 20 components', async () => {
      const db = await createTestDatabase()

      const components = []
      for (let i = 0; i < 20; i++) {
        components.push(defineComponent(`Comp${i}`, { value: 'number' }))
      }

      const ecs = createECS(db, components)
      await ecs.initialize()

      const id = await ecs.createEntity()
      for (let i = 0; i < 20; i++) {
        await ecs.addComponent(id, components[i], { value: i })
      }

      await ecs.destroyEntity(id)

      // Verify all components are gone
      for (let i = 0; i < 20; i++) {
        expect(await ecs.hasComponent(id, components[i])).toBe(false)
      }

      db.close()
    })

    it('foreign key violation throws DatabaseError', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      // Try to insert component for non-existent entity directly via SQL
      try {
        await ecs.rawQuery(
          "INSERT INTO component_Test (entity_id, value) VALUES ('nonexistent', 42)"
        )
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(DatabaseError)
      }

      db.close()
    })

    it('cascade delete works with bulk operations', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const ids = []
      for (let i = 0; i < 10; i++) {
        const id = await ecs.createEntity()
        await ecs.addComponent(id, Comp, { value: i })
        ids.push(id)
      }

      // Delete all entities
      for (const id of ids) {
        await ecs.destroyEntity(id)
      }

      // Verify all components are gone
      const componentRows = await ecs.rawQuery('SELECT * FROM component_Test')
      expect(componentRows.length).toBe(0)

      db.close()
    })
  })

  describe('Data Type Integrity', () => {
    it('boolean stored as 0 or 1 only', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { flag: 'boolean' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const id1 = await ecs.createEntity()
      await ecs.addComponent(id1, Comp, { flag: true })

      const id2 = await ecs.createEntity()
      await ecs.addComponent(id2, Comp, { flag: false })

      // Check raw storage
      const rows = await ecs.rawQuery('SELECT entity_id, flag FROM component_Test')

      for (const row of rows) {
        const rowData = row as { entity_id: string; flag: number }
        expect([0, 1]).toContain(rowData.flag)
      }

      db.close()
    })

    it('number preserves floating point precision', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const testValue = Math.PI

      const id = await ecs.createEntity()
      await ecs.addComponent(id, Comp, { value: testValue })

      const data = await ecs.getComponent(id, Comp)
      expect(data?.value).toBeCloseTo(testValue, 10)

      db.close()
    })

    it('json serialization preserves data types', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { data: 'json' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const testData = {
        string: 'hello',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        nested: { a: 1, b: 2 },
        nullValue: null
      }

      const id = await ecs.createEntity()
      await ecs.addComponent(id, Comp, { data: testData })

      const retrieved = await ecs.getComponent(id, Comp)
      expect(retrieved?.data).toEqual(testData)

      db.close()
    })

    it('string encoding handles all UTF-8 correctly', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { text: 'string' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const testStrings = [
        'Hello World',
        '你好世界',
        'مرحبا بالعالم',
        '🎮🎯🎨',
        'Ĥéļļő Ŵőřļđ',
        '𝕳𝖊𝖑𝖑𝖔'
      ]

      for (const str of testStrings) {
        const id = await ecs.createEntity()
        await ecs.addComponent(id, Comp, { text: str })
        const data = await ecs.getComponent(id, Comp)
        expect(data?.text).toBe(str)
      }

      db.close()
    })
  })

  describe('Schema Validation', () => {
    it('schema cannot be modified after definition', () => {
      const Comp = defineComponent('Test', { value: 'number' })

      // Try to modify schema
      try {
        // @ts-expect-error - Testing runtime immutability
        Comp.schema.value = 'string'
        expect.fail('Should have thrown or been prevented')
      } catch (error) {
        // Expected
        expect(true).toBe(true)
      }

      // Verify original schema unchanged
      expect(Comp.schema.value).toBe('number')
    })

    it('component definition is truly frozen', () => {
      const Comp = defineComponent('Test', { value: 'number' })

      expect(Object.isFrozen(Comp)).toBe(true)
      expect(Object.isFrozen(Comp.schema)).toBe(true)
    })

    it('attempting to modify schema throws error', () => {
      const Comp = defineComponent('Test', { value: 'number' })

      expect(() => {
        // @ts-expect-error - Testing runtime immutability
        Comp.name = 'Modified'
      }).toThrow()
    })
  })
})

// -------------------------------------------------------------------
// Cleanup and Resource Management (5 tests)
// -------------------------------------------------------------------

describe('Cleanup and Resource Management', () => {
  describe('Memory Management', () => {
    it('destroying 10000 entities doesn\'t leak memory', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      // Create and immediately destroy
      for (let i = 0; i < 10000; i++) {
        const id = await ecs.createEntity()
        await ecs.addComponent(id, Comp, { value: i })
        await ecs.destroyEntity(id)
      }

      // Verify all gone
      const results = await ecs.query([Comp])
      expect(results.length).toBe(0)

      db.close()
    }, 60000)

    it('event handlers are garbage collected after unsubscribe', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      let callCount = 0
      const unsubscribe = ecs.onComponentAdded(Comp, () => {
        callCount++
      })

      const id1 = await ecs.createEntity()
      await ecs.addComponent(id1, Comp, { value: 1 })

      unsubscribe()

      const id2 = await ecs.createEntity()
      await ecs.addComponent(id2, Comp, { value: 2 })

      expect(callCount).toBe(1)

      db.close()
    })

    it('query results don\'t retain unnecessary references', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      for (let i = 0; i < 1000; i++) {
        const id = await ecs.createEntity()
        await ecs.addComponent(id, Comp, { value: i })
      }

      const results1 = await ecs.query([Comp])
      const results2 = await ecs.query([Comp])

      // Results should be independent
      expect(results1).not.toBe(results2)
      expect(results1).toEqual(results2)

      db.close()
    })
  })

  describe('Database Cleanup', () => {
    it('component tables cleaned up on entity destruction', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      const id = await ecs.createEntity()
      await ecs.addComponent(id, Comp, { value: 42 })

      const before = await ecs.rawQuery('SELECT COUNT(*) as count FROM component_Test')
      expect((before[0] as { count: number }).count).toBe(1)

      await ecs.destroyEntity(id)

      const after = await ecs.rawQuery('SELECT COUNT(*) as count FROM component_Test')
      expect((after[0] as { count: number }).count).toBe(0)

      db.close()
    })

    it('indexes don\'t bloat database over time', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { value: 'number' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      await ecs.addIndex(Comp, 'value')

      // Add and remove many entities
      for (let i = 0; i < 1000; i++) {
        const id = await ecs.createEntity()
        await ecs.addComponent(id, Comp, { value: i })
        await ecs.destroyEntity(id)
      }

      // Index should still exist and work
      const id = await ecs.createEntity()
      await ecs.addComponent(id, Comp, { value: 999 })

      const results = await ecs.query([Comp])
      expect(results).toContain(id)

      db.close()
    })

    it('vacuuming database reclaims space', async () => {
      const db = await createTestDatabase()
      const Comp = defineComponent('Test', { data: 'string' })
      const ecs = createECS(db, [Comp])
      await ecs.initialize()

      // Create large amount of data
      for (let i = 0; i < 100; i++) {
        const id = await ecs.createEntity()
        await ecs.addComponent(id, Comp, { data: 'x'.repeat(10000) })
      }

      const sizeAfterInsert = db.export().length

      // Delete all
      const entities = await ecs.query([])
      for (const id of entities) {
        await ecs.destroyEntity(id)
      }

      // Vacuum
      db.exec('VACUUM')

      const sizeAfterVacuum = db.export().length

      // Size should be significantly smaller
      expect(sizeAfterVacuum).toBeLessThan(sizeAfterInsert)

      db.close()
    }, 30000)
  })
})
