/* Copyright © 2018-2019 voxgig ltd. CONFIDENTIAL AND PROPRIETARY. */
'use strict'

const Lab = require('@hapi/lab')
const Code = require('@hapi/code')
const lab = (exports.lab = Lab.script())
const expect = Code.expect

const SenecaMsgTest = require('../')
const Seneca = require('seneca')

lab.test(
  'happy',
  SenecaMsgTest(
    seneca_instance({ log: 'silent' }, function(seneca) {
      return seneca.use(function plugin0() {
        this.add('role:plugin0,cmd:zed', function(msg, reply) {
          this.make$('foo/bar').load$(msg.bid, reply)
        }).add('role:plugin0,cmd:qaz', function(msg, reply) {
          reply({ x: 1, y: msg.y })
        })
      })
    }),
    {
      test: true,
      data: {
        foo: {
          bar: {
            b0: { entity$: '-/foo/bar', id: 'b0', b: 0 },
            b1: { entity$: '-/foo/bar', id: 'b1', b: 1 }
          }
        }
      },
      pattern: 'role:plugin0',
      calls: [
        {
          pattern: 'cmd:zed',
          params: { bid: 'b0' },
          out: { b: 0 }
        },
        {
          pattern: 'cmd:qaz',
          params: { y: 'a' },
          out: { x: 1, y: 'a' }
        }
      ]
    }
  )
)

lab.test(
  'delegates',
  SenecaMsgTest(
    seneca_instance({ log: 'silent' }, function(seneca) {
      return seneca.use(function plugin0() {
        this.add('role:plugin0,cmd:qaz', function(msg, reply, meta) {
          reply({ x: 1, y: msg.y, z: meta.custom.z, w: msg.w })
        })
      })
    }),
    {
      test: true,
      print: false,
      delegates: {
        d0: [{ w: 'AA' }, { custom: { z: 'A' } }],
        d1: [{ w: 'BB' }, { custom: { z: 'B' } }]
      },
      pattern: 'role:plugin0',
      calls: [
        {
          delegate: 'd0',
          pattern: 'cmd:qaz',
          params: { y: 'a' },
          out: { x: 1, y: 'a', z: 'A', w: 'AA' }
        },
        {
          delegate: 'd1',
          pattern: 'cmd:qaz',
          params: { y: 'b' },
          out: { x: 1, y: 'b', z: 'B', w: 'BB' }
        },
        {
          delegate: 'd0',
          pattern: 'cmd:qaz',
          params: { y: 'c' },
          out: { x: 1, y: 'c', z: 'A', w: 'AA' }
        },
        {
          delegate: 'd1',
          pattern: 'cmd:qaz',
          params: { y: 'd' },
          out: { x: 1, y: 'd', z: 'B', w: 'BB' }
        },
        {
          delegate: [{ w: 'CC' }, { custom: { z: 'C' } }],
          pattern: 'cmd:qaz',
          params: { y: 'e' },
          out: { x: 1, y: 'e', z: 'C', w: 'CC' }
        }
      ]
    }
  )
)

lab.test(
  'data-sequence',
  SenecaMsgTest(
    seneca_instance({ log: 'silent' }, function(seneca) {
      return seneca.use(function foo() {
        this.add('role:foo,cmd:add', function(msg, reply) {
          this.make$('foo')
            .data$(msg.data)
            .save$(reply)
        })
          .add('role:foo,cmd:get', function(msg, reply) {
            this.make$('foo').load$(msg.id, reply)
          })
          .add('role:foo,cmd:list', function(msg, reply) {
            this.make$('foo').list$(msg.q, reply)
          })
          .add('role:foo,cmd:err', function(msg, reply) {
            reply(new Error(msg.text))
          })
      })
    }),
    {
      print: false,
      test: false,
      data: {},
      pattern: 'role:foo',
      calls: [
        {
          name: 'foo/a1',
          pattern: 'cmd:add',
          params: { data: { a: 1, b: 'A' } },
          out: { entity$: '-/-/foo', a: 1, b: 'A' }
        },
        {
          pattern: 'cmd:get',
          params: { id: '`foo/a1:out.id`' },
          out: { entity$: '-/-/foo', a: 1, b: 'A' }
        },
        {
          pattern: 'cmd:list',
          params: { q: { a: 1 } },
          out: [{ a: 1 }]
        },

        {
          pattern: 'cmd:list',
          // deep deref
          params: { q: { id: '`foo/a1:out.id`' } },
          out: [{ a: 1 }]
        },
        {
          pattern: 'cmd:err',
          params: { text: 'foo' },
          err: { msg: 'seneca: Action cmd:err,role:foo failed: foo.' }
        }
      ]
    }
  )
)

lab.test('bad-delegate', async () => {
  var msgfunc = SenecaMsgTest(seneca_instance({ log: 'silent' }), {
    test: true,
    pattern: 'a:1',
    calls: [
      {
        delegate: 'bad',
        pattern: 'b:1'
      }
    ]
  })()

  await expect(msgfunc).reject(
    Error,
    'Delegate not defined: bad. Message was: {a:1,b:1}'
  )
})

lab.test(
  'dynamic-delegate',
  SenecaMsgTest(
    seneca_instance({ log: 'silent' }, function(seneca) {
      return seneca
        .use('promisify')
        .message('a:1', async function(msg) {
          return { b: msg.b + 1 }
        })
        .message('c:1', async function(msg) {
          return { b: msg.b }
        })
    }),
    {
      test: true,
      print: false,
      pattern: 'x:1',
      calls: [
        {
          name: 'a',
          pattern: 'a:1',
          params: function() {
            return { b: 2 }
          },
          out: { b: 3 },
          verify: function(call, callmap, spec, seneca) {
            spec.delegates.d0 = seneca.delegate(call.out)
          }
        },
        {
          delegate: 'd0',
          pattern: 'c:1',
          out: { b: 3 }
        },
        {
          delegate: function(call, callmap) {
            return this.delegate(callmap.a.out)
          },
          pattern: 'c:1',
          out: { b: 3 }
        }
      ]
    }
  )
)

function seneca_instance(options, setup) {
  setup = setup || (x => x)
  return setup(Seneca(options).use('entity'))
}
