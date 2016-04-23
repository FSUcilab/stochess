var chessjs = require('../js/chess.min.js');

var pgn1 = "1. e4 g5 2. Qg4 e5 3. Bb5 Bd6 4. d4 h5 5. Qxg5 Ba3 6. Qxg8+ Rxg8 7. Nxa3 Rxg2 8. Bg5 Qf6 9. Bxf6 a6 10. dxe5 Nc6 11. Bxc6 Rg7 12. Bxg7 bxc6 13. O-O-O a5 14. e6 c5 15. exd7+ Bxd7 16. Nf3 f6 17. Bxf6 Rc8 18. Ne5 Bc6 19. Nxc6 Rd8 20. Rxd8+ Kf7 21. e5 a4 22. Rg1 Ke6 23. Nc4 Kf7 24. Bh8 a3 25. e6+ Kxe6 26. Re1+ Kf7 27. N4e5+ Ke6 28. Ng4+ Kf7 29. Re7+ Kg6 30. Nb4 axb2+ 31. Kxb2 h4 32. Na6 c6 33. Rc8 Kg5 34. Re5+ Kxg4 35. Re4+ Kg5 36. Rxc6 c4 37. Rc5+ Kh6 38. Re6+ Kh7 39. Rc7+ Kg8 40. Re8#"

function pgnToFen(pgn, callback){
	var game = new chessjs.Chess();
	var history = pgn.split(" ").filter(function(s, i){
		return !(i % 3 == 0)
	});

	var fens = history.map(function(move){
		game.move(move);
		return game.fen();
	});

	callback(fens);
}

