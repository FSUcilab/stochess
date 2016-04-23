var fs = require('fs'),
    http = require('http'),
    express = require('express'),
    ql = require('./src/queryLi.js');
    url = require('url');
    mongodb = require('mongodb');
    

var MongoClient = mongodb.MongoClient;
var app = express();

app.get('/', function(req, res, next) {
  // enable CORS
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.setHeader('Content-Type', 'application/json');

  var fen = req.query.fen;
  //var pgn = req.query.pgn;
  //pgnToFen(pgn, function(fens)) {

  // Use connect method to connect to the Server
  var db = MongoClient.connect('mongodb://localhost:27017/stochess', function (err, db) {
    if (err) {
      console.log('Unable to connect to the mongoDB server. Error:', err);
    } else {
      console.log('Connection established to', url);

      // Get the documents collection
      db.collection('fen_stats', {strict:true}, function(err, collection) {
        if (err) { 
          console.log("Error!: ", err); 
        }
        else {
          // See if the fen is in the database
          console.log("Checking database for record of fen: ", fen);
          collection.find({"fen": fen}).toArray(function (err, result) {
            if (err) {
                  console.log("Error!: ", err);
            } else {
              console.log("Result.length", result.length);
              if (result.length) {
                console.log("Found in database...");
                res.send(JSON.stringify(result));
              } else {
                  console.log('No document(s) found with defined "find" criteria!');
                  console.log('Querying Lichess for the data...');
                  ql.getStats(fen, function(stats) {
                    if (fen.averageRating != 0) {
                      console.log("Found in database...");
                      res.send(JSON.stringify(stats));
                    } else {
                      console.log("Lichess has no record of this board state...");
                      // Then we need to simulate to form the stats
                      console.log("Simulating Games...");
                    }
                    console.log("Inserting record into database");
                    var data = {"fen": fen, "stats": stats};
                    collection.insert(data, function(err, result) {
                      if (err) {
                            console.log("Error!: ", err);
                      } else {
                        console.log(result);
                      }
                      //Close connection
                      db.close();
                              
                    });
                });
              }
            }
          });
        }
      });
    }
  });
});

var port = 8888;
var server = app.listen(port, function () {
  var host = 'localhost'
  console.log('query server listening at http://%s:%s', host, port);
});
