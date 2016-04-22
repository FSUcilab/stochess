var fs = require('fs');
a = { name: "Nathan" };
fs.writeFile('output.txt', JSON.stringify(a));
