/**
 * Custom error classes for @motioneffector/ecs
 */

/**
 * Base error class for all ECS errors
 */
export class ECSError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ECSError'
  }
}

/**
 * Thrown when validation fails (invalid input, missing required fields, etc.)
 */
export class ValidationError extends ECSError {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Thrown when a database operation fails
 */
export class DatabaseError extends ECSError {
  constructor(
    message: string,
    public override readonly cause?: unknown
  ) {
    super(message)
    this.name = 'DatabaseError'
  }
}
