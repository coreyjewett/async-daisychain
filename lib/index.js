var async = require('async');

/** Create a queue for each worker. Pass successful output of each queue to the next worker.
 * A worker may only pass error or one object to the callback.
 * @param callback(err, task);
 */
function DaisyChain(workers, concurrency) {
  var self = this
      , queues = this.queues = new Array(workers.length);

  var first = this.first = queues[0] = async.queue(workers[0], concurrency);
  first.__daisy_id = 0;
  var next = first;

  // create queues and inject unidirectional linked list marker.
  for (var i = 1; i < workers.length; i++) {
    var queue = this.queues[i] = async.queue(workers[1], concurrency);
    queue.__daisy_id = i;
    next.__forward_to = queue;
    next = queue;
  }

  // add hooks for empty and drain
  var last = this.last = next;
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
DaisyChain.prototype.push = function(input, callback) {
  var self = this;

  // wrap single task as array for eash processing.
  if (!Array.prototype.isPrototypeOf(input)) {
    input = [input];
  }

  input.forEach(function(task) {
    var next = self.first;

    function forward(err, task) {
      if (err) return callback(err);
      
      if (!next) return callback(null, task);

      var queue = next;
      // async.nextTick(function() {
        queue.push(task, forward);
      // });
      next = next.__forward_to;
    }

    forward(null, task);
  });
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
