var fs = require('fs'),
    chessjs = require("./js/chess.min.js"),
    http = require('http'),
    express = require('express'),
    tools = require('./src/tools.js'),
    url = require('url'),
    mongodb = require('mongodb'),
    async = require('async');
    crypto = require('crypto');
    
var MongoClient = mongodb.MongoClient;
var app = express();

//Play a game with random moves until game_ver
//starting from startFen
//returns the winner of the game

var exports = module.exports = {};

var MAX_SIMS = 1;
app.get('/', function(req, res, next) {
  // enable CORS
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.setHeader('Content-Type', 'application/json');


  // Use connect method to connect to the Server
  var db = MongoClient.connect('mongodb://localhost:27017/stochess', 
    function (err, db) {
    if (err) {
      console.log('Unable to connect to the mongoDB server. Error:', err);
    } else {
      console.log('Connection established to', url);

        if( req.query.fen ) {
          db.collection('endgame_tablebase', {strict:true}, function(err, collection) {
            if (err) { 
              console.log("Error accessing endgame_tablebase collection: ", err); 
            } else {
              collection.find({"fen": req.query.fen}).toArray(function (err, result) {
                  if (err) {
                        console.log("Error!: ", err);
                  } else {
                    console.log("Result.length", result.length);
                    if (result.length) {
                      console.log("Endgame found in database...");
                      console.log("The best move is... ", result[0]);
                      res.send(JSON.stringify(result[0].bestmove));
                      db.close();
                    } else {
                      console.log("Endgame not found in database...");
                      console.log("Querying online tablebase...");
                      tools.queryEndGame(req.query.fen, function(error, result) {
                        res.send(JSON.stringify(result.bestmove));
                        console.log("The best move is... ", result);
                        console.log("Inserting endgame record into local database...");
                            collection.insert(result, function(err, result) {
                              if (err) {
                                console.log("Error inserting new record into database: ", err);
                              } else {
                                console.log(result);
                              }
                              db.close();
                            });
                          });
                        }
                      }
                    }); 
                  }
                });
        } else if (req.query.pgn) {

          var pgn = req.query.pgn;
          console.log("PGN = ", pgn);
          db.collection('fen_stats', {strict:true}, function(err, collection) {
            if (err) { 
              console.log("Database collection not found: ", err); 
            }
            else {
              // See if the fen is in the database
              console.log("Checking database for records");
              tools.pgnToFen(pgn, function(history, possible_moves) {
                console.log("history = ", history);
                console.log("possible_moves = ", possible_moves);
                tools.getStats(history[history.length-1], function(liStats) {
                  var toSim = [];
                  async.map(possible_moves, function(possible_move, callback) {
                    collection.find({"fen": possible_move}).toArray(function (err, result) {
                      if (err) {
                          console.log("Error!: ", err);
                      } else if (result.length) {
                          console.log("Found in database...");
                          console.log("result = ", result[0]);
                          callback(err, result[0]);
                      } else if(liStats.hasOwnProperty(possible_move)) {
                          console.log('Data found at Lichess...');
                          // Eventually this needs to be put below simulate....
                          console.log("Inserting record into local database");
                          collection.insert(liStats[possible_move], function(err, result) {
                            if (err) {
                              console.log("Error inserting new record into database: ", err);
                            } else {
                              console.log(result);
                              callback(err, liStats[possible_move]);
                            }
                          });
                      } else {
                          console.log("No record of this board state exists...");
                          // Then we need to simulate to form the stats. Push to
                          // be simulated in the conclusion function
                          toSim.push(possible_move);
                          callback(err, null);
                      }
                    }); // end collection.find()
                  }, function(err, allMoveStats) {
                      // Remove all nulls from array
                      for (var i = 0; i < allMoveStats.length; i++) {
                        if (allMoveStats[i] == null) {         
                          allMoveStats.splice(i, 1);
                          i--;
                        }
                      }
                      if (toSim.length) {
                        console.log("\nAll Stats have been gathered...\n");
                        async.map(toSim, function(fenToSim, callback2) {
                          console.log("Simulating fen: ", fenToSim, "...");
                          var randInt = crypto.randomBytes(1).readUInt8(0);
                          var numSims = Math.floor(randInt/256 * MAX_SIMS+1);
                          tools.simulate(fenToSim, collection, numSims, callback2);
                          }, function(err, simResults) {
                            console.log("Simulation Results: ", simResults);
                            var simStatsTot = {'white': 0, 'draws': 0, 'black': 0};
                            async.each(simResults, function(simResult, callback3) {
                              simStatsTot.white += simResult.white;
                              simStatsTot.draws += simResult.draws;
                              simStatsTot.black += simResult.black;
                              allMoveStats.push(simResult);
                              collection.insert(simResult, function(err, report) {
                                if (err) console.log("Error inserting into database: ", err);
                                else console.log(report);
                                callback3(err);
                              });
                            }, function(err) {
                              // Perform backprop...
                              async.each(history, function(pastFen, callback4) {
                                collection.find({"fen": pastFen}).toArray(function (err, result) {
                                  if (err) console.log("Error!: ", err);
                                  else if (result.length) {
                                    console.log("BACKPROP: History found...");
                                    var updateDoc = {"fen": pastFen,
                                                  "white": result[0].white+simStatsTot.white,
                                                  "draws": result[0].draws+simStatsTot.draws,
                                                  "black": result[0].black+simStatsTot.black}
                                    collection.update({"fen": pastFen}, updateDoc,
                                      function (err, report) {
                                        callback4(err);
                                      });
                                  } else {
                                      console.log("No history of white games yet...");
                                  }
                                });
                              }, function(err){
                                  db.close();
                              });
                            });
                            var turn = history[history.length-1].split(" ")[1];
                            var probabilities = tools.formProbabilities(allMoveStats, turn);
                            var move = tools.chooseMoveTraining(allMoveStats, probabilities);
                            console.log("The best move is... ", move);
                            res.send(JSON.stringify(move));
                        });
                      } else {
                          var turn = history[history.length-1].split(" ")[1];
                          var probabilities = tools.formProbabilities(allMoveStats, turn);
                          var move = tools.chooseMoveTraining(allMoveStats, probabilities);
                          console.log("The best move is... ", move);
                          res.send(JSON.stringify(move));
                          db.close();
                      }
                  });
                });
              }); 
            }
          }); 
        }
    }
  }); // end MongoClient.connect()
}); // end app.get()

var port = 8889;
var server = app.listen(port, function () {
  var host = 'localhost'
  console.log('query server listening at http://%s:%s', host, port);
});
server.timeout = 1200000000;
