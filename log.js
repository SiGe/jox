LOG_LEVEL = 2;

exports.logger = (function(){
  var self = this;
  this.info = function(log){
    if (LOG_LEVEL > 1){
      console.info("Log: " + log);
    }
  }

  this.debug = function(){
    if (LOG_LEVEL > 3){
      args = Array.prototype.slice.call(arguments);
      console.warn("Debug: ",args);
    }
  }

  this.warn = function(){
    if (LOG_LEVEL > 2){
      args = Array.prototype.slice.call(arguments);
      console.warn("Warn: ",args);
    }
  }
  return this;
})();
