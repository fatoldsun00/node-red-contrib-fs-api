# node-red-contrib-fs-api
FORK FROM https://flows.nodered.org/node/node-red-contrib-fs-ops + trigger complete event + catch event + var env inputTyped
A Node Red node for performing file system operations.

This node is a wrapper around many of the functions in Node's file system library, which in turn is a wrapper around the standard POSIX filesystem functions.

The nodes and functions provided are:

  * fs-api-move - Move or rename files and directories
  * fs-api-copy - Copy or link files
  * fs-api-delete - Delete file/s or directory
  * fs-api-access - Test existence and accessibility of a file or directory
  * fs-api-size - Get size of a file or directory in bytes
  * fs-api-stats - Get stats of a file or directory
  * fs-api-link - Determines if a file is a link and returns the file it links to.
  * fs-api-type - Determines the type of a file - regular, directory, character, or special
  * fs-api-dir - Get array of file and directory names in a directory
  * fs-api-mkdir - Make a new directory
  * fs-api-mktmpdir - Make a new directory with a random unique name


Parameters such as path and filename can be sourced from strings, or message, flow, or global property.  Likewise, results can be stored in a message, flow or global property.

fs-api-dir can be used to extract a llist of files using a filter,and then pass that list to other fs-api nodes to perform 
bulk operations.

The general design is that each node will pass the message if the action is successful, otherwise it will throw an exception and drop the message.
