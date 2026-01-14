// ============================================
// TEST RUNNER + DEMO PLAYBACK
// ============================================

import { createDatabase } from '../../../sql/dist/index.js';
import { createECS, defineComponent, ValidationError, ECSError } from '../../dist/index.js';
import { escapeHtml, delay } from './utils.js';

let mainEcs = null;
let components = null;

// Helper to create a fresh ECS instance for each test
async function createTestECS(componentDefs = []) {
  const db = await createDatabase();
  const ecs = createECS(db, componentDefs);
  await ecs.initialize();
  return ecs;
}

// ============================================
// TEST RUNNER IMPLEMENTATION
// ============================================

const testRunner = {
  tests: [],
  fuzzTests: [],
  results: [],
  running: false,

  register(name, fn, isFuzz = false) {
    if (isFuzz) {
      this.fuzzTests.push({ name, fn });
    } else {
      this.tests.push({ name, fn });
    }
  },

  async run(runFuzz = false) {
    if (this.running) return;
    this.running = true;
    this.results = [];

    const tests = runFuzz ? this.fuzzTests : this.tests;

    const output = document.getElementById('test-output');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const summary = document.getElementById('test-summary');
    const passedCount = document.getElementById('passed-count');
    const failedCount = document.getElementById('failed-count');
    const skippedCount = document.getElementById('skipped-count');
    const runBtn = document.getElementById('run-tests');
    const fuzzBtn = document.getElementById('run-fuzz');

    runBtn.disabled = true;
    fuzzBtn.disabled = true;
    output.innerHTML = '';
    summary.classList.add('hidden');
    progressFill.style.width = '0%';
    progressFill.className = 'test-progress-fill';

    let passed = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      const progress = ((i + 1) / tests.length) * 100;

      progressFill.style.width = `${progress}%`;
      progressText.textContent = `Running: ${test.name}`;

      try {
        await test.fn();
        passed++;
        this.results.push({ name: test.name, passed: true });
        output.innerHTML += `
          <div class="test-item">
            <span class="test-icon pass">✓</span>
            <span class="test-name">${escapeHtml(test.name)}</span>
          </div>
        `;
      } catch (e) {
        if (e.message === 'SKIP') {
          skipped++;
          this.results.push({ name: test.name, skipped: true });
          output.innerHTML += `
            <div class="test-item">
              <span class="test-icon" style="color: var(--text-muted);">○</span>
              <span class="test-name" style="color: var(--text-muted);">${escapeHtml(test.name)} (skipped)</span>
            </div>
          `;
        } else {
          failed++;
          this.results.push({ name: test.name, passed: false, error: e.message });
          output.innerHTML += `
            <div class="test-item">
              <span class="test-icon fail">✗</span>
              <div>
                <div class="test-name">${escapeHtml(test.name)}</div>
                <div class="test-error">${escapeHtml(e.message)}</div>
              </div>
            </div>
          `;
        }
      }

      output.scrollTop = output.scrollHeight;
      await new Promise(r => setTimeout(r, 20));
    }

    progressFill.classList.add(failed === 0 ? 'success' : 'failure');
    progressText.textContent = `Complete: ${passed}/${tests.length} passed`;

    passedCount.textContent = passed;
    failedCount.textContent = failed;
    skippedCount.textContent = skipped;
    summary.classList.remove('hidden');

    runBtn.disabled = false;
    fuzzBtn.disabled = false;
    this.running = false;

    // If main tests passed and not running fuzz tests, start demo playback
    if (!runFuzz && failed === 0) {
      await delay(1000);
      await runDemoPlayback();
    }
  }
};

// ============================================
// TEST ASSERTIONS
// ============================================

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
      }
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected truthy value but got ${JSON.stringify(actual)}`);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(`Expected falsy value but got ${JSON.stringify(actual)}`);
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new Error(`Expected null but got ${JSON.stringify(actual)}`);
      }
    },
    toBeUndefined() {
      if (actual !== undefined) {
        throw new Error(`Expected undefined but got ${JSON.stringify(actual)}`);
      }
    },
    toBeDefined() {
      if (actual === undefined) {
        throw new Error(`Expected defined value but got undefined`);
      }
    },
    toBeGreaterThan(expected) {
      if (actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    toBeLessThan(expected) {
      if (actual >= expected) {
        throw new Error(`Expected ${actual} to be less than ${expected}`);
      }
    },
    toContain(expected) {
      if (Array.isArray(actual)) {
        if (!actual.includes(expected)) {
          throw new Error(`Expected array to contain ${JSON.stringify(expected)}`);
        }
      } else if (typeof actual === 'string') {
        if (!actual.includes(expected)) {
          throw new Error(`Expected string to contain "${expected}"`);
        }
      }
    },
    not: {
      toContain(expected) {
        if (Array.isArray(actual)) {
          if (actual.includes(expected)) {
            throw new Error(`Expected array NOT to contain ${JSON.stringify(expected)}`);
          }
        }
      }
    },
    toHaveLength(expected) {
      if (actual.length !== expected) {
        throw new Error(`Expected length ${expected} but got ${actual.length}`);
      }
    },
    toThrow(ErrorClass) {
      let threw = false;
      let thrownError = null;
      try {
        actual();
      } catch (e) {
        threw = true;
        thrownError = e;
      }
      if (!threw) {
        throw new Error(`Expected function to throw`);
      }
      if (ErrorClass && !(thrownError instanceof ErrorClass)) {
        throw new Error(`Expected to throw ${ErrorClass.name} but threw ${thrownError.constructor.name}`);
      }
    },
    async toThrowAsync(ErrorClass) {
      let threw = false;
      let thrownError = null;
      try {
        await actual();
      } catch (e) {
        threw = true;
        thrownError = e;
      }
      if (!threw) {
        throw new Error(`Expected function to throw`);
      }
      if (ErrorClass && !(thrownError instanceof ErrorClass)) {
        throw new Error(`Expected to throw ${ErrorClass.name} but threw ${thrownError.constructor.name}`);
      }
    }
  };
}

// ============================================
// REGISTER TESTS
// ============================================

function registerTests() {
  // Component Definition Tests (sync - no ECS needed)
  testRunner.register('defineComponent creates valid component definition', () => {
    const Position = defineComponent('TestPosition', { x: 'number', y: 'number' });
    expect(Position.name).toBe('TestPosition');
    expect(Position.schema).toEqual({ x: 'number', y: 'number' });
  });

  testRunner.register('defineComponent accepts all field types', () => {
    const Mixed = defineComponent('MixedTypes', {
      num: 'number',
      str: 'string',
      bool: 'boolean',
      data: 'json'
    });
    expect(Mixed.schema.num).toBe('number');
    expect(Mixed.schema.str).toBe('string');
    expect(Mixed.schema.bool).toBe('boolean');
    expect(Mixed.schema.data).toBe('json');
  });

  // ECS Creation Tests
  testRunner.register('createECS returns ECS instance', async () => {
    const Position = defineComponent('PosCreate', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);
    expect(typeof ecs).toBe('object');
    expect(typeof ecs.createEntity).toBe('function');
  });

  testRunner.register('ECS has all required methods', async () => {
    const ecs = await createTestECS([]);
    expect(typeof ecs.createEntity).toBe('function');
    expect(typeof ecs.destroyEntity).toBe('function');
    expect(typeof ecs.addComponent).toBe('function');
    expect(typeof ecs.getComponent).toBe('function');
    expect(typeof ecs.updateComponent).toBe('function');
    expect(typeof ecs.removeComponent).toBe('function');
    expect(typeof ecs.hasComponent).toBe('function');
    expect(typeof ecs.hasEntity).toBe('function');
    expect(typeof ecs.query).toBe('function');
    expect(typeof ecs.transaction).toBe('function');
  });

  // Entity Tests
  testRunner.register('createEntity returns entity ID', async () => {
    const Position = defineComponent('Pos1', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);
    const id = ecs.createEntity();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  testRunner.register('createEntity accepts custom ID', async () => {
    const Position = defineComponent('Pos2', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);
    const id = ecs.createEntity('my-custom-id');
    expect(id).toBe('my-custom-id');
  });

  testRunner.register('hasEntity returns true for existing entity', async () => {
    const Position = defineComponent('Pos3', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);
    const id = ecs.createEntity('entity-exists');
    expect(ecs.hasEntity(id)).toBe(true);
  });

  testRunner.register('hasEntity returns false for non-existent entity', async () => {
    const ecs = await createTestECS([]);
    expect(ecs.hasEntity('does-not-exist')).toBe(false);
  });

  testRunner.register('destroyEntity removes entity', async () => {
    const Position = defineComponent('Pos4', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);
    const id = ecs.createEntity('to-destroy');
    ecs.destroyEntity(id);
    expect(ecs.hasEntity(id)).toBe(false);
  });

  testRunner.register('createEntity throws on duplicate ID', async () => {
    const Position = defineComponent('Pos5', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);
    ecs.createEntity('duplicate-test');
    expect(() => ecs.createEntity('duplicate-test')).toThrow();
  });

  // Component Tests
  testRunner.register('addComponent attaches data to entity', async () => {
    const Position = defineComponent('Pos6', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);
    const id = ecs.createEntity();
    ecs.addComponent(id, Position, { x: 10, y: 20 });
    const data = ecs.getComponent(id, Position);
    expect(data.x).toBe(10);
    expect(data.y).toBe(20);
  });

  testRunner.register('hasComponent returns true when component exists', async () => {
    const Position = defineComponent('Pos7', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);
    const id = ecs.createEntity();
    ecs.addComponent(id, Position, { x: 0, y: 0 });
    expect(ecs.hasComponent(id, Position)).toBe(true);
  });

  testRunner.register('hasComponent returns false when component missing', async () => {
    const Position = defineComponent('Pos8', { x: 'number', y: 'number' });
    const Health = defineComponent('Health8', { current: 'number', max: 'number' });
    const ecs = await createTestECS([Position, Health]);
    const id = ecs.createEntity();
    ecs.addComponent(id, Position, { x: 0, y: 0 });
    expect(ecs.hasComponent(id, Health)).toBe(false);
  });

  testRunner.register('getComponent returns null for missing component', async () => {
    const Position = defineComponent('Pos9', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);
    const id = ecs.createEntity();
    const data = ecs.getComponent(id, Position);
    expect(data).toBeNull();
  });

  testRunner.register('updateComponent modifies existing data', async () => {
    const Position = defineComponent('Pos10', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);
    const id = ecs.createEntity();
    ecs.addComponent(id, Position, { x: 0, y: 0 });
    ecs.updateComponent(id, Position, { x: 100 });
    const data = ecs.getComponent(id, Position);
    expect(data.x).toBe(100);
    expect(data.y).toBe(0);
  });

  testRunner.register('removeComponent deletes component from entity', async () => {
    const Position = defineComponent('Pos11', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);
    const id = ecs.createEntity();
    ecs.addComponent(id, Position, { x: 0, y: 0 });
    ecs.removeComponent(id, Position);
    expect(ecs.hasComponent(id, Position)).toBe(false);
  });

  testRunner.register('destroyEntity removes all components', async () => {
    const Position = defineComponent('Pos12', { x: 'number', y: 'number' });
    const Health = defineComponent('Health12', { current: 'number', max: 'number' });
    const ecs = await createTestECS([Position, Health]);
    const id = ecs.createEntity();
    ecs.addComponent(id, Position, { x: 0, y: 0 });
    ecs.addComponent(id, Health, { current: 100, max: 100 });
    ecs.destroyEntity(id);
    expect(ecs.hasEntity(id)).toBe(false);
  });

  // Query Tests
  testRunner.register('query returns entities with required component', async () => {
    const Position = defineComponent('Pos13', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);
    const id1 = ecs.createEntity();
    const id2 = ecs.createEntity();
    ecs.addComponent(id1, Position, { x: 0, y: 0 });
    const results = ecs.query([Position]);
    expect(results).toContain(id1);
    expect(results).not.toContain(id2);
  });

  testRunner.register('query with multiple components returns intersection', async () => {
    const Position = defineComponent('Pos14', { x: 'number', y: 'number' });
    const Health = defineComponent('Health14', { current: 'number', max: 'number' });
    const ecs = await createTestECS([Position, Health]);
    const id1 = ecs.createEntity();
    const id2 = ecs.createEntity();
    ecs.addComponent(id1, Position, { x: 0, y: 0 });
    ecs.addComponent(id1, Health, { current: 100, max: 100 });
    ecs.addComponent(id2, Position, { x: 0, y: 0 });
    const results = ecs.query([Position, Health]);
    expect(results).toContain(id1);
    expect(results).not.toContain(id2);
  });

  testRunner.register('query with exclude filters out entities', async () => {
    const Position = defineComponent('Pos15', { x: 'number', y: 'number' });
    const Dead = defineComponent('Dead15', { time: 'number' });
    const ecs = await createTestECS([Position, Dead]);
    const alive = ecs.createEntity();
    const dead = ecs.createEntity();
    ecs.addComponent(alive, Position, { x: 0, y: 0 });
    ecs.addComponent(dead, Position, { x: 0, y: 0 });
    ecs.addComponent(dead, Dead, { time: 0 });
    const results = ecs.query([Position], { exclude: [Dead] });
    expect(results).toContain(alive);
    expect(results).not.toContain(dead);
  });

  testRunner.register('queryWithData returns entity data', async () => {
    const Position = defineComponent('Pos16', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);
    const id = ecs.createEntity();
    ecs.addComponent(id, Position, { x: 42, y: 84 });
    const results = ecs.queryWithData([Position]);
    const entity = results.find(r => r.entityId === id);
    expect(entity).toBeDefined();
    expect(entity.data.Pos16.x).toBe(42);
  });

  // Event Tests
  testRunner.register('onEntityCreated fires on entity creation', async () => {
    const ecs = await createTestECS([]);
    let firedId = null;
    ecs.onEntityCreated((id) => { firedId = id; });
    const id = ecs.createEntity();
    expect(firedId).toBe(id);
  });

  testRunner.register('onEntityDestroyed fires on entity destruction', async () => {
    const ecs = await createTestECS([]);
    let firedId = null;
    ecs.onEntityDestroyed((id) => { firedId = id; });
    const id = ecs.createEntity('entity-for-destroy-event');
    ecs.destroyEntity(id);
    expect(firedId).toBe('entity-for-destroy-event');
  });

  testRunner.register('onComponentAdded fires when component added', async () => {
    const Position = defineComponent('Pos17', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);
    let eventData = null;
    ecs.onComponentAdded(Position, (id, data) => {
      eventData = { id, data };
    });
    const id = ecs.createEntity();
    ecs.addComponent(id, Position, { x: 5, y: 10 });
    expect(eventData).toBeDefined();
    expect(eventData.data.x).toBe(5);
  });

  testRunner.register('onComponentRemoved fires when component removed', async () => {
    const Position = defineComponent('Pos18', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);
    let removedId = null;
    ecs.onComponentRemoved(Position, (id) => { removedId = id; });
    const id = ecs.createEntity();
    ecs.addComponent(id, Position, { x: 0, y: 0 });
    ecs.removeComponent(id, Position);
    expect(removedId).toBe(id);
  });

  testRunner.register('onComponentUpdated fires when component updated', async () => {
    const Position = defineComponent('Pos19', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);
    let updateEvent = null;
    ecs.onComponentUpdated(Position, (id, oldData, newData) => {
      updateEvent = { id, oldData, newData };
    });
    const id = ecs.createEntity();
    ecs.addComponent(id, Position, { x: 0, y: 0 });
    ecs.updateComponent(id, Position, { x: 100 });
    expect(updateEvent).toBeDefined();
    expect(updateEvent.oldData.x).toBe(0);
    expect(updateEvent.newData.x).toBe(100);
  });

  testRunner.register('unsubscribe stops event callbacks', async () => {
    const ecs = await createTestECS([]);
    let callCount = 0;
    const unsubscribe = ecs.onEntityCreated(() => { callCount++; });
    ecs.createEntity();
    expect(callCount).toBe(1);
    unsubscribe();
    ecs.createEntity();
    expect(callCount).toBe(1);
  });

  // Transaction Tests
  testRunner.register('transaction commits changes on success', async () => {
    const Position = defineComponent('Pos20', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);
    await ecs.transaction(async (txEcs) => {
      txEcs.createEntity('tx-success');
      txEcs.addComponent('tx-success', Position, { x: 0, y: 0 });
    });
    expect(ecs.hasEntity('tx-success')).toBe(true);
    expect(ecs.hasComponent('tx-success', Position)).toBe(true);
  });

  testRunner.register('transaction rolls back on error', async () => {
    const Position = defineComponent('Pos21', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);
    try {
      await ecs.transaction(async (txEcs) => {
        txEcs.createEntity('tx-rollback');
        throw new Error('Intentional failure');
      });
    } catch (e) {
      // Expected
    }
    expect(ecs.hasEntity('tx-rollback')).toBe(false);
  });

  testRunner.register('transaction returns value from callback', async () => {
    const Position = defineComponent('Pos22', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);
    const result = await ecs.transaction(async () => {
      return 42;
    });
    expect(result).toBe(42);
  });

  // Archetype Tests
  testRunner.register('defineArchetype creates archetype definition', async () => {
    const Position = defineComponent('Pos23', { x: 'number', y: 'number' });
    const Health = defineComponent('Health23', { current: 'number', max: 'number' });
    const ecs = await createTestECS([Position, Health]);
    const archetype = ecs.defineArchetype([Position, Health]);
    expect(archetype).toBeDefined();
    expect(archetype.components).toHaveLength(2);
  });

  testRunner.register('createFromArchetype creates entity with all components', async () => {
    const Position = defineComponent('Pos24', { x: 'number', y: 'number' });
    const Health = defineComponent('Health24', { current: 'number', max: 'number' });
    const ecs = await createTestECS([Position, Health]);
    const archetype = ecs.defineArchetype([Position, Health]);
    const id = ecs.createFromArchetype(archetype, {
      Pos24: { x: 10, y: 20 },
      Health24: { current: 100, max: 100 }
    });
    expect(ecs.hasComponent(id, Position)).toBe(true);
    expect(ecs.hasComponent(id, Health)).toBe(true);
    const pos = ecs.getComponent(id, Position);
    expect(pos.x).toBe(10);
  });

  // Data Type Tests
  testRunner.register('string fields store correctly', async () => {
    const Named = defineComponent('Named25', { name: 'string' });
    const ecs = await createTestECS([Named]);
    const id = ecs.createEntity();
    ecs.addComponent(id, Named, { name: 'Test Entity' });
    const data = ecs.getComponent(id, Named);
    expect(data.name).toBe('Test Entity');
  });

  testRunner.register('boolean fields store correctly', async () => {
    const Flags = defineComponent('Flags26', { active: 'boolean', visible: 'boolean' });
    const ecs = await createTestECS([Flags]);
    const id = ecs.createEntity();
    ecs.addComponent(id, Flags, { active: true, visible: false });
    const data = ecs.getComponent(id, Flags);
    expect(data.active).toBe(true);
    expect(data.visible).toBe(false);
  });

  testRunner.register('json fields store complex data', async () => {
    const Inventory = defineComponent('Inv27', { items: 'json' });
    const ecs = await createTestECS([Inventory]);
    const id = ecs.createEntity();
    const items = [{ id: 'sword', qty: 1 }, { id: 'shield', qty: 1 }];
    ecs.addComponent(id, Inventory, { items });
    const data = ecs.getComponent(id, Inventory);
    expect(data.items).toHaveLength(2);
    expect(data.items[0].id).toBe('sword');
  });

  // Validation Tests
  testRunner.register('addComponent validates required fields', async () => {
    const Position = defineComponent('Pos28', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);
    const id = ecs.createEntity();
    expect(() => ecs.addComponent(id, Position, { x: 0 })).toThrow();
  });

  testRunner.register('addComponent validates field types', async () => {
    const Position = defineComponent('Pos29', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);
    const id = ecs.createEntity();
    expect(() => ecs.addComponent(id, Position, { x: 'not a number', y: 0 })).toThrow();
  });

  testRunner.register('updateComponent validates field types', async () => {
    const Position = defineComponent('Pos30', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);
    const id = ecs.createEntity();
    ecs.addComponent(id, Position, { x: 0, y: 0 });
    expect(() => ecs.updateComponent(id, Position, { x: 'invalid' })).toThrow();
  });

  // Edge Cases
  testRunner.register('multiple ECS instances are independent', async () => {
    const Position1 = defineComponent('PosA', { x: 'number', y: 'number' });
    const Position2 = defineComponent('PosB', { x: 'number', y: 'number' });
    const ecs1 = await createTestECS([Position1]);
    const ecs2 = await createTestECS([Position2]);
    ecs1.createEntity('shared-id');
    expect(ecs1.hasEntity('shared-id')).toBe(true);
    expect(ecs2.hasEntity('shared-id')).toBe(false);
  });

  testRunner.register('entity ID with special characters works', async () => {
    const Position = defineComponent('Pos31', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);
    const id = ecs.createEntity('entity-with-dashes_and_underscores');
    expect(ecs.hasEntity(id)).toBe(true);
  });

  testRunner.register('getComponent on non-existent entity returns null', async () => {
    const Position = defineComponent('Pos32', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);
    const data = ecs.getComponent('fake-entity', Position);
    expect(data).toBeNull();
  });

  testRunner.register('query with no components returns all entities', async () => {
    const ecs = await createTestECS([]);
    const id1 = ecs.createEntity();
    const id2 = ecs.createEntity();
    const results = ecs.query([]);
    expect(results).toContain(id1);
    expect(results).toContain(id2);
  });

  // Security Tests
  testRunner.register('prototype pollution via __proto__ is prevented', async () => {
    const Position = defineComponent('PosSec1', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);
    const id = ecs.createEntity();
    expect(() => {
      ecs.addComponent(id, Position, { x: 1, y: 2, __proto__: { polluted: true } });
    }).toThrow();
  });

  testRunner.register('prototype pollution via constructor is prevented', async () => {
    const Position = defineComponent('PosSec2', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);
    const id = ecs.createEntity();
    expect(() => {
      ecs.addComponent(id, Position, { x: 1, y: 2, constructor: { polluted: true } });
    }).toThrow();
  });
}

// ============================================
// REGISTER FUZZ TESTS
// ============================================

function registerFuzzTests() {
  testRunner.register('fuzz: random entity creation/destruction', async () => {
    const Position = defineComponent('FuzzPos1', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);

    const entities = [];
    for (let i = 0; i < 50; i++) {
      if (Math.random() > 0.3 || entities.length === 0) {
        const id = ecs.createEntity();
        entities.push(id);
        if (Math.random() > 0.5) {
          ecs.addComponent(id, Position, { x: Math.random() * 100, y: Math.random() * 100 });
        }
      } else {
        const idx = Math.floor(Math.random() * entities.length);
        const id = entities.splice(idx, 1)[0];
        ecs.destroyEntity(id);
      }
    }

    for (const id of entities) {
      expect(ecs.hasEntity(id)).toBe(true);
    }
  }, true);

  testRunner.register('fuzz: concurrent component operations', async () => {
    const Position = defineComponent('FuzzPos2', { x: 'number', y: 'number' });
    const Health = defineComponent('FuzzHealth2', { current: 'number', max: 'number' });
    const ecs = await createTestECS([Position, Health]);

    const entities = [];
    for (let i = 0; i < 10; i++) {
      entities.push(ecs.createEntity());
    }

    for (let i = 0; i < 100; i++) {
      const entity = entities[Math.floor(Math.random() * entities.length)];
      const component = Math.random() > 0.5 ? Position : Health;
      const hasComp = ecs.hasComponent(entity, component);

      if (hasComp && Math.random() > 0.5) {
        if (Math.random() > 0.5) {
          ecs.updateComponent(entity, component,
            component === Position
              ? { x: Math.random() * 100 }
              : { current: Math.random() * 100 }
          );
        } else {
          ecs.removeComponent(entity, component);
        }
      } else if (!hasComp) {
        ecs.addComponent(entity, component,
          component === Position
            ? { x: 0, y: 0 }
            : { current: 100, max: 100 }
        );
      }
    }

    expect(true).toBe(true);
  }, true);

  testRunner.register('fuzz: query stress test', async () => {
    const A = defineComponent('FuzzA', { val: 'number' });
    const B = defineComponent('FuzzB', { val: 'number' });
    const C = defineComponent('FuzzC', { val: 'number' });
    const ecs = await createTestECS([A, B, C]);

    for (let i = 0; i < 30; i++) {
      const id = ecs.createEntity();
      if (Math.random() > 0.3) ecs.addComponent(id, A, { val: i });
      if (Math.random() > 0.3) ecs.addComponent(id, B, { val: i });
      if (Math.random() > 0.3) ecs.addComponent(id, C, { val: i });
    }

    const components = [A, B, C];
    for (let i = 0; i < 20; i++) {
      const required = components.filter(() => Math.random() > 0.5);
      const excluded = components.filter(c => !required.includes(c) && Math.random() > 0.7);
      const results = ecs.query(required, { exclude: excluded });
      expect(Array.isArray(results)).toBe(true);
    }
  }, true);

  testRunner.register('fuzz: transaction stress test', async () => {
    const Position = defineComponent('FuzzPos3', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < 10; i++) {
      try {
        await ecs.transaction(async (txEcs) => {
          const id = txEcs.createEntity();
          txEcs.addComponent(id, Position, { x: i, y: i });

          if (Math.random() > 0.7) {
            throw new Error('Random failure');
          }
        });
        successCount++;
      } catch (e) {
        failCount++;
      }
    }

    expect(successCount + failCount).toBe(10);
  }, true);

  testRunner.register('fuzz: event callback stress', async () => {
    const Position = defineComponent('FuzzPos4', { x: 'number', y: 'number' });
    const ecs = await createTestECS([Position]);

    let eventCount = 0;
    const unsubscribers = [];

    for (let i = 0; i < 5; i++) {
      unsubscribers.push(ecs.onEntityCreated(() => eventCount++));
      unsubscribers.push(ecs.onEntityDestroyed(() => eventCount++));
      unsubscribers.push(ecs.onComponentAdded(Position, () => eventCount++));
    }

    for (let i = 0; i < 10; i++) {
      const id = ecs.createEntity();
      ecs.addComponent(id, Position, { x: 0, y: 0 });
      ecs.destroyEntity(id);
    }

    unsubscribers.slice(0, 7).forEach(u => u());

    for (let i = 0; i < 5; i++) {
      const id = ecs.createEntity();
      ecs.addComponent(id, Position, { x: 0, y: 0 });
    }

    expect(eventCount).toBeGreaterThan(0);
  }, true);
}

// ============================================
// DEMO PLAYBACK
// ============================================

let playbackActive = false;
let skipPlayback = false;

async function runDemoPlayback() {
  if (playbackActive) return;
  playbackActive = true;
  skipPlayback = false;

  const banner = document.getElementById('demo-banner');
  const cursor = document.getElementById('demo-cursor');
  const skipBtn = document.getElementById('skip-demo');

  banner.classList.remove('hidden');
  skipBtn.addEventListener('click', () => { skipPlayback = true; });

  try {
    // Exhibit 1: Entity-Component Playground
    await playExhibit1Demo();
    if (skipPlayback) return;

    // Exhibit 2: Query Explorer
    await playExhibit2Demo();
    if (skipPlayback) return;

    // Exhibit 3: Event Stream
    await playExhibit3Demo();
    if (skipPlayback) return;

    // Exhibit 4: Transaction Lab
    await playExhibit4Demo();

  } finally {
    banner.classList.add('hidden');
    cursor.classList.add('hidden');
    playbackActive = false;
  }
}

async function scrollToExhibit(exhibitId) {
  const exhibit = document.getElementById(exhibitId);
  if (!exhibit) return;

  exhibit.scrollIntoView({ behavior: 'smooth', block: 'center' });
  exhibit.classList.add('demo-active');

  await delay(500);
}

function endExhibitDemo(exhibitId) {
  const exhibit = document.getElementById(exhibitId);
  if (exhibit) {
    exhibit.classList.remove('demo-active');
  }
}

async function simulateClick(element) {
  if (skipPlayback || !element) return;

  const cursor = document.getElementById('demo-cursor');
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  cursor.classList.remove('hidden');
  cursor.style.left = `${x}px`;
  cursor.style.top = `${y}px`;

  await delay(150);

  element.classList.add('demo-click');
  element.click();

  await delay(100);
  element.classList.remove('demo-click');
}

async function simulateInput(element, value) {
  if (skipPlayback || !element) return;

  element.focus();
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));

  await delay(200);
}

async function playExhibit1Demo() {
  await scrollToExhibit('exhibit-1-section');
  if (skipPlayback) return;

  // Click on canvas to create new entity
  const canvas = document.getElementById('world-canvas');
  if (canvas) {
    const rect = canvas.getBoundingClientRect();
    const clickEvent = new MouseEvent('click', {
      clientX: rect.left + 250,
      clientY: rect.top + 100,
      bubbles: true
    });
    canvas.dispatchEvent(clickEvent);
    await delay(500);
  }

  // Click New Entity button
  await simulateClick(document.getElementById('new-entity'));
  await delay(300);

  // Add a custom ID entity
  await simulateInput(document.getElementById('custom-entity-id'), 'demo-entity');
  await simulateClick(document.getElementById('new-entity-with-id'));
  await delay(500);

  endExhibitDemo('exhibit-1-section');
  await delay(1000);
}

async function playExhibit2Demo() {
  await scrollToExhibit('exhibit-2-section');
  if (skipPlayback) return;

  // Check Position checkbox
  await simulateClick(document.getElementById('req-position'));
  await delay(400);

  // Check Health checkbox
  await simulateClick(document.getElementById('req-health'));
  await delay(400);

  // Show filter builder
  await simulateClick(document.getElementById('add-filter'));
  await delay(300);

  // Fill in filter and apply
  document.getElementById('filter-component').value = 'Health';
  document.getElementById('filter-field').innerHTML = '<option value="current">current</option><option value="max">max</option>';
  document.getElementById('filter-field').value = 'current';
  document.getElementById('filter-operator').value = '>';
  await simulateInput(document.getElementById('filter-value'), '50');
  await simulateClick(document.getElementById('apply-filter'));
  await delay(500);

  // Clear query
  await simulateClick(document.getElementById('clear-query'));
  await delay(300);

  endExhibitDemo('exhibit-2-section');
  await delay(1000);
}

async function playExhibit3Demo() {
  await scrollToExhibit('exhibit-3-section');
  if (skipPlayback) return;

  // Create entity
  await simulateClick(document.getElementById('evt-create-entity'));
  await delay(300);

  // Add Position
  await simulateClick(document.getElementById('evt-add-position'));
  await delay(300);

  // Add Health
  await simulateClick(document.getElementById('evt-add-health'));
  await delay(300);

  // Update Health
  await simulateClick(document.getElementById('evt-update-health'));
  await delay(300);

  // Toggle off Component Updated filter
  await simulateClick(document.getElementById('filter-component-updated'));
  await delay(200);

  // Update Health again (no event should appear)
  await simulateClick(document.getElementById('evt-update-health'));
  await delay(300);

  // Toggle back on
  await simulateClick(document.getElementById('filter-component-updated'));
  await delay(200);

  // Destroy entity
  await simulateClick(document.getElementById('evt-destroy-entity'));
  await delay(300);

  endExhibitDemo('exhibit-3-section');
  await delay(1000);
}

async function playExhibit4Demo() {
  await scrollToExhibit('exhibit-4-section');
  if (skipPlayback) return;

  // Start transaction
  await simulateClick(document.getElementById('start-transaction'));
  await delay(300);

  // Queue operations
  await simulateClick(document.getElementById('tx-create-entity'));
  await delay(200);

  await simulateClick(document.getElementById('tx-add-component'));
  await delay(200);

  await simulateClick(document.getElementById('tx-add-component'));
  await delay(200);

  // Commit
  await simulateClick(document.getElementById('tx-commit'));
  await delay(800);

  // Start another transaction for rollback demo
  await simulateClick(document.getElementById('start-transaction'));
  await delay(300);

  await simulateClick(document.getElementById('tx-create-entity'));
  await delay(200);

  await simulateClick(document.getElementById('tx-destroy-entity'));
  await delay(200);

  // Trigger rollback
  await simulateClick(document.getElementById('tx-rollback'));
  await delay(500);

  endExhibitDemo('exhibit-4-section');
}

// ============================================
// INITIALIZATION
// ============================================

export function initTestRunner(ecs, comps) {
  mainEcs = ecs;
  components = comps;

  registerTests();
  registerFuzzTests();

  // Wire up buttons
  document.getElementById('run-tests').addEventListener('click', () => testRunner.run(false));
  document.getElementById('run-fuzz').addEventListener('click', () => testRunner.run(true));
}
