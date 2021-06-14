module.exports = function(options) {
  this.add('role:p0,get:foo', function(msg, reply) {
    reply({
      ok: true,
      x: msg.x,
      bar: 'foo',
    })
  })
}
