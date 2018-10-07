/* Copyright © 2018 voxgig ltd. CONFIDENTIAL AND PROPRIETARY. */
'use strict'

const Util = require('util')

const Lab = require('lab')
const Code = require('code')
const lab = (exports.lab = Lab.script())
const expect = Code.expect

const SenecaMsgTest = require('../')
const Seneca = require('seneca')
const Joi = SenecaMsgTest.Joi


lab.test('happy', SenecaMsgTest(
  seneca_instance({log:'silent'},function(seneca) {
    return seneca
      .use(function plugin0() {
        this
          .add('role:plugin0,cmd:zed', function(msg, reply) {
            this.make$('foo/bar').load$(msg.bid, reply)
          })
          .add('role:plugin0,cmd:qaz',function(msg, reply){
            reply({x:1,y:msg.y})
          })
      })
  }),
  {
    test: true,
    data: { foo: { bar: {
      b0: {entity$:'-/foo/bar', id:'b0', b:0},
      b1: {entity$:'-/foo/bar', id:'b1', b:1} }}},
    pattern: 'role:plugin0',
    calls: [
      {
        pattern: 'cmd:zed',
        params: { bid: 'b0' },
        out: { b: 0 }
      },
      {
        pattern: 'cmd:qaz',
        params: { y:'a' },
        out: { x:1, y:'a' }
      },
    ]
  }))


lab.test('data-sequence', SenecaMsgTest(
  seneca_instance({log:'silent'},function(seneca) {
    return seneca
      .use(function foo() {
        this
          .add('role:foo,cmd:add', function(msg, reply) {
            this.make$('foo').data$(msg.data).save$(reply)
          })
          .add('role:foo,cmd:get', function(msg, reply) {
            this.make$('foo').load$(msg.id, reply)
          })
          .add('role:foo,cmd:list',function(msg, reply) {
            this.make$('foo').list$(msg.q, reply)
          })
          .add('role:foo,cmd:err',function(msg, reply) {
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
        name:'foo/a1',
        pattern: 'cmd:add',
        params: { data: {a:1,b:'A'} },
        out: { entity$:'-/-/foo', a:1, b:'A' }
      },
      {
        pattern: 'cmd:get',
        params: { id:'`foo/a1:out.id`' },
        out: { entity$:'-/-/foo', a:1, b:'A' }
      },
      {
        pattern: 'cmd:list',
        params: {q:{a:1}},
        out: [{a:1}]
      },
      // don't care about output
      {
        pattern: 'cmd:list',
        params: {q:{a:1}},
      },
      {
        pattern: 'cmd:err',
        params: {text:'foo'},
        err: {message:'seneca: Action cmd:err,role:foo failed: foo.'}
      }
    ]
  }))



// TODO: provide in common-server-test
function seneca_instance(options, setup) {
  return setup( Seneca(options)
                .use('entity') )
}

