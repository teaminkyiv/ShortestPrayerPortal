import { execSync } from 'child_process'
import { clerkSetup } from '@clerk/testing/playwright'
import { config } from 'dotenv'

config({ path: '.env.local', override: false })

async function globalSetup() {
  await clerkSetup()
  execSync('npm run seed:test', { stdio: 'inherit' })
}

export default globalSetup
