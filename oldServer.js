var http = require('http'),
    url = require('url'),
    path = require('path'),
    fs = require('fs');
var mimeTypes = {
    "html": "text/html",
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "png": "image/png",
    "js": "text/javascript",
    "css": "text/css"};
    
http.createServer(function(req, res) {
    var uri = url.parse(req.url).pathname;
    var filename = path.join(process.cwd(), unescape(uri));
    var stats;

    try {
        stats = fs.lstatSync(filename); // throws if path doesn't exist
    } catch (e) {
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.write('404 Not Found\n');
        res.end();
        return;
    }

    if (stats.isDirectory()) filename += '/index.html';

    var mimeType = mimeTypes[path.extname(filename).split(".").reverse()[0]];

    fs.readFile(filename, "binary", function(err, file) {
        if(err) {        
            res.writeHead(500, {"Content-Type": "text/plain"});
            res.write(err + "\n");
            res.end();
            return;
        }

        res.writeHead(200, {'Content-Type': mimeType} );
        res.write(file, "binary");
        res.end();
    });
}).listen(8888);

console.log("Static file server running at\n  => http://localhost:8888/\nCTRL + C to shutdown");



