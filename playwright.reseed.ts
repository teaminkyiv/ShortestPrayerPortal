/**
 * Playwright setup project: re-seeds the test DB after us5 mutating tests
 * so that us6+ tests see fresh data. Lives outside tests/ to avoid being
 * treated as a normal spec.
 */
import { test } from '@playwright/test'
import { execSync } from 'child_process'

test('reseed test database', () => {
  execSync('npm run seed:test', { stdio: 'inherit' })
})
