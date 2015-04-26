/**
 * tosck <https://github.com/tunnckoCore/tosck>
 *
 * Copyright (c) 2015 Charlike Mike Reagent, contributors.
 * Released under the MIT license.
 */

'use strict';

var test = require('assertit');
var tosck = require('./index');
var mukla = require('../mukla/index');

// mukla spec-like reporter (raw)
mukla.once('start', function(stats) {
  if (stats.init) return;
  mukla.removeAllListeners('start')
})
mukla.on('error', function _muklaError(storage) {
  this.tests++;
  this.failing++;
  storage.title = storage.name;
  this.emit('fail', storage);
  this.emit('test end', storage);
});
mukla.on('stop', function _muklaTestEnd(storage) {
  this.tests++;
  this.passing++;
  storage.title = storage.name;
  this.emit('pass', storage);
  this.emit('test end', storage);
});
mukla.on('suite', function(suite) {
  console.log()
  console.log('# suite:', suite.title);
});
mukla.on('suite end', function() {
  console.log('# suite end');
});
mukla.on('pass', function(test) {
  var ms = test.duration[1].toString();
  console.log('  ok %s (%s)', test.title, ms.slice(0, ms.length - 6) + 'ms');
});
mukla.on('fail', function(test) {
  var ms = test.duration[1].toString();
  console.log('  not ok %s (%s)', test.title, ms.slice(0, ms.length - 6) + 'ms');
});
mukla.once('end', function(stats) {
  console.log();
  console.log('\u001b[32mpassing', stats.passing + '\u001b[39m');
  console.log('\u001b[31mfailing', stats.failing + '\u001b[39m');
  console.log('----------');
  console.log('\u001b[90mtotal  ', stats.tests + '\u001b[39m');
});


// tests
mukla.describe('tosck:', function() {
  mukla.it('should work', function(done) {
    tosck('https://api.github.com/repos/tunnckoCore/is-missing', function(err, res) {
      test.ifError(err);
      done();
    });
  });
});

// describe('tosck:', function() {
//   it('should work', function(done) {
//     tosck('https://api.github.com/repos/tunnckoCore/is-missing', function(err, res) {
//       test.ifError(err);
//       done();
//     });
//   });
// });

// tosck('https://api.github.com/repos/tunnckoCore/is-missing', {
//   json: true,
//   headers: {
//     'accept': 'application/vnd.github.v3+json',
//     'authorization': 'Basic ' + new Buffer('tunnckoCore:3507243086114290').toString('base64')
//   }
// }, function(err, data, res) {
//   console.log(data)
//   console.log(res.statusCode)
// })
