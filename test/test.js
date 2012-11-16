var daisychain = require('../lib/index');
var assert = require('assert');

//// A Harness of sorts ////
var tests_remaining = 19;
function completed() {
  tests_remaining--;
}

process.on("exit", function() {
  if (tests_remaining !== 0) {
    assert.fail(tests_remaining, 0, "Exited, but " + tests_remaining + " test(s) did not call complete().");
  } else if (tests_remaining < 0) {
    assert.fail(0, tests_remaining, Math.abs(tests_remaining) + " tests too many ran.");
  } else {
    // All OK
  }
});


//// Workers ////
function sq(n, callback) {
  callback(null, n * n);
}

function plus1(n, callback) {
  if (n == 5) return callback("Got 5");
  callback(null, n + 1);
}


//// Tests ////
var dc3 = daisychain([
     function(memo, cb) { if (memo != "A") return cb("A Expected"); cb(null, "B"); }
    ,function(memo, cb) { if (memo != "B") return cb("B Expected"); cb(null, "C"); }
    ,function(memo, cb) { if (memo != "C") return cb("C Expected"); cb(null, "D"); }
    ,function(memo, cb) { if (memo != "D") return cb("D Expected"); cb(null, "E"); }
  ], 1);
dc3.push("A", function(err, result) {
  assert.ifError(err);
  assert.equal(result, "E");
  completed();
})

dc3.push("B", function(err, result) {
  assert.equal(err, "A Expected");
  completed();
})



var dc = daisychain([sq, sq, sq, sq], 1);
dc.saturated = completed;
dc.empty = completed;
dc.drain = completed;

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

dc.push([2,2,2], function(err, result) {
  assert.ifError(err);
  assert.equal(result, Math.pow(2, 16));
  completed();
});

assert.equal(dc.length(), 5);



var dc4 = daisychain(
  [
    // this function will only work once, every successive call will fail.
    function(memo, cb) { 
      if (!this.toggle) {
        this.toggle = true;
        cb(null, "y");
      } else {
        cb(new Error("No, no, no!"));
      }
    }
    // this function has a repeating pattern of fail, succeed, fail, etc.
    ,function(memo, cb) {
      this.toggle = !this.toggle; 
      if (this.toggle) {
        cb(new Error("Uh, oh"));
      } else {
        cb(null, "z");
      }
    }
  ], 1);
dc4.push("x", function dc4_cb(err, result, queue_id) {
  if (err) {    // first time daisy chain tells us worker #2 failed.
    assert.equal(result, "y");
    assert.equal(queue_id, 1);    // first worker succeeded, second failed, retry should be the second.
    dc4.retry(queue_id, result, dc4_cb);
    return;
  }
  // second time is a success.
  assert.equal(result, "z");
  completed();
})


//// Allowing three simulatenous task processors and a total of six processes, simulate a temporary failing io effort.
var seeit = false;
var dc5 = daisychain(
  [
    // this function just passes the memo through, but we can take a peek if we want. (seeit=true)
    function(memo, cb) {
      process.nextTick(function(){
        setTimeout(function(){
          seeit && console.log("HELLO:", memo);
          cb(null, memo);
        }, 10);
      });
    }
    // this function fails 12 times then succeeds.
    ,function(memo, cb) {
      this.count = (this.count || 0) +1; 
      if (this.count > 12) {
        seeit && console.log("SUCCESS["+this.count+"]:", memo);
        cb(null, [memo, this.count]);
      } else {
        var delay = this.count + 10; // non-deterministic; 1-10ms random delay use: parseInt(Math.random()*10)+1;
        seeit && console.log("DOWN["+this.count+"]:", memo);
        // pretend server is down after a brief delay of trying to connect.
        process.nextTick(function() {
          setTimeout(function(){
            cb(new Error("server down"));
          }, delay);
        });
      }
    }
  ], 3);
dc5.push(["X", "Y", "Z", "P", "D", "Q", "Jane", "John"], function dc5_cb(err, result, queue_id) {
  if (err) {
    assert.equal(queue_id, 1);
    dc5.retry(queue_id, result, dc5_cb);
    return;
  }
  completed();
})

