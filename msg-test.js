/* Copyright (c) 2018-2019 voxgig and other contributors, MIT License */
'use strict'

const Util = require('util')

const Jsonic = require('jsonic')
const Inks = require('inks')
const Optioner = require('optioner')
const Joi = Optioner.Joi

module.exports = msg_test
module.exports.Joi = Joi

const optioner = Optioner({
  test: Joi.boolean().default(true),
  log: Joi.boolean().default(false),
  data: Joi.object()
    .unknown()
    .default({}),
  context: Joi.object()
    .unknown()
    .default({}),
  fix: Joi.string().default(''), // DEPRECATED, use pattern instead
  pattern: Joi.string().default(''),
  delegates: Joi.object()
    .pattern(/^/, Joi.array().items(Joi.object().allow(null)))
    .default({}),
  calls: Joi.array().items(
    Joi.object({
      name: Joi.string().min(1),
      print: Joi.boolean().default(false),
      print_context: Joi.boolean().default(false),
      pattern: Joi.string().min(3),
      params: Joi.object()
        .unknown()
        .default({}),
      out: Joi.alternatives().try(Joi.object().unknown(), Joi.array()),
      err: Joi.object().unknown(),
      delegate: Joi.string(),
      verify: Joi.func()
    })
  )
})

function msg_test(seneca, spec) {
  spec = optioner.check(spec)

  // top level `pattern` replaces `fix`; `fix` deprecated as does not override
  spec.pattern = '' === spec.pattern ? spec.fix : spec.pattern

  test.run = intern.run
  return test

  async function test() {
    await seneca.ready()
  
    if (spec.test) {
      seneca.test(null, spec.log ? 'print' : null)
    }

    if (!seneca.has_plugin('promisify')) {
      seneca.use('promisify')
      await seneca.ready()
    }

    // TODO: make optional
    var datajson = JSON.stringify(spec.data)

    await seneca.post('role:mem-store,cmd:import', {
      json: datajson,
      default$: {}
    })

    const foundmsgs = seneca
      .list(spec.pattern)
      .map(msg => seneca.util.pattern(msg))

    const specmsgs = {}

    spec.calls.forEach(call => {
      var specmsg = seneca.util.pattern(
        Jsonic(spec.pattern + ',' + call.pattern)
      )
      specmsgs[specmsg] = true
    })

    for (var i = 0; i < foundmsgs.length; i++) {
      var msg = foundmsgs[i]
      if (null == specmsgs[msg]) {
        throw new Error('Test calls not defined for: ' + msg)
      }
    }

    Object.keys(spec.delegates).forEach(dk => {
      spec.delegates[dk] = seneca.delegate.apply(seneca, spec.delegates[dk])
    })

    await intern.run(seneca, spec)
  }
}

const intern = (module.exports.intern = {
  run: async function(seneca, spec) {
    var callmap = spec.context

    return new Promise((resolve, reject) => {
      next_call(0, function(err) {
        if (err) {
          return reject(err)
        } else {
          return resolve()
        }
      })
    })

    function next_call(call_index, done) {
      if (spec.calls.length <= call_index) {
        return done()
      }

      var call = spec.calls[call_index]

      if (false === call.run) {
        return setImmediate(next_call.bind(null, call_index + 1, done))
      }

      var params = {}
      Object.keys(call.params).forEach(function(pk) {
        var pv = call.params[pk]

        pk = Inks(pk, callmap)
        if ('string' === typeof pv) {
          pv = Inks(pv, callmap)
        }

        params[pk] = pv
      })

      var print = spec.print || call.print

      if (print) {
        console.log('\n\nCALL   : ', call.pattern, params)
      }

      if (call.print_context) {
        console.dir(callmap, { depth: 3, colors: true })
      }

      var msg = Object.assign(
        {},
        params,
        spec.pattern ? Jsonic(spec.pattern) : {},
        Jsonic(call.pattern)
      )
      var msgstr = Jsonic.stringify(msg)

      var instance = seneca

      if (call.delegate) {
        instance = spec.delegates[call.delegate]

        if (null == instance) {
          return done(new Error('Delegate not defined: ' + call.delegate))
        }
      }

      instance.act(msg, function(err, out, meta) {
        if (print) {
          console.log('ERROR  : ', err)
          console.log(
            'RESULT : ',
            Util.inspect(out, { depth: null, colors: true })
          )
        }

        if (null == call.err) {
          if (null != err) {
            return done(
              new Error('Error not expected for: ' + msgstr + ', err: ' + err)
            )
          }
        } else {
          if (null == err) {
            return done(
              new Error('Error expected for: ' + msgstr + ', was null')
            )
          }

          var result = Optioner(call.err, { must_match_literals: true })(err)
          if (result.error) {
            return done(result.error)
          }
        }

        if (null === call.out) {
          if (null != out) {
            return done(
              new Error('Output not expected for: ' + msgstr + ', out: ' + out)
            )
          }
        } else if (null != call.out) {
          if (null == out) {
            return done(
              new Error('Output expected for: ' + msgstr + ', was null')
            )
          } else {
            var result = Optioner(call.out, { must_match_literals: true })(out)
            if (result.error) {
              return done(
                new Error(
                  'Output for: ' +
                    msgstr +
                    ' was invalid: ' +
                    result.error.message
                )
              )
            }
          }
        }

        if(null != call.verify) {
          var result = call.verify(call, callmap)
          if (null != result && true !== result ) {
            return done(
              new Error(
                'Verify of: ' +
                  msgstr +
                  ' failed: ' +
                  (result.message || result)
              )
            )
          }

        }
        
        if (call.name) {
          callmap[call.name] = {
            top_pattern: spec.pattern,
            pattern: call.pattern,
            params: params,
            msg: msg,
            err: err,
            out: out,
            meta: meta
          }
        }

        setImmediate(next_call.bind(null, call_index + 1, done))
      })
    }
  }
})
