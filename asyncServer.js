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

var MAX_SIMS = 10;

function simulate(startFen, collection, numSims, callback) {

  console.log("\n---Simulating...");
  async.times(numSims, function(simNum, callback2) {
    var game = new chessjs.Chess(startFen);
    var winner = 'draws';
    var material = startFen.split(" ")[0].match(/[a-z]/gi).length;
    var moves = 0;
    while (!game.game_over() && material > 6){
      var possibleMoves = game.moves();
      //play random move
      var randInt = crypto.randomBytes(1).readUInt8(0);
      var randomMoveIdx = Math.floor(randInt/256 * possibleMoves.length);
      var moveToPlay = possibleMoves[randomMoveIdx];
      //console.log("SIM: ", simNum, ", randNum = ", randInt, ", randomMoveIdx = ", randomMoveIdx, ", move = ", moveToPlay);
      var move = game.move(moveToPlay);
      if(move.captured) material -= 1;
      moves += 1;
    }
    console.log("Random simulation took ", moves, " moves...");

    if (game.in_checkmate()) {
        console.log("ended in checkmate!");
        var loser = game.turn();
        //if white lost, then black won.
        //otherwise, white won
        loser == 'white' ? winner = 'black' : winner = 'white';
        callback2(null, winner);
    } else {
      console.log("game not in checkmate!");
      console.log("Looking for record in local database");
      collection.find({"fen": game.fen()}).toArray(function (err, result) {
        if (err) console.log("Error!: ", err);
        else {
          if (result.length) {
            console.log("Endgame found in database...");
            console.log("The winner is... ", result[0].outcome);
            callback2(err, result[0].outcome);
          } else {
            console.log("Endgame not found in database...");
            console.log("Querying online tablebase...");
            tools.queryEndGame(game.fen(), function(error, gameResult) {
              console.log("The best move is... ", gameResult);
              console.log("Inserting endgame record into local database...");
              collection.insert(gameResult, function(err, report) {
                if (err) console.log("Error inserting new record into database: ", err);
                else console.log(report);
                callback2(err, gameResult.outcome);
              });
            });
          }
        }
      });
    }
  }, function(err, results) {
      var simStats = {'fen': startFen, 'white': 0, 'draws': 0, 'black': 0};
      async.each(results, function(result, callback3) {
        simStats[result] += 1;
        callback3(null);
      }, function(err) {
        callback(null, simStats);
      });
  });
};

function formProbabilities(moveStats, turn) {

  var totGames = 0;
  var g = [];
  for(var i=0, len=moveStats.length; i < len; i++) {
    s = moveStats[i];
    g.push(s.white + s.draws + s.black);
    totGames += g[i];
  }

  var totScaledWins = 0;
  p = [];
  for(var i=0, len=g.length; i < len; i++) {
    s = moveStats[i];
    if(turn === 'w') {
      var wins = s.white;
    } else {
      var wins = s.black;
    }
    var scaledWins = (g[i]/totGames)*(2*wins + s.draws);
    p.push( scaledWins );
    totScaledWins += scaledWins;
  }

  for(var i=0, len=p.length; i < len; i++) {
    p[i] /= totScaledWins;
  }

  console.log("Probabilities = ", p);

  return p;
}

function chooseMoveCompetition(moveStats, probabilities) {

  console.log("In chooseMoveComptetition");
  console.log("probabilities = ", probabilities);
  console.log("moveStats = ", moveStats);
  if (probabilities.length === 0) {
    return -1;
  }

  var max = probabilities[0];
  var maxIndex = 0;

  for (var i = 1; i < probabilities.length; i++) {
    if (probabilities[i] > max) {
      maxIndex = i;
      max = probabilities[i];
    }
  }

  console.log("maxIndex = ", maxIndex);
  console.log("max = ", max);
  console.log("moveStats.length = ", moveStats.length);
  return moveStats[maxIndex].fen;

}

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
                          simulate(fenToSim, collection, numSims, callback2);
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
                            var probabilities = formProbabilities(allMoveStats, turn);
                            var move = chooseMoveCompetition(allMoveStats, probabilities);
                            console.log("The best move is... ", move);
                            res.send(JSON.stringify(move));
                        });
                      } else {
                          var turn = history[history.length-1].split(" ")[1];
                          var probabilities = formProbabilities(allMoveStats, turn);
                          var move = chooseMoveCompetition(allMoveStats, probabilities);
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

var port = 8888;
var server = app.listen(port, function () {
  var host = 'localhost'
  console.log('query server listening at http://%s:%s', host, port);
});
server.timeout = 1200000000;
