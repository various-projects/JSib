# JSib
Javascript (anonymous) imageboard engine. Well, mostly Javacript. Has a couple of PHP server-side functions for ATM.

## Main idea
The idea behind this project comes from knowing the following facts:

1. Most (99%) of the site load consists of client requests for server's data
2. The data being requested gets changed only on some very specific actions like user posting that are much more rare and are easily separable from read requests.
3. Most of server load in traditional web applications comes from processing client requests for data with serializing the needed data and wrapping it into html or other markup.
4. Serving static files produces next to zero load at all on a lightweight server compared to dynamic processing, so the reply data is mostly cached in files.
5. That's good, but caching replies that are validly formatted makes you invalidate the whole cache file for any change.
6. Most of the time all server does with database is push data in then get it back out.
7. Adding a line to a file takes next to no time (microseconds).
8. If a file starts with opening square bracket ("[") and the rest of its content is a comma-separated list of valid JSON objects, then you only need to add a closing square bracket to make the whole contents a valid JSON array.
9. So a correctly organized structure of automatically appendable files in a public directory works as a JSON API but with no need for processing on server side for read requests.

## Current project state
**Version 0.2 pre-alpha.**

Hand created message threads do work:
 you may post into one and read the already poster messages, message formatting, image uploading, message references (including cross-thread ones) and other stuff do work.
Thread list (board) functionality doesn't work — you can't create a thread or see a list of already existing ones.

## Test stage
You may try out some of the functionality on the test stage here: jsib.ml/jsib_v2/thread.html#b/1
