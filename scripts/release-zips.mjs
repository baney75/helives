// Writes build/release/helives-library-md.zip and -toml.zip, the whole library for a GitHub release.
// Usage: node scripts/release-zips.mjs, then: gh release create <tag> build/release/*.zip
import { join } from 'node:path'
import { libraryBundles } from '../site/lib/bundles.mjs'
import { ROOT } from '../site/lib/load.mjs'

for (const f of libraryBundles(join(ROOT, 'build', 'release'))) console.log(f)
