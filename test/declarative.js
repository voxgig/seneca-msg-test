
module.exports = {
  init: (seneca) => seneca.use('./p0.js'),
  test: true,
  fix: 'role:p0',
  calls: LN => [
    LN({
      pattern: 'get:foo',
      params: { x:1 },
      out: { ok:true, x:1, bar:'foo' },
    }),
  ]
}
