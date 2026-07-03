import { Page } from '@playwright/test'
import { setupClerkTestingToken } from '@clerk/testing/playwright'

export async function login(page: Page) {
  await setupClerkTestingToken({ page })
}
