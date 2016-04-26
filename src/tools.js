var request = require('request'),
    qs = require('qs'),
    async = require('async'),
    crypto = require('crypto'),
    chessjs = require('../js/chess.min.js');

var exports = module.exports = {};

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
            queryEndGame(game.fen(), function(error, gameResult) {
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

exports.simulate = simulate;

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

exports.formProbabilities = formProbabilities;

function chooseMoveCompetition(moveStats, probabilities) {

  console.log("In chooseMoveComptetition");
  console.log("probabilities = ", probabilities);
  if (probabilities.length === 0) {
    console.log("No available moves!");
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
  console.log("Number of moves choosing from = ", moveStats.length);
  return moveStats[maxIndex].fen;

}

exports.chooseMoveCompetition = chooseMoveCompetition;

function chooseMoveTraining(moveStats, probabilities) {

  console.log("In chooseMoveTraining");
  console.log("probabilities = ", probabilities);
  var numMoves =  probabilities.length;
  console.log("Number of moves choosing from = ", numMoves);
  if (numMoves === 0) {
    console.log("No available moves!");
    return -1;
  }

  var max = 0;
  for(var i=0; i<numMoves; i++) {
    if (probabilities[i] > max) max = probabilities[i];
  }
    
  console.log("Maximum Probability = ", max);

  var moveIndex = 0;
  while( !moveIndex ) {
    var randIndex = Math.floor(crypto.randomBytes(1).readUInt8(0)/256 * numMoves);
    var randProb = crypto.randomBytes(1).readUInt8(0)/255; 
    console.log("randIndex = ", randIndex, ", randProb = ", randProb, ", prob[randIndex] = ", probabilities[randIndex]);
    if( probabilities[randIndex] >= randProb ) {
      moveIndex = randIndex;
    }
  }
  console.log("Sampled move = ", moveStats[moveIndex].fen);

  return moveStats[moveIndex].fen;
}

exports.chooseMoveTraining = chooseMoveTraining;

function pgnToFen(pgn, callback){

  var game = new chessjs.Chess();
  var history_fens;
  if (pgn == 0) { // Opening, hard code the fen for now
    history_fens = ["rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"]
  } else {
    var history = pgn.split(" ").filter(function(s, i){
      return !(i % 3 == 0)
    });

    history_fens = history.map(function(move){
      game.move(move);
      return game.fen();
    });
  }

  //get FENs for all possible_moves
  var possible_fens = game.moves().map(function(move) {
    game.move(move);
    var fen = game.fen();
    game.undo();
    return fen;
  });

	callback(history_fens, possible_fens);
}

exports.pgnToFen = pgnToFen;

function queryEndGame(fen, callback) {
  var url = "https://syzygy-tables.info/api/v2";
  var params = {fen:fen}; 
  var query = url+"?"+qs.stringify(params); // form the query
  var game = new chessjs.Chess(fen);
  var turn = game.turn();
  var map = {'w': 'white', 'd': 'draws', 'b': 'black'};

  request.get(query,
    function (error, response, body) {
      console.log("error = ", error);
      console.log("response = ", response);
      console.log("body = ", body);
      var json = JSON.parse(body);
      if(error) {
        console.log("Error: ", error);
      }
      var outcome;
      if ( json.wdl > 0 ) {
        outcome = map[turn];  
      } else if ( json.wdl < 0 ) {
        turn == 'white' ? outcome = 'black' : outcome = 'white';
      } else {
        outcome = "draws";
      } 
      if (json.bestmove === null) {
        console.log("Checkmate! No best move...");
        var result = {
          "fen": fen,
          "bestmove": null,
          "outcome": outcome
        };
        callback(error, result);
      } else {
        var bestmove = json.moves[json.bestmove].san;
        game.move(bestmove);
        var bestMoveFEN = game.fen();
        var result = {
            "fen": fen,
            "bestmove": bestMoveFEN,
            "outcome": outcome
        };
        callback(error, result);
      }
  });
};

exports.queryEndGame = queryEndGame;

function getStats(fen, callback) {

    var game = new chessjs.Chess(fen);
    var masterURL = "http://expl.lichess.org/master"; // database of master games
    var masterParams = {fen:fen, moves:100}; // only want stats of this board position, no moves
    var masterQuery = masterURL+"?"+qs.stringify(masterParams); // form the query

    var liURL = "http://expl.lichess.org/lichess"; // much larger database of games
    var liParams = {fen:fen, moves:100, variant:"standard",  // params chosen to access
                    speeds:["classical","blitz","bullet"], // all games in the database
                    ratings:[1600,1800,2000,2200,2500]};
    var liQuery = liURL+"?"+qs.stringify(liParams); // form the query

    var queries = [masterQuery, liQuery];

    // Make all queries simultaneously. Each is performed via the httpQuery
    // routine. Then, once both queries are finished combine their stats into
    // one object and return it to the caller.
    async.map(queries, httpRequest, function(err, json) {
        var result = {};
        var moves0 = json[0].moves;
        for( var i=0, len=moves0.length; i<len; i++) {
          game.move(moves0[i].san);
          var newFen = game.fen();
          result[newFen] = {fen: newFen,
                            white: moves0[i].white,
                            draws: moves0[i].draws,
                            black: moves0[i].black}
          game.undo()
        }
        //console.log("result after moves0", result);
        var moves1 = json[1].moves;
        for( var i=0, len=moves1.length; i<len; i++) {
          game.move(moves1[i].san);
          var newFen = game.fen();
          if (result.hasOwnProperty(newFen)) {
            result[newFen].white += moves1[i].white;
            result[newFen].draws += moves1[i].draws;
            result[newFen].black += moves1[i].black;
          } else {
            result[newFen] = {fen: newFen,
                              white: moves1[i].white,
                              draws: moves1[i].draws,
                              black: moves1[i].black};
          }
          game.undo();
        }
        //console.log("result after moves1", result);
        callback(result);
    });
};

function httpRequest(query, cb) {
  request.get(query, function (error, response, body) {
    var json = JSON.parse(body);
    cb(error, json);
  });
}

exports.getStats = getStats;

//----------------------------------------------------------------------------------------------

if(require.main === module) {
  //var fen = "4k3/r7/8/8/8/7B/5K2/2R1B3 w - - 0 1";
  //var fen = "r1bqkb1r/3pnppp/p1n1p3/1Np5/B2PP3/5N2/PPP2PPP/R1BQK2R%20b%20KQkq%20-%200%207";
  var fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  getStats(fen, function(stats) {
    console.log(stats);
  });
  //queryEndGame(fen, function(error, stats) {
   //   console.log("EndGame for fen: ", fen);
    //  console.log(stats);
  //});

  //var pgn1 = "1. e4 g5 2. Qg4 e5 3. Bb5 Bd6 4. d4 h5 5. Qxg5 Ba3 6. Qxg8+ Rxg8 7. Nxa3 Rxg2 8. Bg5 Qf6 9. Bxf6 a6 10. dxe5 Nc6 11. Bxc6 Rg7 12. Bxg7 bxc6 13. O-O-O a5 14. e6 c5 15. exd7+ Bxd7 16. Nf3 f6 17. Bxf6 Rc8 18. Ne5 Bc6 19. Nxc6 Rd8 20. Rxd8+ Kf7 21. e5 a4 22. Rg1 Ke6 23. Nc4 Kf7 24. Bh8 a3 25. e6+ Kxe6 26. Re1+ Kf7 27. N4e5+ Ke6 28. Ng4+ Kf7 29. Re7+ Kg6 30. Nb4 axb2+ 31. Kxb2 h4 32. Na6 c6 33. Rc8 Kg5 34. Re5+ Kxg4 35. Re4+ Kg5 36. Rxc6 c4"
  //pgnToFen(pgn1, function(history, possible_moves) {
    //console.log("history = ", history);
    //console.log("possible_moves = ", possible_moves);
  //});
}
