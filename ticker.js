// Calls a callback every few milliseconds
module.exports = function(callback, tickLength) {
    var previousTick = Date.now();
    var stopped = false;
    
    function loop() {
        if(stopped) {
            return;
        }
        
        var now = Date.now();
    
        if(previousTick + tickLength <= now) {
            var delta = (now - previousTick) / 1000;
            previousTick = now;
            
            callback(delta);
        }
        
        if(Date.now() - previousTick < tickLength - 16) {
            var wait = tickLength - 16 + previousTick - Date.now();
            setTimeout(loop, wait);
        } else {
            setImmediate(loop);
        }
    }
    
    loop();
    
    // Return stop function
    return function() {
        stopped = true;
    };
};