async-daisychain
================

Easily create and manage a chain of async queues. Each queue worker may emit an error or a single memo object to it's callback. just like async#push, an error is handed to the callback given. In the case of a memo, it is forwarded to the next queue. When the last queue finishes the resulting memo is passed to the originating callback.

    var daisychain = require("async-daisychain");
    // see test/test.js for a couple examples

retry
-----

When an error is passed to the callback the second argument is the memo from the last successful worker and the third argument passed to the callback is the queue_id for the failed queue. These arguments, plus a callback, may be passed to #retry to reinvoke the failed queue and remaining queues on the memo. In a sense, this is reminiscent of ruby's *retry* statement and was inspired by it. This is particularly handy where a worker might fail due to intermittent IO issues. In most cases it also would make sense to delay for some interval before retrying, but this is not built in currently.

Argument Against
----------------
Functionally, this is similar to an async *queue* whose worker spawns a *waterfall* for each task. That strategy is actually more flexible as it is not limited to a single memo. On the upside, the added complexity herein provides the retry mechanics and also has opportunity to be improved by having mixed concurrency and also an intellgent backpressure system that has visibility into the whole system, not just it's head.
