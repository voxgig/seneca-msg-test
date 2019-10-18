
const Seneca = require('Seneca')
const SenecaMsgTest = require('..')

const seneca = Seneca().test()

// Test specification
const test_spec = require('./test-spec.js')


// Define some simplistic message actions
seneca
  .use('promisify')
  .use('entity')
  .message('role:foo,cmd:get', async function(msg) {
    return this.entity('foo/bar').load$(msg.id)
  })
  .message('role:foo,cmd:list', async function(msg) {
    return this.entity('foo/bar').list$()
  })

// Use this inside your testing code
const run_msgs = SenecaMsgTest(seneca, test_spec)

async function run_test() {
  await run_msgs()
}

run_test()
