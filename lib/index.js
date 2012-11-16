var async = require('async');

/** Create a queue for each worker. Pass successful output of each queue to the next worker.
 * A worker may only pass error or one object (memo) to the callback.
 * @param callback(err, memo);
 */
function DaisyChain(workers, concurrency) {
  var self = this
      , queues = this.queues = new Array(workers.length);

  // create queues and inject unidirectional linked list marker.
  var last;
  for (var i = 0; i < workers.length; i++) {
    var queue = queues[i] = async.queue(workers[i], concurrency);
    last = queue;
  }

  // add hooks for empty and drain
  last.empty = function() {
    if (self.empty) {
      async.all(queues, function(q, cb){ cb(q.length() === 0); }, function(yes) { if (yes) self.empty(); });
    }
  }

  last.drain = function() {
    if (self.drain) {
      async.every(queues, function(q, cb){ cb((q.length()+q.running()) === 0); }, function(yes) { if (yes) self.drain(); });
    }
  }
}

/** Start a task(s) down the chain. callback is called once per-task; with either any error or the output of the final worker. */
DaisyChain.prototype.push = function(memos, callback) {
  // wrap single task as array for eash processing.
  if (!Array.prototype.isPrototypeOf(memos)) {
    memos = [memos];
  }

  var self = this;
  memos.forEach(function(memo) {
    (self._makeWalker(0, callback))(null, memo);
  });
}

DaisyChain.prototype.retry = function(i, memo, callback) {
  (this._makeWalker(i, callback))(null, memo);
}

DaisyChain.prototype._makeWalker = function(pos, callback) {
  var i = pos+0
      , self = this
      , next
      , last_memo
      ;

  function walker(err, result) {
    if (err) return callback(err, last_memo, i-1);

    next = self.queues[i++]
    if (!next) return callback(null, result);

    last_memo = result;
    // process.nextTick(function(){
      next.push(result, walker);
    // });
  }

  return walker;
}

/** This is somewhat deceptive as it indicates the total quantity of tasks in all the queues, not just the first. */
DaisyChain.prototype.length = function() {
  var len = 0;
  for (var i = this.queues.length - 1; i >= 0; i--) {
    len += this.queues[i].length();
  };
  return len;
}

// map other parameters to inner-queues as appropriate. Unless the engine lacks support for setters/getters in
// which case these parameters will be assigned, but have no effect on the queues. :/
if (Object.__defineSetter__) {
  DaisyChain.prototype.__defineSetter__("concurrency", function(concurrency) {
    for (var i = this.queues.length - 1; i >= 0; i--) {
      this.queues[i].concurrency = concurrency;
    };
  });

  DaisyChain.prototype.__defineGetter__("concurrency", function() {
    return this.queues[0].concurrency;
  });

  DaisyChain.prototype.__defineSetter__("saturated", function(val) {
    this.queues[0].saturated = val;
  });

  DaisyChain.prototype.__defineGetter__("saturated", function() {
    return this.queues[0].saturated;
  });
}

/**
 * @param workers Array<Function>
 * @param concurrency integer
 */
module.exports = function(workers, concurrency) {
  return new DaisyChain(workers, concurrency)
}
