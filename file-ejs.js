module.exports = function(RED) {
  var ejs = require("ejs");
  var fs = require('fs');
  var path = require("path");
  var mkdirp = require("mkdirp");

  RED.library.register("ejs");

  var ensurePath = function(filename){
    mkdirp.sync(path.dirname(filename))
  }

  var createEmpty = function(filename) {
    fs.writeFile(filename, "<pre>Hello <%= name %>. Today is <%= date %></pre>", function(err) {
      if (err) throw err;
    });
  }

  function FileEjsNode(n) {
    RED.nodes.createNode(this, n);
    this.filename = n.filename || "";
    this.loadedScript = '';
    this.loadedFilename = '';

    var node = this;

    if (this.filename !== '' && typeof(this.filename) != "undefined") {
      node.loadedFilename = this.filename;
      var script = path.join(RED.settings.userDir, this.filename);
      if (this.filename.charAt(0) == "/") script = path.resolve(this.filename);
      ensurePath(script);
      fs.readFile(script, { encoding: 'utf-8' }, function(err, fileContent) {
        if (err) {
          if (err.code === 'ENOENT') {
            createEmpty(script);
          } else {
            node.warn(err);
          }
        } else {
          node.loadedScript = fileContent;
        }
      });
    }

    this.on("input", function(msg) {
      var filename = this.filename;
      if (typeof(msg.file) != "undefined" && msg.file != "") { filename = msg.file; }
      if (typeof(msg.filename) != "undefined" && msg.filename != "") { filename = msg.filename; }
      if (filename === '') {
        node.error('No filename specified');
      } else if (n.reloadfile === false && filename === node.loadedFilename && node.loadedScript !== '') { // Run script from "cache"
        runScript(node, msg, node.loadedScript);
      } else { // Read script from disk and run
        var script = path.join(RED.settings.userDir, this.filename);
        if (this.filename.charAt(0) == "/") script = path.resolve(this.filename);
        ensurePath(script);
        fs.readFile(script, { encoding: 'utf-8' }, function(err, fileContent) {
          if (err) {
            if (err.code === 'ENOENT') {
              createEmpty(script);
            } else {
              node.warn(err);
            }
            msg.error = err;
          } else {
            node.loadedScript = fileContent;
            node.loadedFilename = filename;
            runScript(node, msg, fileContent);
          }
        });
      }
    });
    RED.nodes.registerType("file ejs", FileEjsNode);

    function runScript(node, msg, script) {
      try {
        msg.payload = ejs.render(script, msg)
        node.send(msg);
      } catch (err) {
        node.error(err.message);
      }
    }
  }

  RED.httpAdmin.get('/file-ejs/load', function(req, res) {
    var filename = req.query.filename;
    if (filename) {
      var script = path.join(RED.settings.userDir, filename);
      if (filename.charAt(0) == "/") script = path.resolve(filename);
      ensurePath(script);
      fs.readFile(script, { encoding: 'utf-8' }, function(err, fileContent) {
        if (err) {
          console.log(err);
          res.send("");
        } else {
          res.send(fileContent);
        }
      });
    }
  });
  RED.httpAdmin.get('/file-ejs/write', function(req, res) {
    var filename = req.query.filename;
    var content = req.query.content;
    if (filename) {
      var script = path.join(RED.settings.userDir, filename);
      if (filename.charAt(0) == "/") script = path.resolve(filename);
      ensurePath(script);
      fs.writeFile(script, content, { encoding: 'utf-8' }, function(err, fileContent) {
        if (err) {
          console.log(err);
          res.send(err);
        } else {
          res.send("ok");
        }
      });
    }
  });
}
