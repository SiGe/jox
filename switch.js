var Parser = require('oflib-node');
var ofpp   = require('oflib-node/lib/ofp-1.0/ofp.js');
var logger = require('./log.js').logger;
var EventEmitter = require('events').EventEmitter;
var VERSION= 0x01;

var Switch = function(runtime, connection){
  var self = this;

  self.runtime    = runtime;
  self.connection = connection;
  self._id        = null;
  self._queue     = [];
  self.packets    = [];
  self._xid       = 1;

  self.id = function(id){
    self._id = id || self._id;
    return self._id;
  }

  /*
   * Process incoming packets
   */
  self.process_packet = function(data){
    var message = (Parser.unpack(data)).message;
    var type    = message.header.type;

    self.callback(type,message);
  }

  connection.on('data', function(data){
    logger.debug("Recv", data);
    self.process_packet(data);
  });

  connection.on('end', function(){
    logger.info("Switch(dpid=" + self.id() + ") is disconnected.");
    self.send = self.send_handshake;
    self.runtime.delete_switch(self);
  });

  self.callback = function(type,message){
    try{
      Switch.callbacks[type].apply(this,[message,message.header.xid]);
    }catch(e){
      logger.debug("Type: " + type, e);
    }
  }

  /*
   * Buffers messages to send until the handshake is complete
   */
  self.send_handshake = function(message,callback){
    if (message.header.type != "OFPT_HELLO"){
      self.packets.push([message,callback]);
    }else{
      var bufsize = ofpp.h_sizes[message.header.type.toLowerCase()];
      var buffer  = new Buffer(bufsize);

      message.header.xid = message.header.xid || self.xid();
      message.version    = VERSION;

      Parser.pack({message: message}, buffer, 0);
      self.send_raw(buffer,callback);
    }
  }

  self.send_handshake_completed = function(message, callback){
    message.header.xid = message.header.xid || self.xid();
    message.version    = VERSION;

    var bufsize = ofpp.h_sizes[message.header.type.toLowerCase()]
    var buffer  = new Buffer(bufsize);
    
    Parser.pack({message: message}, buffer, 0)
    self.send_raw(buffer,callback);
  }
  
  self.send = self.send_handshake;

  /*
   * Called once handshake is completed
   */
  self.handshake_completed = function(){
    self.emit("handshake");
    self.send = self.send_handshake_completed;

    for ( var i = 0; i < self.packets.length; ++i ){
      self.send.apply(self, self.packets[i]);
    }

    self.packets = [];
  }

  self.xid = function(){ return self._xid++; }

  /*
   * Send raw packet to the switch
   */
  self.send_raw = function(buffer,callback){
    logger.debug("Send", buffer);
    self.connection.write(buffer.toString(),"UTF-8", callback);
  }

  /*
   * Flow mod message
   */
  self.flow_mod  = function(message, callback){ self.send(message, callback); }
  self.port_mod  = function(message, callback){ self.send(message, callback); }
  self.packet_out= function(message, callback){ self.send(message, callback); }

  self.stats_request    = function() { self.send({header:{type:"OFPT_STATS_REQUEST"   }}) };
  self.features_request = function() { self.send({header:{type:"OFPT_FEATURES_REQUEST"}}) };
  self.barrier_request  = function() { self.send({header:{type:"OFPT_BARRIER_REQUEST" }}) };

  self.on("handshake", function(){
    self.features_request();
  });
}

/*
 * Register callbacks for different types of messages
 */
Switch.register_callback = function(type, func){
  Switch.callbacks       = Switch.callbacks || {};
  Switch.callbacks[type] = func;
  return Switch
}

/*
 * SyncMessage: Hello
 */
Switch.register_callback('OFPT_HELLO', function(message,xid){
  this.send({
    header: { xid  : xid, type : 'OFPT_HELLO', }
  }, this.handshake_completed);
});

/*
 * SyncMessage: Echo Request
 */
Switch.register_callback('OFPT_ECHO_REQUEST', function(message,xid){
  this.send({
    header: { xid  : xid, type : 'OFPT_ECHO_REPLY', },
    body: message.body
  });
});

/*
 * Save features of the switch
 */
Switch.register_callback('OFPT_FEATURES_REPLY', function(message,xid){
  this.features = message.body;

  // Set the datapath_id of the switch
  this.id(this.features.datapath_id);
  logger.info("Switch(dpid=" + this.id() + ") has connected.");
});

/*
 * Handle the rest of the switch -> controller messages
 */
Switch.register_callback('OFPT_PORT_STATUS', 
    function(message,xid){ logger.warn(message); runtime.push(this,message); });
Switch.register_callback('OFPT_FLOW_REMOVED', 
    function(message,xid){ logger.warn(message); this.runtime.push(this,message); });
Switch.register_callback('OFPT_PACKET_IN', 
    function(message,xid){ logger.warn(message); this.runtime.push(this,message); });
Switch.register_callback('OFPT_GET_CONFIG_REPLY', 
    function(message,xid){ logger.warn(message); this.runtime.push(this,message); });
Switch.register_callback('OFPT_BARRIER_REPLY', 
    function(message,xid){ logger.warn(message); this.runtime.push(this,message); });
Switch.register_callback('OFPT_QUEUE_GET_CONFIG_REPLY', 
    function(message,xid){ logger.warn(message); this.runtime.push(this,message); });
Switch.register_callback('OFPT_VENDOR', 
    function(message,xid){ logger.warn(message); this.runtime.push(this,message); });
Switch.register_callback('OFPT_STATS_REPLY', 
    function(message,xid){ logger.warn(message); this.runtime.push(this,message); });

Switch.prototype.__proto__ = EventEmitter.prototype;

exports.Switch = Switch;
