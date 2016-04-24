var fs = require('fs'),
    http = require('http'),
    express = require('express'),
    ql = require('./src/queryLi.js'),
    url = require('url'),
    mongodb = require('mongodb'),
    async = require('async');
    tools = require('./src/pgnToFen.js');
    
var MongoClient = mongodb.MongoClient;
var app = express();

function whoseTurn(fen) {
	var turn = fen.split(" ")[1];
  console.log("\nThe turn is... ", turn);
  return turn;
}

function formProbabilities(moveStats, turn) {

  var totGames = 0;
  var g = [];
  for(var i=0, len=moveStats.length; i < len; i++) {
    s = moveStats[i].stats;
    g.push(s.white + s.draws + s.black);
    totGames += g[i];
  }

  var totScaledWins = 0;
  p = [];
  for(var i=0, len=g.length; i < len; i++) {
    s = moveStats[i].stats;
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

  return p;

}

function chooseMoveCompetition(moveStats, probabilities) {

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

  return moveStats[maxIndex].fen;

}

app.get('/', function(req, res, next) {
  // enable CORS
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.setHeader('Content-Type', 'application/json');

  //var fen = req.query.fen;
  var allMoveStats = [];
  var pgn = req.query.pgn;
  console.log("PGN = ", pgn);
  tools.pgnToFen(pgn, function(history, possible_moves, turn) {

    // Use connect method to connect to the Server
    var db = MongoClient.connect('mongodb://localhost:27017/stochess', 
      function (err, db) {
      if (err) {
        console.log('Unable to connect to the mongoDB server. Error:', err);
      } else {
        console.log('Connection established to', url);

        // Get the documents collection
        db.collection('fen_stats', {strict:true}, function(err, collection) {
          if (err) { 
            console.log("Database collection not found: ", err); 
          }
          else {
            // See if the fen is in the database
            console.log("Checking database for records");
            async.map(possible_moves, function(possible_move, callback) {
              collection.find({"fen": possible_move}).toArray(function (err, result) {
                if (err) {
                      console.log("Error!: ", err);
                } else {
                  console.log("Result.length", result.length);
                  if (result.length) {
                    console.log("Found in database...");
                    allMoveStats.push(result);
                    callback();
                  } else {
                      console.log('No document(s) found with defined "find" criteria!');
                      console.log('Querying Lichess for the data...');
                      console.log("fen = ", possible_move);
                      ql.getStats(possible_move, function(result) {
                        if (result.averageRating != 0) {
                          console.log("Found in Lichess database...");
                          console.log("result = ", result);
                          allMoveStats.push(result);
                          console.log("Inserting record into local database");
                          var data = {"fen": possible_move, "stats": result};
                          collection.insert(data, function(err, result) {
                            if (err) {
                              console.log("Error inserting new record into database: ", err);
                            } else {
                              console.log(result);
                            }
                          });
                          callback();
                        } else {
                          console.log("Lichess has no record of this board state...");
                          // Then we need to simulate to form the stats
                          console.log("Simulating Games...");
                        }
                    }); // end ql.getStat
                  }
                }
              }); // end toArray callback
            }, function(err, result) {db.close();}); // end collection.find
          }
        }); // end db.collection
      }
    }); // end MongoClient.connect

  if (allMoveStats.length === 0) { // this means we have no record of any of the moves
    console.log("No record of any moves! Returning random move (for now...)");
    res.send(possible_moves[Math.floor(Math.random()*possible_moves.length)]); // return random move
  }
  var currentMoveFen = history[history.length-1];
  var turn = whoseTurn(currentMoveFen);
  var probabilities = formProbabilities(allMoveStats, turn);
  var move = chooseMoveCompetition(probabilities, allMoveStats);
  console.log("The best move is... ", move);
  res.send(JSON.stringify(move));
  }); // end pgnToFen
}); // end app.get

var port = 8888;
var server = app.listen(port, function () {
  var host = 'localhost'
  console.log('query server listening at http://%s:%s', host, port);
});
