ShareJS with text-formatted document type (fork)
=======

A fast rich text editor which syncs between browsers in real-time.

This repo is basically ShareJS with an text-formatted type added to it. All credits go to the original authors of this fork: ['rizzoma'](https://github.com/rizzoma/ShareJS). I'm only trying to improve it and will, when I succeed, create a few pull request back to the original fork.

How to run
---------------
You need [node.js](http://nodejs.org/#download) and [npm](http://npmjs.org/) to be installed *(in newer versions npm is included in node.js)*. 

You also need to install [redis](http://redis.io/download) for the database.

Make sure a redis-server instance is running, just type `redis-server` into your terminal. Than open a new terminal to do the to following.

Use the these commands to get the server running:

    # run this in the dir you cloned this repo in:
    
    npm install .       
    
    bin/exampleserver
    
Then go to [http://localhost:8000/hello-rizzoma.html](http://localhost:8000/hello-rizzoma.html).

Developing
---------------

When changing the code you can use `cake webclient` to generate the webclient javascript files for testing.


Features
------------
* Rich text editing (bold, italic, strike-out)
* Undo/redo support
* Adding lists
* Adding links
* Adding images 

Todo
---------------

* Editor has problems with characters with accents (é etc.)
* Editor doesn't like "!" etc.
* Browser compatibility problems
* and a lot more...

Browsers compatible
---------------

The original repo was only compatible with webkit browsers (including mobile). I'm trying to also build Firefox *(works now, but buggy)* and maybe even Internet Explorer support.

Technology (from original fork)
---------------

This branch adds data type for formatted text. Operations on rich text.

Document is of the next form:

    [
        {
            t: "Bold fragment"
            params:
                bold: true
                font-size: 14
        }
        {
            t: "Italic fragment"
            params: {italic: true}
        }
    ]

T is a text field, common text operation are applied on this field.  
Params is a set of key-value pairs, only "insert" and "delete" operations are applied for them.  
All positions are measured from the start of document, not a start of fragment.

__Available operations__

    * text insertion
        p: 9                    # Text will be inserted before this position
        ti: "bold"              # Text to insert
        params:                 # Params of the inserted text
            bold: true
            font-size: 14
    * text deletion
        p: 8                    # Text will be deleted starting with this position
        td: "Fragment"          # Text to delete (needed both to revert and check operation)
        params: {italic: true}  # Params of deleted text (needed both to revert and check operation)
    * param insertion
        p: 5                    # Param will be inserted for text starting with that position
        len: 4                  # Number of symbols that will insert param
        paramsi:                # Added param (one param per operation)
            font: 14
    * param deletion
        p: 5                    # Param will be deleted starting with this position
        len: 4                  # Number of symbols that will delete param
        paramsd:                # Removed param (one param per operation)
            bold: true

Params insertion and params deletion are both params change operations.  
Transformations of text inseration and text deletion are obvious, their behavior
is copied from text ShareJS type.  

Text insertion is not changed when transformed against params change - it does
not insert or remove any params. Thus, simultaneous text insertion and params
insertion can lead to a following situation:

client1 and client2 have doc `[{t: "discssion", params: {}}]`  
client1 inserts u: `{p: 4, t: "u"}`  
client2 inserts bold param: `{p: 0, len: 9, params: {bold: true}}`  

After transformations & application of operations they will both have:  
    
    [
        {
            t: "disc"
            params: {bold: true}
        }
        {
            t: "u"
            params: {}
        }
        {
            t: "ssion"
            params: {bold: true}
        }
    ]
    
Simple idea to transform text insertion against params change does not work in all
possible cases.  
Params change when transformed against text insertion gets split into two operations
if needed.  

Text deletion might be split in up to three operations when tranformed against params
change. Text and positions stay unchanged, only params field gets changed.
Params change when transformed against text deletion might change its pos and length.
Params change isn't transformed against another params change if they operate on
different params. If two operations do same action (set equal value or remove param)
then one of them might be cut down, but the overall effect will remain unchanged.
If operations set param to different values than one of the operations will be cut
down if needed. Server cuts down already applied operation if favour of new. Client
cuts down new operation if favour of applied one.

Check also google group about rich text formatting using OT here: [http://groups.google.com/group/sharejs/browse_thread/thread/f973fd957e34448e](http://groups.google.com/group/sharejs/browse_thread/thread/f973fd957e34448e)