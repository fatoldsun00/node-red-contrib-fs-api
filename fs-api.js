/**
 * Copyright 2018 Dean Cording <dean@cording.id.au>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 **/

//const util = require('util');
const fs = require('fs');
const path = require('path');
const { send } = require('process');


module.exports = function(RED) {
    "use strict";


    function setProperty(node, msg, name, type, value) {
        if (type === 'msg') {
            RED.util.setMessageProperty(msg,name,value);
        } else if (type === 'flow') {
            node.context().flow.set(name,value);
        } else if (type === 'global') {
            node.context().global.set(name,value);
        }
    }

    function MoveNode(n) {
        RED.nodes.createNode(this,n);
        var node = this;

        node.name = n.name;
        node.source = n.source || "";
        node.sourceType = n.sourceType || "msg";
        //node.sourceFilename = n.sourceFilename || "";
        //node.sourceFilenameType = n.sourceFilenameType || "str";
        node.destination = n.destination || "";
        node.destinationType = n.destinationType || "msg";
        //node.destFilename = n.destFilename || "";
        //node.destFilenameType = n.destFilenameType || "str";

        node.on("input",async function(msg,send,done) {
            const source = RED.util.evaluateNodeProperty(node.source, node.sourceType, node, msg);
            const destination = RED.util.evaluateNodeProperty(node.destination, node.destinationType, node, msg);
            try {
                node.status({
                    fill: "yellow",
                    shape: "dot",
                    text: `Moving ...`
                });
                fs.renameSync(source, destination);
                node.status({
                    fill: "green",
                    shape: "dot",
                    text: `Moving done`
                });
                send(msg)
                done()
            } catch (err) {
                try {
                    if (err.code === 'EXDEV') {
                        // fs.pipe doesn't seem to handle exceptions properly
                        // Need to check we can access files
                        fs.accessSync(source, fs.R_OK | fs.W_OK);
                        const is = await fs.createReadStream(source);
                        const os = await fs.createWriteStream(destination);
                        is.pipe(os);
                        fs.accessSync(destination, fs.W_OK);

                        is.on('end', function() {
                            try {
                                //delete source file
                                fs.unlinkSync(source);
                                node.status({
                                    fill: "green",
                                    shape: "dot",
                                    text: `Moving done`
                                });
                                send(msg);
                                done()
                            } catch (err) {
                                node.status({
                                    fill: "red",
                                    shape: "dot",
                                    text: `Error ${err.code ? err.code: ''} on moving file`
                                });
                                done(err);
                            }
                        });
                    } else {
                        throw err 
                    }
                } catch (err) {
                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: `Error ${err.code ? err.code: ''} on moving file`
                    });
                    done(err);
                }
            }
        });
    }

    RED.nodes.registerType("fs-api-move", MoveNode);



    function CopyNode(n) {
        RED.nodes.createNode(this,n);
        var node = this;

        node.name = n.name;
        node.source = n.source || "";
        node.sourceType = n.sourceType || "msg";
       
        node.destination = n.destination || "";
        node.destinationType = n.destinationType || "msg";
       
        node.link = n.link;
        node.overwrite = n.overwrite;

        if (node.link === undefined) node.link = false;
        if (node.overwrite === undefined) node.overwrite = false;

        node.on("input", async function(msg,send,done) {

            const source = RED.util.evaluateNodeProperty(node.source, node.sourceType, node, msg);
            const destination = RED.util.evaluateNodeProperty(node.destination, node.destinationType, node, msg);
            try {
                node.status({
                    fill: "yellow",
                    shape: "dot",
                    text: `Copy ...`
                });
                if (node.link) {
                    if (node.overwrite) {
                        try {
                            fs.unlinkSync(destination);
                        } catch (err) {
                            if (err.code === 'EISDIR') {
                                // rmdir instead
                                try {
                                    fs.rmdirSync(destination);
                                } catch (err) {
                                    if (err.code != 'ENOENT') {
                                        // deleting non-existent directory is OK
                                        throw err
                                    }
                                }
                            } else if (err.code != 'ENOENT') {
                                // Deleting a non-existent file is not an error
                                throw err
                            }
                        }
                    }
    
    
                    fs.symlink(source,destination, (err) => {
                        if (err) {
                            throw err
                        } else {
                            send(msg);
                            done();
                        }
                    });
                } else {
                    if (fs.copyFileSync) {
                        // fs.copyFile introduced in Node 8.5.0
                        try {
                            await fs.copyFileSync(source, destination, (node.overwrite ? 0 : fs.constants.COPYFILE_EXCL))
                            send(msg)
                        } catch (err) {
                            throw err
                        }
                        
                    } else {
                        try {
                            //If not overwrite and file exist
                            if (!node.overwrite && fs.accessSync(destination, fs.F_OK)) throw new Error ("File exists")

                            // is.pipe doesn't seem to handle exceptions properly
                            // Need to check we can access files
                            fs.accessSync(source, fs.R_OK);
                            fs.accessSync(destination, fs.W_OK);
    
                            const is = fs.createReadStream(source);
                            const os = fs.createWriteStream(destination);
                            is.on('end', function() {
                                send(msg)
                                done()
                            });
    
                            is.pipe(os);    
                        } catch (err) {
                            throw err
                        }
                    }
                }
                node.status({
                    fill: "green",
                    shape: "dot",
                    text: `Copy done`
                });
            } catch (err) {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: `Error ${err.code ? err.code: ''} on copy file`
                });
                done(err);
            }
        });
    }

    RED.nodes.registerType("fs-api-copy", CopyNode);


    function DeleteNode(n) {
        RED.nodes.createNode(this,n);
        var node = this;

        node.name = n.name;
        node.source = n.source || "";
        node.sourceType = n.sourceType || "msg";

        node.on("input", function(msg,send,done) {

            node.status({
                fill: "yellow",
                shape: "dot",
                text: `Deleting ...`
            });

            const source = RED.util.evaluateNodeProperty(node.source, node.sourceType, node, msg);

            const deleteFile = function(file) {
                try {
                    fs.unlinkSync(file);
                } catch (err) {
                    if (err.code === 'EISDIR') {
                        // rmdir instead
                        try {
                            fs.rmdirSync(file);
                        } catch (err) {
                            if (err.code != 'ENOENT') {
                                // deleting non-existent directory is OK
                                throw err
                            }
                        }
                    } else if (err.code != 'ENOENT') {
                        // Deleting a non-existent file is not an error
                        throw err
                    }
                }
            };

            try {
                if (Array.isArray(source)) {
                    source.forEach(deleteFile);
                } else {
                    deleteFile(source);
                }
                node.status({
                    fill: "green",
                    shape: "dot",
                    text: `Delete done`
                });
                send(msg)
                done()

            } catch (err) {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: `Error ${err.code ? err.code: ''} on delete file`
                });
                done(err);
            }
        });
    }

    RED.nodes.registerType("fs-api-delete", DeleteNode);


    function AccessNode(n) {
        RED.nodes.createNode(this,n);
        var node = this;

        node.name = n.name;
        node.path = n.path || "";
        node.pathType = n.pathType || "str";
        node.filename = n.filename || "";
        node.filenameType = n.filenameType || "str";
        node.read = n.read;
        node.write = n.write;
        node.throwerror = n.throwerror;

        node.on("input", function(msg) {
            var pathname = RED.util.evaluateNodeProperty(node.path, node.pathType, node, msg);
            if ((pathname.length > 0) && (pathname.lastIndexOf(path.sep) != pathname.length-1)) {
                pathname += path.sep;
            }
            pathname += RED.util.evaluateNodeProperty(node.filename, node.filenameType, node, msg);

            var mode = fs.F_OK;
            if (node.read) mode |= fs.R_OK;
            if (node.write) mode |= fs.W_OK;

            try {
                fs.accessSync(pathname, mode);
            } catch (e) {
                if (node.throwerror) node.error("File " + pathname + " is not accessible " + e, msg);
                if (msg.error) msg._error = Object.assign({}, msg.error);
                msg.error = {message: "File " + pathname + " is not accessible " + e};
                msg.error.source = {id: node.id, type: node.type, name: node.name};
                node.send([null, msg]);
                return;
            }

            node.send([msg, null]);

        });
    }

    RED.nodes.registerType("fs-api-access", AccessNode);


    function SizeNode(n) {
        RED.nodes.createNode(this,n);
        var node = this;

        node.name = n.name;
        node.path = n.path || "";
        node.pathType = n.pathType || "str";
        node.filename = n.filename || "";
        node.filenameType = n.filenameType || "msg";
        node.size = n.size || "";
        node.sizeType = n.sizeType || "msg";

        node.on("input", function(msg) {

            var pathname = RED.util.evaluateNodeProperty(node.path, node.pathType, node, msg);

            if ((pathname.length > 0) && (pathname.lastIndexOf(path.sep) != pathname.length-1)) {
                pathname += path.sep;
            }

            var filename = RED.util.evaluateNodeProperty(node.filename, node.filenameType, node, msg);

            var size;

            try {
                if (Array.isArray(filename)) {
                    size = [];
                    filename.forEach(function(file) {
                        size.push(fs.statSync(pathname + file).size);
                    });
                } else {
                    size = fs.statSync(pathname + filename).size;
                }
            } catch (e) {
                node.error(e,msg);
                return;
            }

            setProperty(node, msg, node.size, node.sizeType, size);

            node.send(msg);

        });
    }

    RED.nodes.registerType("fs-api-size", SizeNode);

    function StatsNode(n) {
        RED.nodes.createNode(this,n);
        var node = this;

        node.name = n.name;
        node.path = n.path || "";
        node.pathType = n.pathType || "str";
        node.filename = n.filename || "";
        node.filenameType = n.filenameType || "msg";
        node.stats = n.stats || "";
        node.statsType = n.statsType || "msg";

        node.on("input", function(msg) {

            var pathname = RED.util.evaluateNodeProperty(node.path, node.pathType, node, msg);

            if ((pathname.length > 0) && (pathname.lastIndexOf(path.sep) != pathname.length-1)) {
                pathname += path.sep;
            }

            var filename = RED.util.evaluateNodeProperty(node.filename, node.filenameType, node, msg);

            var stats;

            try {
                if (Array.isArray(filename)) {
                    stats = [];
                    filename.forEach(function(file) {
                        stats.push(fs.statSync(pathname + file));
                    });
                } else {
                    stats = fs.statSync(pathname + filename);
                }
            } catch (e) {
                node.error(e,msg);
                return;
            }

            setProperty(node, msg, node.stats, node.statsType, stats);

            node.send(msg);

        });
    }

    RED.nodes.registerType("fs-api-stats", StatsNode);

    function LinkNode(n) {
        RED.nodes.createNode(this,n);
        var node = this;

        node.name = n.name;
        node.path = n.path || "";
        node.pathType = n.pathType || "str";
        node.filename = n.filename || "";
        node.filenameType = n.filenameType || "msg";
        node.link = n.link || "";
        node.linkType = n.linkType || "msg";

        node.on("input", function(msg) {

            var pathname = RED.util.evaluateNodeProperty(node.path, node.pathType, node, msg);

            if ((pathname.length > 0) && (pathname.lastIndexOf(path.sep) != pathname.length-1)) {
                pathname += path.sep;
            }

            var filename = RED.util.evaluateNodeProperty(node.filename, node.filenameType, node, msg);

            var link;

            if (Array.isArray(filename)) {
                link = [];
                filename.forEach(function(file) {
                    try {
                        link.push(fs.readlinkSync(pathname + file));
                    } catch (e) {
                        if (e.code === 'EINVAL') {
                            link.push('');
                        } else {
                            node.error(e, msg);
                            return;
                        }
                    }
                });
            } else {
                try {
                    link = fs.readlinkSync(pathname + filename);
                } catch (e) {
                    if (e.code === 'EINVAL') {
                        link = '';
                    } else {
                        node.error(e, msg);
                        return;
                    }
                }
            }

            setProperty(node, msg, node.link, node.linkType, link);

            node.send(msg);

        });
    }

    RED.nodes.registerType("fs-api-link", LinkNode);


    function TypeNode(n) {
        RED.nodes.createNode(this,n);
        var node = this;

        node.name = n.name;
        node.path = n.path || "";
        node.pathType = n.pathType || "str";
        node.filename = n.filename || "";
        node.filenameType = n.filenameType || "msg";
        node.filetype = n.filetype || "";
        node.filetypeType = n.filetypeType || "msg";

        function getType(filetype) {
            if (filetype.isFile()) return 'F';
            if (filetype.isDirectory()) return 'D';
            if (filetype.isCharacterDevice()) return 'C';
            if (filetype.isSymbolicLink()) return 'L';
            if (filetype.isBlockDevice()) return 'B';
            return 'S';
        }

        node.on("input", function(msg) {

            var pathname = RED.util.evaluateNodeProperty(node.path, node.pathType, node, msg);

            if ((pathname.length > 0) && (pathname.lastIndexOf(path.sep) != pathname.length-1)) {
                pathname += path.sep;
            }

            var filename = RED.util.evaluateNodeProperty(node.filename, node.filenameType, node, msg);

            var filetype;

            try {
                if (Array.isArray(filename)) {
                    filetype = [];
                    filename.forEach(function(file) {
                        filetype.push(getType(fs.statSync(pathname + file)));
                    });
                } else {
                    filetype = getType(fs.lstatSync(pathname + filename));
                }
            } catch (e) {
                node.error(e, msg);
                return;
            }

            setProperty(node, msg, node.filetype, node.filetypeType, filetype);

            node.send(msg);

        });
    }

    RED.nodes.registerType("fs-api-type", TypeNode);



    function DirNode(n) {
        RED.nodes.createNode(this,n);
        var node = this;

        node.name = n.name;
        node.path = n.path || "";
        node.pathType = n.pathType || "str";
        node.filter = n.filter || "*";
        node.filterType = n.filterType || "msg";
        node.dir = n.dir || "";
        node.dirType = n.dirType || "msg";
        node.completeDir = n.completeDir || false;

        node.on("input", function(msg,send,done) {
            try {
                node.status({
                    fill: "yellow",
                    shape: "dot",
                    text: `Read ...`
                })

                let pathname = RED.util.evaluateNodeProperty(node.path, node.pathType, node, msg);
                if ((pathname.length > 0) && (pathname.lastIndexOf(path.sep) != pathname.length-1)) {
                    pathname += path.sep;
                }

                let filter = RED.util.evaluateNodeProperty(node.filter, node.filterType, node, msg);

                filter = filter.replace('.', '\\.');
                filter = filter.replace('*', '.*');
                filter = new RegExp(filter);

                try {
                    let dir = fs.readdirSync(pathname)

                    if (node.completeDir) dir = dir.map((file)=> pathname + file)
                    
                    dir = dir.filter((file) => filter.test(file))
                    setProperty(node, msg, node.dir, node.dirType, dir)

                    node.status({
                        fill: "green",
                        shape: "dot",
                        text: `Read done`
                    });
    
                    send(msg)
                    done()

                } catch (err) {
                    done(err)
                }
            } catch (err) {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: `Error ${err.code ? err.code: ''} on reading directory`
                });
                done(err)  
            }
        });
    }

    RED.nodes.registerType("fs-api-dir", DirNode);

    function MkdirNode(n) {
        RED.nodes.createNode(this,n);
        var node = this;

        node.name = n.name;
        node.path = n.path || "";
        node.pathType = n.pathType || "str";
        node.dirname = n.dirname || "";
        node.dirnameType = n.dirnameType || "msg";
        node.mode = parseInt(n.mode, 8);
        node.fullpath = n.fullpath || "";
        node.fullpathType = n.fullpathType || "msg";

        node.on("input", function(msg,send,done) {

            node.status({
                fill: "yellow",
                shape: "dot",
                text: `Create directory ...`
            });

            var pathname = RED.util.evaluateNodeProperty(node.path, node.pathType, node, msg);
            if ((pathname.length > 0) && (pathname.lastIndexOf(path.sep) != pathname.length-1)) {
                pathname += path.sep;
            }
            pathname += RED.util.evaluateNodeProperty(node.dirname, node.dirnameType, node, msg);

            try {
                try {
                    fs.mkdirSync(pathname, node.mode)
                } catch (err) {
                    // Creating an existing directory is not an error
                    if (err.code != 'EEXIST') {
                       throw err
                    }
                }

                if (node.fullpath.length > 0) {
                    setProperty(node, msg, node.fullpath, node.fullpathType, pathname);
                }
    
                node.status({
                    fill: "green",
                    shape: "dot",
                    text: `Directory created`
                });

                send(msg);
                done()

            } catch (err) {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: `Error ${err.code ? err.code: ''} on create directory`
                });
                done(err)
            }
        });
    }

    RED.nodes.registerType("fs-api-mkdir", MkdirNode);

    function MktmpdirNode(n) {
        RED.nodes.createNode(this,n);
        var node = this;

        node.name = n.name;
        node.path = n.path || "";
        node.pathType = n.pathType || "str";
        node.prefix = n.prefix || "";
        node.prefixType = n.prefixType || "msg";
        node.fullpath = n.fullpath || "";
        node.fullpathType = n.fullpathType || "msg";


        node.on("input", function(msg) {

            var pathname = RED.util.evaluateNodeProperty(node.path, node.pathType, node, msg);
            if ((pathname.length > 0) && (pathname.lastIndexOf(path.sep) != pathname.length-1)) {
                pathname += path.sep;
            }
            pathname += RED.util.evaluateNodeProperty(node.prefix, node.prefixType, node, msg);

            try {
                if (fs.mkdtempSync) {
                    pathname = fs.mkdtempSync(pathname);

                } else {
                    pathname += Math.random().toString(16).slice(2,8);
                    fs.mkdirSync(pathname);

                }
            } catch (e) {
                node.error(e, msg);
                return;
            }

            setProperty(node, msg, node.fullpath, node.fullpathType, pathname);

            node.send(msg);

        });
    }

    RED.nodes.registerType("fs-api-mktmpdir", MktmpdirNode);

};

