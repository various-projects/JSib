var defaultTitle;
var messageTemplate;
var contentDiv;

function init() {
    contentDiv = $("#content");
    defaultTitle = document.title + " ";
    messageTemplate = $("#messageTemplate");
    messageTemplate.removeAttribute("id");
    $('#post-form').addEventListener("submit", sendMessage, false);
    if (window.localStorage)
        if (localStorage.ownCSS !== undefined)
            setCSS(localStorage.ownCSS);

    Routing.go();

    if (!("onhashchange" in window))
        $("#info").innerHTML += "Your browser doesn't support the <code><b><i>hashchange</b></i></code> event. You gonna <b>suffer</b>."
    else
        window.addEventListener("hashchange", Routing.go, false);

}

/** @typedef {string} PathType */
/**Enum for URI types.
 * @readonly
 * @enum {number}
*/
const PathType = {
    invalid: 0,
    board: 1,
    thread: 2,
    message: 3
}

/**@typedef {object} PathData
 * @property {string} board Board slug
 * @property {number} thread thread number/slug (relative to board)
 * @property {number} message message number/slug (relative to thread)
 * @property {string} uri Full URI path to object as string. Appropriate to use as a link to it.
 * @property {PathType} type Path type — what kind of object it is pointing to.
 */

 /** Class representing an object routing path
 * @property {string} board Board slug
 * @property {number} thread thread number/slug (relative to board)
 * @property {number} message message number/slug (relative to thread)
 * @property {PathType} type Path type — what kind of object it is pointing to.
  */
class Path{
    /**
     * @param {PathData} properties
     */
    constructor(properties = {}) {
        this.board = properties.board;
        this.thread = properties.thread;
        this.message = properties.message;
    }
    get uri() {
        let parts = [];
        if (this.board) parts.push(this.board);
        if (this.thread) parts.push(this.thread);
        if (this.message) parts.push(this.message);
        return parts.join("/");
    }

    get threadId(){//not sure if it should belong here or go to Routing…
        return [this.board, this.thread].join("/");
    }

    /** {PathType} Returns the type of object the path is pointing to */
    get type() {
        if (this.message) {
            return PathType.message;
        }
    
        if (this.thread) {
            return PathType.thread;
        }
    
        if (this.board) {
            return PathType.board;
        }
    
        return PathType.invalid;
    }

    /** Completes a cripple path with donor's parts
     * @param {Path} cripple Incomplete path to make complete.
     * @param {Path} donor Parts donor from which the missing parts should be borrowed.
     */
    static makeComplete(cripple, donor) {
        let result = {
            message: cripple.message || donor.message,
            thread: cripple.thread || donor.thread,
            board: cripple.board || donor.board
        }
        result.type = Math.max(cripple.type, donor.type);
        return new Path(result);
    }
}

const Routing = new function () {
    const uriParseRegex = /^((\w+)\/?(\/(\d+)|))\/?(\/(\d+)|)?$/;

    /** The path to the object specified in the address bar
     * @var {Path} currentPath */
    let currentPath = {};

    /** Routing. Shows the view corresponding with the current URL hash or given other passed URI.
     * @param {String} [uri] Address to go to, target object URI.
     */
    this.go = async function (uri) {
        if (typeof (uri) === "string") {
            location.hash = uri;
        } else {
            uri = location.hash.replace("#", "");
        }

        if (uri === currentPath.uri) {
            return;
        }

        currentPath = parseURIstring(uri);

        if (currentPath.type === PathType.invalid) { //if URI's unparsable — get out.
            alert("Invalid URI");
            return;
        }

        if (currentPath.type === PathType.board) {
            loadBoard(currentPath.board);
        }
        else if (currentPath.thread === currentPath.thread) {
            await showThread(currentPath.threadId);
        }

        if (currentPath.type === PathType.message) {
            highlightMessage(currentPath.message);
        }
    }

    /** Returns the current path or completes a given relative path with its parts.
     * @param {Path} incompletePath Incomplete path to make complete
     * @returns {Path|PathData} Complete (absolute) path to the message
    */
    this.getPath = incompletePath =>
        Path.makeComplete(incompletePath, currentPath);
    
    /** Creates a full path from a relative message reference
     * @param {string} stringPath A relative or absolute link to a message. Acceptabe forms are "{message}", "{thread}/{message}","{board}/{thread}/{message}"
     * @param {PathData|Path} completionData A valid path to borrow the missing parst from, defaults to the current path.
     * @returns {Path}
    */
    this.completeMessageReference = (stringPath, completionData) => {
        if (!uriParseRegex.test(stringPath)) {
            return new Path();
        }
        
        let parts = stringPath.split("/");

        return result = this.completePath({
            message: parts.pop(),
            thread: parts.pop(),
            board: parts.pop()
        }, completionData);
    };

    /** Parses URI string into 3 components — board, thread and message.
     * @param {string} uriString URI string formatted as "boardName/threadNumber/messageNumber"
     * @returns {Path}
     */
    function parseURIstring(uriString) {
        let matches = uriString.match(uriParseRegex);

        if (!matches) {
            return new Path();
        }

        return new Path({
            board: matches[2],
            thread: matches[4],
            message: matches[6]
        })
    }
}

/**
 * Single-line jQuery, lawl.
 * @param {string} selector CSS selector
 * @returns {Element} First DOM element matching the selector
 */
function $(selector) {
    return document.querySelector(selector);
}
function $$(selector) {
    return document.querySelectorAll(selector);
}

/** Perform a single async AJAX request
 * @async
 * @param {String} method HTTP method ("GET", "POST" etc)
 * @param {String} url URL to send request to
 * 
 * @param {number[][]} [ranges] HTTP ranges
 * @param {Object} [data] data to send
 * @return {Promise<{{repsonse: string, length: number}}>} Retrieved data and 'Content-Length' header value
 */
function ajaxRequest(method, url, ranges, data) {
    return new Promise((resolve, reject) => {
        let xhr = new XMLHttpRequest();
        xhr.open(method, url);

        if (ranges) {
            let headerValue = "bytes="
                + ranges.map(range => `${range[0]}-${range[1] || ""}`)
                    .join(", ");
            xhr.setRequestHeader("Range", headerValue);
        }

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                if (!ranges || xhr.status === 206) {
                    resolve({ response: xhr.response, length: xhr.getResponseHeader("Content-Length") });
                } else {
                    resolve({ response: "", length: 0 });
                }
            } else {
                reject({
                    status: xhr.status,
                    statusText: xhr.statusText
                });
            }
        };

        xhr.onerror = () => {
            reject({
                status: xhr.status,
                statusText: xhr.statusText
            });
        };
        xhr.send(data);
    });
}


/**
 * A tool for performing multiple async AJAX requests while limiting their concurrency.
 */
const AjaxPool = new function () {
    /** How many requests are allowed to run cuncurrently */
    var cuncurrencyLimit = 5;
    
    /** How many requests are running right now */
    var activeRequestCounter = 0;
    /** Queue of requests yet to be sent */
    var queue = [];

    /**
     * Checks if there is free capacity in the pool and if there are any jobs in the queue to process.
     * @returns {undefined}
     */
    function checkQueue() {
        while (activeRequestCounter <= cuncurrencyLimit && queue.length) {
            let requestData = queue.pop();
            activeRequestCounter++;
            ajaxRequest(...requestData.params).then(
                data => {
                    requestData.resolve(data);
                    activeRequestCounter--;
                    checkQueue();
                },
                data => {
                    requestData.reject(data);
                    activeRequestCounter--;
                    checkQueue();
                }
            );
        }
    }
    /**
     * Adds an HTTP GET request to the request queue, usage same as for ajaxRequest() function.
     */
    this.addRequest = function (...args) {
        return new Promise((resolve, reject) => {
            queue.push({
                resolve: resolve,
                reject: reject,
                params: args
            })
            checkQueue();
        });
    }
};

/**
 * Highlights a message with the given Id: adds the 'selected' CSS class to it and scrolls it into view
 * @param {String} messageId Id of the message to highlight.
 */
function highlightMessage(messageId) {
    let highlightedMessages = contentDiv.getElementsByClassName(".selected");
    if (highlightedMessages.length) {
        highlightedMessages[0].classList.remove("selected");
    }
    var messageDiv = contentDiv.children[messageId];
    messageDiv.classList.add("selected");
    messageDiv.scrollIntoView();
}

/**
 * Renders a message with the given data into a DOM element
 * @param {MessageData} messageData Message data that belongs to the message itself, i.e. what the user has submitted.
 * @param {Path} routeData Routing data for the message specifying its place in board structure.
 * @returns {Element} Rendered message DOM element
 */
function renderMessage(messageData, routeData) {
    var newMessage = messageTemplate.cloneNode(true);

    newMessage.addEventListener("click", function () { highlightMessage(routeData.message) }, false);

    let messageNumber = newMessage.getElementsByClassName("messageNumber")[0];
    messageNumber.innerHTML = routeData.message;
    messageNumber.addEventListener("click", function () { Routing.go(routeData.uri); });

    if (messageData.title)
        newMessage.getElementsByClassName("messageTitle")[0].innerHTML = messageData.title;

    if (messageData.email)
        newMessage.getElementsByClassName("messageMail")[0].href = "mailto:" + messageData.email;

    if (messageData.pic) {
        var pic = newMessage.getElementsByTagName("img")[0];
        pic.src = routeData.thread + "/thumb/" + messageData.pic;
        pic.dataset.altSrc = routeData.thread + "/src/" + messageData.pic;
        pic.addEventListener("click", function (event) {
            event.stopPropagation();
            event.preventDefault();

            var temp = this.src;
            this.src = this.dataset.altSrc;
            this.dataset.altSrc = temp;
        });
        pic.parentNode.onclick = function () { return false; };
        pic.parentNode.href = routeData.thread + "/src/" + messageData.pic;
    }
    if (messageData.date)
        newMessage.getElementsByClassName("messageDate")[0].innerHTML = messageData.date;
    if (messageData.name !== undefined)
        newMessage.getElementsByClassName("messageName")[0].innerHTML = messageData.name;
    
    newMessage.getElementsByClassName("replyLink")[0]
        .addEventListener("click", function () { addReplyRef(routeData.message); });

    //Message text - markup and stuff:
    if (messageData.text !== undefined) {
        var text = messageData.text;
        //URL links:
        text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');

        //Message references:
        //like >>/b/123/123, >>123/123, >>123
        text = text.replace(/>>((\w+\/|)(\d+\/|)\d+)/g, "<a data-ref='$1' href='#$1' class='msg_ref'>$&</a>");

        //Markup:
        //**bold**
        text = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
        //*italic*
        text = text.replace(/\*(.*?)\*/g, "<i>$1</i>");
        //__underline__
        text = text.replace(/__(.*?)__/g, "<u>$1</u>");
        //%%spoiler%%
        text = text.replace(/%%(.*?)%%/g, "<span class='spoiler'>$1</span>");
        //[s]strike-through[/s]
        text = text.replace(/\[s\](.*?)\[\/s\]/g, "<s>$1</s>");

        //>quote
        text = text.replace(/(^|<br>)(>[^>].*?)($|<br>)/g, "$1<span class='quote'>$2</span>$3");

        newMessage.getElementsByClassName("messageText")[0].innerHTML = text;
    }
    var refs = newMessage.getElementsByClassName("msg_ref");
    for (var i = 0; i < refs.length; i++) {
        refs[i].addEventListener("click", showRef, false);
        let href = refs[i].href.split("#")[1];
        let refPath = Routing.completeMessageReference(href, routeData);
        refs[i].href = "#" + refPath.uri;
    }
    return newMessage;
}

async function showRef(evt) {
    evt.preventDefault();//in case it's an anchor
    evt.stopPropagation();//in case it's nested

    let target = evt.currentTarget;
    var ref = target.dataset.ref.split("/");
    var messagePath = Routing.getPath({
        message: ref.pop(),
        thread: ref.pop(),
        board: ref.pop()
    });

    threadData = await DataRepository.getThread(messagePath.threadId);

    if (target.dataset.refShown !== 'true') {
        let message = threadData.messages[messagePath.message];
        target.appendChild(renderMessage(message, messagePath));
        target.dataset.refShown = 'true';
    } else {
        target.removeChild(target.children[0]);
        target.dataset.refShown = 'false';
    }

}

async function sendMessage(evt) {
    evt.preventDefault();
    
    let threadId = Routing.getPath().threadId;
    
    let form = $("#post-form");
    let formData = new FormData(form);

    formData.append("threadId", threadId);

    try {
        await ajaxRequest("POST", "post.php", false , formData);
        form.reset();
        $("#postSendSubmit").blur();
    }
    catch(err){
        alert(err.statusText);
    }
    
    showThread(threadId);
}


/**
 * @typedef {Object} MessageData
 * @property {string} [title] Message title
 * @property {string} [email] Author's email
 * @property {string} [pic] Attached picture's filename (no path, just the file's name)
 * @property {string} [name] Author's name
 * @property {string} [text] Raw message text
 */

const DataRepository = new function () {
    /** All the data related to a thread
     * @typedef {Object} ThreadData
     * @property {number} dataSize The size of the datafile retrieved for the thread on the last successful request.
     * @property {MessageData[]} messages Posts of the thread
     */
    let threads = {};

    let boards = {};

    const localStorageKeyPrefixes = {
        board: "board_",
        thread: "thread_"
    };

    /** Loads the thread with the given ID
     * @param {string} threadId Thread id — a string in the form "{boardName}/{threadNumber}"
     * @returns {Promise<ThreadData>} Thread data
     * @async
     */
    const loadThread = async threadId => {
        let thread = threads[threadId] || {
            dataSize: 0,
            messages: []
        };
        let size = thread.dataSize;
        let dataRequest = await AjaxPool.addRequest("GET", threadId + "/posts.json", [[size]]);
        let length = dataRequest.length;
        if (length) {
            thread.dataSize += length;
            let rawData = dataRequest.response;
            if (rawData[0] === ",") {
                rawData[0] = "[";
            }
            let messages = JSON.parse(rawData += "]");
            thread.messages = thread.messages.concat(messages);
            updateLocalStorageRecord("thread", threadId, thread);
        }

        return threads[threadId] = thread;
    }

    function updateLocalStorageRecord(type, id, data) {
        let key = localStorageKeyPrefixes[type] + id;
        localStorage.setItem(key, JSON.stringify(data));
    }

    this.init = () => {
        let localStorageData = Object.keys(localStorage).map(key => ({ key: key, value: localStorage.getItem(key) }));

        let boardKeyMatch = new RegExp(`^${localStorageKeyPrefixes.board}(.*)$`);
        localStorageData.filter(item => item.key.test(boardKeyMatch))
            .forEach(item => boards[item.key.match(boardKeyMatch)[1]] = JSON.parse(item.value));

        let threadKeyMatch = new RegExp(`^${localStorageKeyPrefixes.thread}(.*)$`);
        localStorageData.filter(item => item.key.test(threadKeyMatch))
            .forEach(item => threads[item.key.match(threadKeyMatch)[1] = JSON.parse(item.value)]);
    }

    /** Get thread data (load if needed)
     * @param {string} threadId Thread's id
     * @return {ThreadData} Thread data
     */
    this.getThread = async threadId => threads[threadId] ? Promise.resolve(threads[threadId]) : await loadThread(threadId);
}

/** Render thread data into view
 * @param {ThreadData} threadData Thread's data
 * @param {string} id thread's id
 */
function renderThread(threadData, id) {
    contentDiv.innerHTML = "";
    threadData.messages.forEach((messageData, index) => {
        let messagePath = Routing.getPath({ message: index });
        contentDiv.appendChild(renderMessage(messageData, messagePath));
    });

    let OpMessage = threadData[0];
    document.title = defaultTitle + (OpMessage.title ? OpMessage.title : OpMessage.text.substring(0, 50));
}

/**
 * Renders a board
 * @param {string[])} boardData - array of thread IDs relative to board. That is, just numbers.
 * @param {string} boardData.id - board's own id.
 */
function renderBoard(boardData) {
    contentDiv.innerHTML = "";
    var isFirst = true;
    boardData.forEach(threadId => {
        if (isFirst) isFirst = false;
        else contentDiv.appendChild(document.createElement("hr"));

        var thread = threads[boardData.id + "/" + boardData[threadId]];
        var opPostRendered = renderMessage(thread[0]);
        opPostRendered.className = "OP-post";
        contentDiv.appendChild(opPostRendered);

        var replies = thread.slice(1);
        var skippedReplies = replies.slice(0, -3);

        var skippedImagesCount = skippedReplies.filter(post => post.pic !== undefined).length;

        var spacer = document.createElement("div");
        spacer.style = "margin:5px;font-size:20px";
        if (skippedReplies.length)
            spacer.innerHTML = "Some messages skipped (" + skippedReplies.length + ").";

        if (skippedImagesCount)
            spacer.innerHTML += " Also some images (" + skippedImagesCount + ").";

        contentDiv.appendChild(spacer);

        //last 3 (or less) replies
        replies.slice(-3).forEach(function (reply) {
            contentDiv.appendChild(renderMessage(reply));
        });
    })
}

/**
 * Shows a thread with the given ID
 * @param {String} threadId Thread ID
 */
async function showThread(threadId) {
    let threadData = await DataRepository.getThread(uri);
    renderThread(threadData, threadId);
}

function notImplemented() {
    console.log("Non-implemented logic in " + arguments.callee.caller.toString());
}

//@param {{name: string, value: string}} headers additional headers to set


/**
 * Manually load a board index datafile and show the board.
 * @param {URI} boardId Board ID / URI to load
 */
function loadBoard(boardId, ondone) {
    ajaxGet(boardId + "/threads.json?" + Math.random(), function (obj) {
        var board = obj.data;//array of thread IDs
        board.id = boardId;
        boards[boardId] = board;

        var queue = AjaxPool.createQueue(function () {
            renderBoard(board);
        });
        for (var i = 0; i < board.length; i++) {
            var threadId = boardId + "/" + board[i];
            queue.addRequest(threadId + "/posts.json", function (response) {
                var threadId = response.param;
                var threadData = response.data;
                threadData.forEach(function (dummy, index) {
                    threadData[index].thread = threadId;
                    threadData[index].messageNum = index;
                });
                threads[response.param] = response.data;
            }, threadId);
        }
        queue.finish();
    });
}

/**
 * Inserts a reference to the message into the reply form.
 * @param {type} event Event being handled.
 * @param {type} messageNum Message number to be inserted.
 */
function addReplyRef(/*event,*/ messageNum) {
    // event.preventDefault();
    // event.stopPropagation();
    var textarea = document.querySelector("#post-form textarea");
    textarea.value += ">>" + messageNum + "\n";
    textarea.focus();
}

/**
 * Skin changing function. Sets the document's CSS link to point to the given URL and saves this setting to the Local Storage.
 * @param {URL} url URL of the custom CSS file.
 */
function setCSS(url) {
    document.getElementsByTagName("link")[1].href = url;
    localStorage.ownCSS = url;
}

document.addEventListener("DOMContentLoaded", init, false);
