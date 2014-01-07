var EventEmitter = require('events').EventEmitter;
var Switch       = require('./switch.js').Switch;
var logger       = require('./log.js').logger;
var net          = require('net');
var async        = require('async');

/*
 * Runtime system of JOX.
 *
 * Sets up the application and uses callbacks 
 * to notify application about ongoing events.
 */
var Runtime = function(){

  var self     = this;
  var switches = [];
  var server   = null;
  var swid     = 0;
  var queue    = null;

  this.run = function(app){
    server = net.createServer(self.new_connection);
    server.listen(6633, function(){
      logger.info("Initiating JOX runtime system.");
    });

    queue = async.queue(function(task,callback){
      app(task);
      callback();
    }, 1);
  }

  this.new_switch = function(sw){
    switches.push(sw);
    sw.id(swid++);
    return self;
  }

  this.new_connection = function(c){
    self.new_switch(new Switch(self,c));
    return self;
  }

  this.delete_switch = function(sw){
    switches = switches.reduce(function(pv,cv){if(cv != sw){pv.push(cv);} return pv;},[]);
    return self;
  }

  this.push  = function(sw,message) {
    queue.push({switch: sw, message: message});
  }


  return this;
}

Runtime.prototype.__proto__ = EventEmitter.prototype;


exports.Runtime = new Runtime()
