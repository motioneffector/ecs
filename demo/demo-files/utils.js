// ============================================
// SHARED UTILITIES
// ============================================

// Escape HTML to prevent XSS
export function escapeHtml(str) {
  if (typeof str !== 'string') return String(str);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Format timestamp for event log
export function formatTime(date = new Date()) {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  });
}

// Truncate string with ellipsis
export function truncate(str, maxLength = 20) {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

// Deep clone an object
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Delay helper for animations
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Get entity display icon based on components
export function getEntityIcon(components) {
  const hasPosition = components.includes('Position');
  const hasHealth = components.includes('Health');
  const hasInventory = components.includes('Inventory');

  if (hasHealth && hasInventory) return '🧑'; // Player-like
  if (hasHealth && !hasInventory) return '👹'; // Enemy-like
  if (hasInventory && !hasHealth) return '📦'; // Container
  if (hasPosition && !hasHealth && !hasInventory) return '✨'; // Particle/effect
  return '⬡'; // Default
}

// Get component badge color class
export function getComponentColor(componentName) {
  const colors = {
    'Position': 'tag-blue',
    'Health': 'tag-red',
    'Inventory': 'tag-yellow'
  };
  return colors[componentName] || 'tag-purple';
}

// Get component icon
export function getComponentIcon(componentName) {
  const icons = {
    'Position': '📍',
    'Health': '❤️',
    'Inventory': '📦'
  };
  return icons[componentName] || '📎';
}

// Smooth scroll to element
export function scrollToElement(element, offset = 100) {
  const rect = element.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const targetY = rect.top + scrollTop - offset;

  window.scrollTo({
    top: targetY,
    behavior: 'smooth'
  });
}

// Generate a simple short ID
let idCounter = 0;
export function generateShortId(prefix = 'entity') {
  return `${prefix}-${++idCounter}`;
}

// Reset ID counter (for demo reset)
export function resetIdCounter() {
  idCounter = 0;
}

// Format component data for display
export function formatComponentData(data) {
  if (data === null || data === undefined) return 'null';
  if (typeof data === 'object') {
    return JSON.stringify(data, null, 2);
  }
  return String(data);
}

// Serialize state for comparison
export function serializeState(entities, ecs, components) {
  const state = {};
  for (const entityId of entities) {
    state[entityId] = {};
    for (const comp of components) {
      const data = ecs.getComponent(entityId, comp);
      if (data) {
        state[entityId][comp.name] = deepClone(data);
      }
    }
  }
  return state;
}

// Compare two states and return diff info
export function diffStates(before, after) {
  const diff = {
    added: [],
    removed: [],
    modified: []
  };

  // Check for added/modified
  for (const entityId of Object.keys(after)) {
    if (!(entityId in before)) {
      diff.added.push(entityId);
    } else if (JSON.stringify(before[entityId]) !== JSON.stringify(after[entityId])) {
      diff.modified.push(entityId);
    }
  }

  // Check for removed
  for (const entityId of Object.keys(before)) {
    if (!(entityId in after)) {
      diff.removed.push(entityId);
    }
  }

  return diff;
}

// Create a debounced function
export function debounce(fn, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), wait);
  };
}

// Create a throttled function
export function throttle(fn, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Add visual flash effect to element
export function flashElement(element) {
  element.classList.add('flash');
  setTimeout(() => element.classList.remove('flash'), 200);
}

// Add pulse effect to element
export function pulseElement(element) {
  element.classList.add('pulse');
  setTimeout(() => element.classList.remove('pulse'), 300);
}
