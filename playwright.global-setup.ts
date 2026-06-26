import { execSync } from 'child_process'

async function globalSetup() {
  execSync('npm run seed:test', { stdio: 'inherit' })
}

export default globalSetup
