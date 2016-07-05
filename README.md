# JSib
Javascript (anonymous) imageboard engine. Well, mostly Javacript. Has a couple of PHP server-side functions ATM.

## Main idea
The idea behind this project comes from knowing the following facts:

1. Most (99%) of the site load consists of client requests for server's data
2. The data being requested gets changed only on some very specific actions like user posting that are much more rare and are easily separable from read requests.
3. Most of server load in traditional web applications comes from processing client requests for data with serializing the needed data and wrapping it into html or other markup.
4. Serving static files produces next to zero load at all on a lightweight server compared to dynamic processing, so the reply data is mostly cached in files (those should cached in RAM by OS filesystem drivers).
5. That's good, but caching replies that are validly formatted HTML or JSON forces you to invalidate the whole cache file for any change.
6. Most of time server-side code of an imageboard does not do anything with database but pushing data in then getting the same data back out.
7. Adding a line to a file in append mode takes next to no time (microseconds).
8. If a file starts with opening square bracket ("[") and the rest of its content is a comma-separated list of valid JSON objects, then you only need to add a closing square bracket to make the whole contents a valid JSON array.
9. So a correctly organized structure of automatically appended files in a public directory works as a JSON API with no need for processing on server side for read requests.

## Current project state
**Version 0.2 pre-alpha.**

Hand created message threads do work:
 you may post into one and read the already poster messages, message formatting, image uploading, message references (including cross-thread ones) and other stuff do work.
Thread list (board) functionality does work too, so does the board index generation code — though that is still up to be uploaded to the test site.

## Test stage
You may try out some of the functionality on the test stage here: jsib.ml/jsib_v2/thread.html#b/1
