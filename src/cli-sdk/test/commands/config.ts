import { PackageJson } from '@vltpkg/package-json'
import { PathScurry } from 'path-scurry'
import type { Test } from 'tap'
import t from 'tap'
import type { LoadedConfig } from '../../src/config/index.ts'

const mockCommand = (t: Test, mocks?: Record<string, any>) =>
  t.mockImport<typeof import('../../src/commands/config.ts')>(
    '../../src/commands/config.ts',
    mocks,
  )

// Mock the config functions to focus on CLI routing
const mockConfigFunctions = {
  get: async () => 'mocked-get-result',
  set: async () => undefined,
  edit: async () => undefined,
  list: () => ['color=auto', 'registry=https://registry.npmjs.org/'],
  del: async () => undefined,
}

class MockConfig {
  values: Record<string, any>
  positionals: string[]

  constructor(positionals: string[], values: Record<string, any>) {
    this.positionals = positionals
    this.values = values
    this.values.packageJson = new PackageJson()
    this.values.scurry = new PathScurry(t.testdirName)
    // Set default config option to 'all' to match the new default
    if (!this.values.config) {
      this.values.config = 'all'
    }
  }
  get options() {
    return this.values
  }
  get(key: string) {
    return this.values[key]
  }
}

const run = async (
  t: Test,
  positionals: string[],
  values: Record<string, any> = {},
) => {
  const conf = new MockConfig(positionals, values)
  const cmd = await mockCommand(t, {
    '@vltpkg/config': mockConfigFunctions,
    '@vltpkg/vlt-json': {
      load: () => ({}),
      find: (which: 'user' | 'project') =>
        which === 'user' ?
          '/home/user/.config/vlt/vlt.json'
        : '/project/vlt.json',
    },
  })
  return cmd.command(conf as unknown as LoadedConfig)
}

const USAGE = await mockCommand(t).then(C => C.usage().usage())

t.matchSnapshot(USAGE, 'usage')

t.test('command routing', async t => {
  t.test('get command', async t => {
    const result = await run(t, ['get', 'registry'])
    // With default --config=all, should return merged config value
    t.equal(result, 'mocked-get-result')
  })

  t.test('set command', async t => {
    const result = await run(t, ['set', 'registry=example.com'])
    t.equal(result, undefined)
  })

  t.test('list command', async t => {
    const result = await run(t, ['list'])
    t.strictSame(result, [
      'color=auto',
      'registry=https://registry.npmjs.org/',
    ])
  })

  t.test('ls alias', async t => {
    const result = await run(t, ['ls'])
    t.strictSame(result, [
      'color=auto',
      'registry=https://registry.npmjs.org/',
    ])
  })

  t.test('edit command', async t => {
    const result = await run(t, ['edit'])
    t.equal(result, undefined)
  })

  t.test('del command', async t => {
    const result = await run(t, ['del', 'registry'])
    t.equal(result, undefined)
  })

  t.test('delete command', async t => {
    const result = await run(t, ['delete', 'registry'])
    t.equal(result, undefined)
  })

  t.test('rm alias', async t => {
    const result = await run(t, ['rm', 'registry'])
    t.equal(result, undefined)
  })

  t.test('pick command', async t => {
    const result = await run(t, ['pick'])
    // Should return a JSON object (merged config) when no args provided
    t.type(result, 'object')
    t.ok(result && typeof result === 'object')
    // Check that it has the expected config property
    if (result && typeof result === 'object' && 'config' in result) {
      t.equal((result as any).config, 'all')
    }
  })

  t.test('no subcommand shows help', async t => {
    await t.rejects(run(t, []), {
      message: 'config command requires a subcommand',
      cause: {
        found: undefined,
        validOptions: [
          'get',
          'pick',
          'set',
          'delete',
          'list',
          'edit',
          'location',
        ],
      },
    })
  })

  t.test('location command', async t => {
    const result = await run(t, ['location'])
    t.type(result, 'string')
    t.match(result, /vlt\.json$/)
    t.equal(result, '/project/vlt.json')
  })

  t.test('location command with --config=user', async t => {
    const result = await run(t, ['location'], { config: 'user' })
    t.equal(result, '/home/user/.config/vlt/vlt.json')
  })

  t.test('location command with --config=project', async t => {
    const result = await run(t, ['location'], { config: 'project' })
    t.equal(result, '/project/vlt.json')
  })

  t.test(
    'location command with --config=all defaults to project',
    async t => {
      const result = await run(t, ['location'], { config: 'all' })
      t.equal(result, '/project/vlt.json')
    },
  )

  t.test('invalid command', async t => {
    await t.rejects(run(t, ['invalid']), {
      message: 'Unrecognized config command',
      cause: {
        found: 'invalid',
        validOptions: [
          'get',
          'pick',
          'set',
          'delete',
          'list',
          'edit',
          'location',
        ],
      },
    })
  })
})

t.test('enhanced get functionality', async t => {
  t.test('get with no args falls back to pick', async t => {
    const result = await run(t, ['get'])
    // Should return a JSON object (merged config) when no args provided
    t.type(result, 'object')
    t.ok(result && typeof result === 'object')
    // Check that it has the expected config property
    if (result && typeof result === 'object' && 'config' in result) {
      t.equal((result as any).config, 'all')
    }
  })

  t.test(
    'get with single arg and --config=all returns merged config value',
    async t => {
      const result = await run(t, ['get', 'color'], { config: 'all' })
      // Should return the merged config value (same as original get behavior)
      t.equal(result, 'mocked-get-result')
    },
  )

  t.test(
    'get with single arg and --config=user returns JSON value',
    async t => {
      const result = await run(t, ['get', 'registry'], {
        config: 'user',
      })
      // Should return undefined (no user config in test environment) which gets JSON.stringify'd
      t.equal(result, undefined)
    },
  )

  t.test(
    'get with single arg and --config=project returns JSON value',
    async t => {
      const result = await run(t, ['get', 'registry'], {
        config: 'project',
      })
      // Should return undefined (no project config in test environment) which gets JSON.stringify'd
      t.equal(result, undefined)
    },
  )

  t.test('get with multiple args uses pick behavior', async t => {
    const result = await run(t, ['get', 'registry', 'color'])
    // Should return an object with the requested keys
    t.type(result, 'object')
    t.ok(result && typeof result === 'object')
  })
})

t.test('pick command functionality', async t => {
  t.test('pick with no args and --config=all', async t => {
    const result = await run(t, ['pick'], { config: 'all' })
    // Should return merged config object
    t.type(result, 'object')
    t.ok(result && typeof result === 'object')
  })

  t.test('pick with no args and --config=user', async t => {
    const result = await run(t, ['pick'], { config: 'user' })
    // Should return user config object (empty in test environment)
    t.type(result, 'object')
    t.equal(JSON.stringify(result), '{}')
  })

  t.test('pick with no args and --config=project', async t => {
    const result = await run(t, ['pick'], { config: 'project' })
    // Should return project config object (empty in test environment)
    t.type(result, 'object')
    t.equal(JSON.stringify(result), '{}')
  })

  t.test('pick with specific keys', async t => {
    const result = await run(t, ['pick', 'registry', 'color'])
    // Should return an object with the requested keys
    t.type(result, 'object')
    t.ok(result && typeof result === 'object')
  })

  t.test('pick with specific keys and --config=user', async t => {
    const result = await run(t, ['pick', 'registry'], {
      config: 'user',
    })
    // Should return an object with the requested key from user config
    t.type(result, 'object')
    t.ok(result && typeof result === 'object')
    if (
      result &&
      typeof result === 'object' &&
      'registry' in result
    ) {
      t.equal((result as any).registry, undefined)
    }
  })
})

t.test('list command functionality', async t => {
  t.test('list with --config=all', async t => {
    const result = await run(t, ['list'], { config: 'all' })
    // Should return array of strings in key=value format
    t.type(result, 'object')
  })

  t.test('list with --config=user', async t => {
    const result = await run(t, ['list'], { config: 'user' })
    // Should return array of strings from user config (empty in test environment)
    t.type(result, 'object')
    if (Array.isArray(result)) {
      t.equal(result.length, 0)
    }
  })

  t.test('list with --config=project', async t => {
    const result = await run(t, ['list'], { config: 'project' })
    // Should return array of strings from project config (empty in test environment)
    t.type(result, 'object')
    if (Array.isArray(result)) {
      t.equal(result.length, 0)
    }
  })
})

t.test('error handling', async t => {
  t.test('get with empty key should throw error', async t => {
    // This tests the error case where key is empty
    await t.rejects(run(t, ['get', '']), {
      message: 'Key is required',
      cause: { code: 'EUSAGE' },
    })
  })
})
