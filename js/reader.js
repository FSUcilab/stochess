var fs = require('fs');
fs.readFile("output.txt", function(err, data) {
    if (err) {
        return console.log(err);
    } 
    return console.log(JSON.parse(data));
});
