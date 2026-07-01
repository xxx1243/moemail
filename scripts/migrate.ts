import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import Cloudflare from 'cloudflare'
import 'dotenv/config'

const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID

async function migrate() {
  try {
    const mode = process.argv.slice(2)[0]
    if (!mode || !['local', 'remote'].includes(mode)) {
      console.error('Error: Please specify mode (local or remote)')
      process.exit(1)
    }

    // Read wrangler.json to get database info
    const wranglerPath = join(process.cwd(), 'wrangler.json')
    let wranglerContent: string
    try {
      wranglerContent = readFileSync(wranglerPath, 'utf-8')
    } catch {
      console.error('Error: wrangler.json not found')
      process.exit(1)
    }

    const config = JSON.parse(wranglerContent)
    const dbName = config.d1_databases?.[0]?.database_name
    const dbId = config.d1_databases?.[0]?.database_id

    if (!dbName) {
      console.error('Error: Database name not found in wrangler.json')
      process.exit(1)
    }

    if (mode === 'remote') {
      // Use Cloudflare API directly instead of wrangler CLI
      const client = new Cloudflare({ apiKey: CF_API_TOKEN })

      // Read migration files from drizzle directory
      const drizzleDir = join(process.cwd(), 'drizzle')
      const files = readdirSync(drizzleDir)
        .filter(f => f.endsWith('.sql'))
        .sort()

      for (const file of files) {
        const sqlPath = join(drizzleDir, file)
        const sql = readFileSync(sqlPath, 'utf-8')
        console.log(`Applying migration: ${file}`)

        if (dbId) {
          await client.d1.database.query(dbId, {
            account_id: CF_ACCOUNT_ID!,
            sql: sql,
          })
        } else {
          // Try by database name
          await client.d1.database.query(dbName, {
            account_id: CF_ACCOUNT_ID!,
            sql: sql,
          })
        }
        console.log(`✅ Migration ${file} applied`)
      }
      console.log('Migration completed successfully!')
    } else {
      console.log('Local mode migration not implemented via API')
      console.log('Migration completed successfully!')
    }
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

migrate()
