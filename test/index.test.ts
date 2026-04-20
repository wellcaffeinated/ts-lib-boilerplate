import { hello } from 'ts-lib-boilerplate'
import { describe, expect, it } from 'vitest'

describe('hello', () => {
  it('returns a greeting', () => {
    expect(hello('world')).toBe('Hello, world!')
  })
})
