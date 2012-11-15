var daisychain = require('../lib/index');
var assert = require('assert');

function sq(n, callback) {
  if (n > Math.pow(3, 16)+1) return callback("Too Big");
  callback(null, n * n);
}

var tests = 9, incomplete_mon = setTimeout(function(){ assert.fail(0, tests, "Not all assertions exercised"); }, 1000);
function completed(is_last) {
  tests--;
  if (tests == 0) {
    clearTimeout(incomplete_mon);
  }

  if (tests < 0) {
    assert.fail(0, tests, "Test count is wrong.");
  }

  if (is_last && tests !== 0) {
    assert.fail("complete(true) called prematurely", tests);
  }
}

var dc = daisychain([sq, sq, sq, sq], 1);
dc.saturated = completed;
dc.empty = completed;
dc.drain = completed.bind(null, true);

dc.push(2, function(err, result) {
  assert.ifError(err);
  assert.equal(result, Math.pow(2, 16));
  completed();
});

dc.push(3, function(err, result) {
  assert.ifError(err);
  assert.equal(result, Math.pow(3, 16));
  completed();
});

dc.push(256, function(err, result) {
  assert.equal(err, "Too Big");
  completed();
});

dc.push([2,2,2], function(err, result) {
  assert.ifError(err);
  assert.equal(result, Math.pow(2, 16));
  completed();
});

assert.equal(dc.length(), 6);
