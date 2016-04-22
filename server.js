var express = require('express'),
    fs = require('fs'),
    path = require('path'),
    app = express(),
    http = require('http'),
    ql = require('./src/queryLi.js'),
    io = require('socket.io');

const FEN_FILES_PATH = "/home/storage/";

String.prototype.replaceAll = function(search, replacement) {
  var target = this;
      return target.replace(new RegExp(search, 'g'), replacement);
};
/*
app.get('/query', function(req, res, next) {
  // enable CORS
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

  var fen = req.query.fen;
  console.log("fen = ", fen);
  console.log("subbed fen = ", fen.replaceAll("/","_"));
  var fen_path = FEN_FILES_PATH+fen.replaceAll("/","_");
  console.log("fen_path = ", fen_path);

  path.exists(fen_path, function(exists) {
    if (exists) {

    fs.readFile(fen_path, function(err, data) {
        if (err) {
            return console.log(err);
        } 
        return console.log(JSON.parse(data));
    });

  else {

    queryLi.getStats(fen, function(stats) {
        console.log("Stats for fen: ", fen);
        console.log(JSON.stringify(stats));
        fs.writeFile(fen.replaceAll("/","_"), JSON.stringify(stats), 
          function(err,data) { if(err) { return console.log(err);}
        });
    });


    ql.getStats(query.fen, function(stats) {
      console.log("Stats for fen: ", query.fen);
      console.log(stats);
      res.send(stats)
    })
    // then write it out
    var fs = require('fs');
    a = { name: "Nathan" };
    fs.writeFile('output.txt', JSON.stringify(a));
})
 */ 

var port = 8888;
var app = express();
console.log("Starting Server...");
var server =  http.createServer(app).listen(port);
//var server = app.listen(port, function () {
  //var host = 'localhost'
  //console.log('Query server listening at http://%s:%s\n', host, port);
  //console.log('Press CTRL+C to exit...');
//});

io = io.listen(server); 
/*initializing the websockets communication , server instance has to be sent as the argument */
 
io.sockets.on("connection",function(socket){
  /*Associating the callback function to be executed when client visits the page and 
    websocket connection is made */
    
    var message_to_client = {
      data:"Connection with the server established"
    }
    socket.send(JSON.stringify(message_to_client)); 
    /*sending data to the client , this triggers a message event at the client side */
  console.log('Socket.io Connection with the client established');
  socket.on("message",function(data){
      /*This event is triggered at the server side when client sends the data using socket.send() method */
      data = JSON.parse(data);

      console.log(data);
      /*Printing the data */
      var ack_to_client = {
      data:"Server Received the message"
    }
    socket.send(JSON.stringify(ack_to_client));
      /*Sending the Acknowledgement back to the client , this will trigger "message" event on the clients side*/
  });
 
});



