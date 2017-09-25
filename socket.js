const engine = require('engine.io');
const debug=require("debug")("socket:debug");
var finalhandler = require('finalhandler')
const fs=require("fs")

const service = require("./service")
const peer=require("./peer")
const config = require(process.argv[2]||"./config.node")
let socketServer=null;

var serve = require('serve-static')('static/', {'index': ['index.html', 'index.htm']})
if(config.ssl){
  const httpsServer = require('https').createServer({
    key:fs.readFileSync(config.ssl.key),
    cert:fs.readFileSync(config.ssl.cert),
    ca:fs.readFileSync(config.ssl.ca)
  },function onRequest (req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
	  res.setHeader('Access-Control-Request-Method', '*');
	  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
    res.setHeader('Access-Control-Allow-Headers', '*');
    serve(req, res, finalhandler(req, res))
  })

  // Listen
  httpsServer.listen(config.listenPort,()=>{
    console.info("Listening on port "+config.listenPort)
  });
  socketServer = engine.attach(httpsServer);
  
}else{
  const httpServer = require('http').createServer(function onRequest (req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Publickey')
    serve(req, res, finalhandler(req, res))
  })

  // Listen
  httpServer.listen(config.listenPort,()=>{
    console.info("Listening on port "+config.listenPort)
  });
  socketServer = engine.attach(httpServer);
}

socketServer.on('connection', function(socket){
  const aPeer=new peer.ClientPeer(socket)
  service.newConnection(aPeer)
  socket.on('message', function(data){
    aPeer.callReceived(data)
    debug("raw message:"+data)
  });
  socket.on('close', function(){
    aPeer.connecting=false;
    debug("disconnected")
  });
  debug("A new connection")
});
