/* Copyright (c) 2018-2021 Voxgig and other contributors, MIT License */
'use strict'

// TODO: add line numbers to all fail msgs!

const Util = require('util')
const Assert = require('assert')

const Seneca = require('seneca')
const Jsonic = require('jsonic')
const Inks = require('inks')
const Optioner = require('optioner')
const Joi = Optioner.Joi

module.exports = msg_test
module.exports.Joi = Joi
module.exports.LN = LN

const optioner = Optioner({
  init: Joi.function(),
  test: Joi.boolean().default(true),
  log: Joi.boolean().default(false),
  data: Joi.object().unknown().default({}),
  context: Joi.object().unknown().default({}),
  fix: Joi.string().default(''), // DEPRECATED, use pattern instead
  pattern: Joi.string().default(''),
  delegates: Joi.object()
    .pattern(/^/, Joi.array().items(Joi.object().allow(null)))
    .default({}),
  allow: Joi.object({
    missing: Joi.boolean().default(false),
  }).default(),
  calls: Joi.alternatives().try(Joi.function(),Joi.array().items(
    Joi.object({
      name: Joi.string().min(1),
      print: Joi.boolean().default(false),
      print_context: Joi.boolean().default(false),
      pattern: Joi.string().min(3),
      params: Joi.alternatives()
        .try(Joi.object().unknown(), Joi.func())
        .default({}),
      out: Joi.alternatives().try(Joi.object().unknown(), Joi.array()),
      err: Joi.object().unknown(),
      delegate: Joi.alternatives(Joi.string(), Joi.array(), Joi.func()),
      verify: Joi.func(),
      line: Joi.string(),
    }))
  ),
})

function msg_test(seneca, spec) {

  // Seneca instance is optional
  if(seneca && !seneca.seneca) {
    spec = seneca
    seneca = null
  }

  spec = optioner.check(spec)

  Assert('object' === typeof spec.delegates)


  if(null == seneca) {
    seneca = Seneca().test()
  }

  if(spec.init) {
    seneca = spec.init(seneca)
  }

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

    var datajson = JSON.stringify(spec.data)

    await seneca.post('role:mem-store,cmd:import', {
      json: datajson,
      default$: {},
    })

    let calls = Array.isArray(spec.calls) ? spec.calls : spec.calls(LN)
    
    intern.missing_messages(seneca, spec, calls)

    Object.keys(spec.delegates).forEach((dk) => {
      spec.delegates[dk] = seneca.delegate.apply(seneca, spec.delegates[dk])
    })

    await intern.run(seneca, spec, calls)
  }
}

const intern = (module.exports.intern = {
  run: async function (seneca, spec, calls) {
    let callmap = spec.context
    
    return new Promise((resolve, reject) => {
      next_call(0, function (err) {
        if (err) {
          return reject(err)
        } else {
          return resolve()
        }
      })
    })

    function next_call(call_index, done) {
      try {
        if (calls.length <= call_index) {
          return done()
        }

        var call = calls[call_index]

        if (false === call.run) {
          return setImmediate(next_call.bind(null, call_index + 1, done))
        }

        var params = {}

        if ('function' === typeof call.params) {
          params = call.params(call, callmap, spec, seneca)
        } else {
          params = Inks(call.params, callmap)
        }

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
        call.msgstr = msgstr

        var instance = intern.handle_delegate(seneca, call, callmap, spec)

        instance.act(msg, function (err, out, meta) {
          // initial call meta data - allows self-refs in validation
          if (call.name) {
            callmap[call.name] = {
              top_pattern: spec.pattern,
              pattern: call.pattern,
              params: params,
              msg: msg,
              err: err,
              out: out,
              meta: meta,
            }
          }

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
                new Error(
                  'Output not expected for: ' + msgstr + ', out: ' + out
                )
              )
            }
          } else if (null != call.out) {
            if (null == out) {
              return done(
                new Error('Output expected for: ' + msgstr + ', was null')
              )
            } else {
              var current_call_out = Inks(call.out, callmap, {
                exclude: (k, v) => Joi.isSchema(v, { legacy: true }),
              })

              result = Optioner(current_call_out, {
                must_match_literals: true,
              })(out)
              if (result.error) {
                return done(
                  new Error(
                    'Output for: ' +
                      msgstr +
                      (call.line ? ' (' + call.line + ')' : '') +
                      ' was invalid: ' +
                      result.error.message
                  )
                )
              }
            }
          }

          if (null != call.verify) {
            call.result = { msg, err, out, meta }

            // TODO: handle Joi validation result
            result = call.verify(call, callmap, spec, instance)
            if (null != result && true !== result) {
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
              meta: meta,
            }
          }

          setImmediate(next_call.bind(null, call_index + 1, done))
        })
      } catch (e) {
        return done(e)
      }
    }
  },

  // TODO: support a default delegate
  handle_delegate: function (instance, call, callmap, spec) {
    if (call.delegate) {
      if ('string' === typeof call.delegate) {
        instance = spec.delegates[call.delegate]

        if (null == instance) {
          throw new Error(
            'Delegate not defined: ' +
              call.delegate +
              '. Message was: ' +
              call.msgstr
          )
        }
      } else if (Array.isArray(call.delegate)) {
        return instance.delegate.apply(instance, call.delegate)
      } else if ('function' === typeof call.delegate) {
        return call.delegate.call(instance, call, callmap, spec)
      } else {
        throw new Error(
          'Unknown delegate reference: ' +
            Util.inspect(call.delegate) +
            '. Message was: ' +
            call.msgstr
        )
      }
    }

    return instance
  },

  missing_messages: function (seneca, spec, calls) {
    var foundmsgs = seneca
      .list(spec.pattern)
      .map((msg) => seneca.util.pattern(msg))

    const specmsgs = []

    calls.forEach((call) => {
      var specmsg_obj = Jsonic(spec.pattern + ',' + call.pattern)
      specmsgs.push(specmsg_obj)
    })

    // remove msgs once found
    specmsgs.forEach((msg) => {
      var found = seneca.find(msg)
      if (found) {
        foundmsgs = foundmsgs.filter((msg) => msg != found.pattern)
      }
    })

    // there should be none left - all should be found
    if (0 < foundmsgs.length && !spec.allow.missing) {
      throw new Error('Test calls not defined for: ' + foundmsgs.join('; '))
    }
  },
})

// Get line number of test message in spec file.
// Use as an extra value in msg: `+LN()`
function LN(t) {
  var line = new Error().stack
    .split('\n')[2]
    .match(/[\/\\]([^./\\]+)[^/\\]*\.js:(\d+):/)
    .filter((x, i) => i == 1 || i == 2)
    .join('~')

  if (null == t) {
    return ',LN:' + line
  } else {
    t.line = line
    return t
  }
}
