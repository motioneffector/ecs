import { describe, it, expect } from 'vitest'
import { defineComponent } from './component'
import { ValidationError } from './errors'

describe('defineComponent()', () => {
  describe('Basic Functionality', () => {
    it('creates component definition with name', () => {
      const Position = defineComponent('position', { x: 'number', y: 'number' })
      expect(Position.name).toBe('position')
    })

    it('creates component definition with schema', () => {
      const Position = defineComponent('position', { x: 'number', y: 'number' })
      expect(Position.schema).toEqual({ x: 'number', y: 'number' })
    })

    it('accepts string field type', () => {
      const Description = defineComponent('description', { text: 'string' })
      expect(Description.schema.text).toBe('string')
    })

    it('accepts number field type', () => {
      const Health = defineComponent('health', { current: 'number' })
      expect(Health.schema.current).toBe('number')
    })

    it('accepts boolean field type', () => {
      const Active = defineComponent('active', { enabled: 'boolean' })
      expect(Active.schema.enabled).toBe('boolean')
    })

    it('accepts json field type', () => {
      const Inventory = defineComponent('inventory', { items: 'json' })
      expect(Inventory.schema.items).toBe('json')
    })

    it('returns frozen component definition', () => {
      const Position = defineComponent('position', { x: 'number' })
      expect(Object.isFrozen(Position)).toBe(true)
    })
  })

  describe('Validation', () => {
    it('throws ValidationError for empty name', () => {
      expect(() => defineComponent('', { x: 'number' })).toThrow(ValidationError)
    })

    it('throws ValidationError for empty schema', () => {
      expect(() => defineComponent('test', {})).toThrow(ValidationError)
    })

    it('throws ValidationError for invalid field type', () => {
      // @ts-expect-error - Testing runtime validation
      expect(() => defineComponent('test', { field: 'invalid' })).toThrow(ValidationError)
    })

    it('throws ValidationError for reserved field name "entity_id"', () => {
      expect(() => defineComponent('test', { entity_id: 'string' })).toThrow(ValidationError)
    })
  })
})
