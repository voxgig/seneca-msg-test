# seneca-msg-test

[![npm version][npm-badge]][npm-url]
[![Build Status][travis-badge]][travis-url]
[![Dependency Status][david-badge]][david-url]
[![Coveralls][BadgeCoveralls]][Coveralls]
[![Maintainability](https://api.codeclimate.com/v1/badges/c55366fd7b8dd36d9865/maintainability)](https://codeclimate.com/github/voxgig/seneca-msg-test/maintainability)
[![Known Vulnerabilities](https://snyk.io/test/github/voxgig/seneca-msg-test/badge.svg?targetFile=package.json)](https://snyk.io/test/github/voxgig/seneca-msg-test?targetFile=package.json)
[![Gitter][gitter-badge]][gitter-url]


Structured testing of seneca plugin messages.

Run Seneca messages in series (not parallel) to validate behavior
against expectations. 


## Example

See [example](msg-test/example) folder


### Test Specification

```
# file: test-spec.js
module.exports = {
  print: true,
  pattern: 'role:foo',
  data: {
    foo: {
      bar: {
        b0: { id: 'b0', b: 0 },
        b1: { id: 'b1', b: 1 }
      }
    }
  },
  calls: [
    {
      // combined with top level pattern to form msg: 
      // role:foo,cmd:get,id:b0
      pattern: 'cmd:get',
      params: { id: 'b0' },
 
      // output result must match this Optioner (Joi-based) structure
      // https://github.com/rjrodger/optioner
      out: { b: 0 }
    },
    {
      // name a call to reference it later
      name: 'list-0',
      pattern: 'cmd:list',
      params: {},
      out: [{b: 0}, {b: 1}]
    },
    {
      pattern: 'cmd:get',
      // use https://github.com/rjrodger/inks back reference syntax
      params: { id: '`list-0:out[1].id`' },
      out: { b: 1 }
    },
  ]
}
```

### Test code

```
# basic.js
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
```


### Printed output (optional)

```
CALL   :  cmd:get { id: 'b0' }
ERROR  :  null
RESULT :  $-/foo/bar;id=b0;{b:0}


CALL   :  cmd:list {}
ERROR  :  null
RESULT :  [ $-/foo/bar;id=b0;{b:0}, $-/foo/bar;id=b1;{b:1} ]


CALL   :  cmd:get { id: 'b1' }
ERROR  :  null
RESULT :  $-/foo/bar;id=b1;{b:1}
```


[travis-badge]: https://travis-ci.org/voxgig/seneca-msg-test.svg
[travis-url]: https://travis-ci.org/voxgig/seneca-msg-test
[npm-badge]: https://badge.fury.io/js/seneca-msg-test.svg
[npm-url]: https://badge.fury.io/js/seneca-msg-test
[david-badge]: https://david-dm.org/voxgig/seneca-msg-test.svg
[david-url]: https://david-dm.org/voxgig/seneca-msg-test
[coveralls-badge]:https://coveralls.io/repos/voxgig/seneca-msg-test/badge.svg?branch=master&service=github
[coveralls-url]: https://coveralls.io/github/voxgig/seneca-msg-test?branch=master
[github issue]: https://github.com/voxgig/seneca-msg-test/issues
[@voxgig]: http://twitter.com/voxgig
[gitter-badge]: https://badges.gitter.im/Join%20Chat.svg
[gitter-url]: https://gitter.im/voxgig/seneca
[Voxgig org]: https://github.com/voxgig/
[Coveralls]: https://coveralls.io/github/voxgig/seneca-msg-test?branch=master
[BadgeCoveralls]: https://coveralls.io/repos/github/voxgig/seneca-msg-test/badge.svg?branch=master
[MIT]: ./LICENSE
