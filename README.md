# JSib
Javascript (anonymous) imageboard engine. Well, mostly Javacript. Has a couple of PHP server-side functions ATM.
Shoulda work extremly fast even on a poor man's LAMP shared-hostings. And even on static hostings in R-O mode (that is, should also work from Cloudflare/Google cache/local copy too).

## Main ideas

1. Move as much logic as possible to the client side.
2. Try to avoid data reading in server-side logic. Otherwise we'll need to implement some blocking and queueing mechanisms. And that doesn't work nice on plain FS access.
3. Reduce overall codebase as much as possible. Less code => less bugs.
4. Any data client had ever received should be reused.
5. All the data-write operations should be atomic and as short as possible. Thus ready for asynchronous execution.
6. Use HTTTP build-in features. There are a lot of them available for free.

The idea behind this project comes from knowing the following facts:

1. Most (99%) of the site load consists of client requests for server's data
2. The data being requested gets changed only on some very specific actions like user posting that are much more rare and are easily separable from read requests.
3. Most of server load in traditional web applications comes from processing client requests for data with serializing the needed data and wrapping it into HTML, JSON or other markup.
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
You may try out some of the functionality on the test stage [here](http://jsib.ml/jsib_v2/thread.html#b/1)

## Features to consider in further development

As our data files never get changed and only appended, we can use 'Range' headers to get updates. Not even 'modified since' needed.

As we are trying to avoid server-side data reads, that's why we don't have data-file paging now. Data-file paging would require us to use thread's metadata (at least, its message count) while appending message data and then to update it **before** the next message is appended. So it will break the atomicity of append operation.

Don't use **string** templaters (like [doT.js](http://olado.github.io/doT/index.html)) for user input rendering or you will have to make it clean and safe by yourself. JS DOM content manipulation methods like `.innerHTML` and `.value`, on the other hand, do that that for you for free closing open tags and removing invalid markup.

Though doT.js's idea of creating template-filling functions looks interesting (`var msgGen = templater(msgTemplate); var renderedMsg = msgGen(msgData);`).
