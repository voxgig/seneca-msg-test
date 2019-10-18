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
      // combined with top level pattern: role:foo,cmd:get
      pattern: 'cmd:get',
      params: { id: 'b0' },
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
