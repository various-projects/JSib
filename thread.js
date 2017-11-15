var defaultTitle;
var currentURI;
var messageTemplate;
var threads = [];
var boards = [];
var partitionSize = 20;//amount of messages in partial data file
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

    go();

    if (!("onhashchange" in window))
        $("#info").innerHTML += "Your browser doesn't support the <code><b><i>hashchange</b></i></code> event. You gonna <b>suffer</b>."
    else
        window.addEventListener("hashchange", go, false);

}

const routing = new function () {
    /**
     * Enum for URI types.
     * @readonly
     * @enum {string}
    */
    const pathType = {
        invalid: "invalid",
        board: "board",
        thread: "thread",
        message: "message"
    }

    const uriParseRegex = /^((\w+)\/?(\/(\d+)|))\/?(\/(\d+)|)\/?$/;

    let currentPath = {};
    let currentURI = "";

    /**
     * Routing. Shows the data corresponding with the current URL hash or given other passed URI.
     * @param {String} uri [Optional] Address to go to, target object URI.
     */
    this.go = async function (uri) {
        if (typeof (uri) === "string") {
            location.hash = uri;
        } else {
            uri = location.hash.replace("#", "");
        }

        if (uri === currentURI) {
            return;
        }
        currentURI = uri;

        let path = parseURIstring(uri);

        if (path.type === pathType.invalid) { //if URI's unparsable — get out.
            alert("Invalid URI");
            return;
        }

        if (path.type === pathType.board)
            loadBoard(path.board);
        else if (path.thread !== currentPath.thread)
            await showThread(path.board, path.thread);

        if (path.type === pathType.message) {
            highlightMessage(path.message);
        }

        currentPath = path;
    }

    /** Completes an incomplete (relative) path by filling missing values with the ones from current path
     * @param {{board:string, thread:string, message:string}} incompletePath incomplete path to complete
     * @returns {{board:string, thread:string, message:string}} Complete (absolute) path to the message
    */
    this.getFullMessagePath = incompletePath => ({
        message: incompletePath.message,
        thread: incompletePath.thread || currentPath.thread,
        board: incompletePath.board || currentPath.board
    })

    /**
     * Parses URI string into 3 components — board, thread and message.
     * @param {string} uriString URI string formatted as "/boardName/threadNumber/messageNumber/"
     * @returns {{board:string, thread:string, message:string, type:uriType}}
     */
    function parseURIstring(uriString) {
        let matches = uriString.match(uriParseRegex);

        if (matches == null)
            return { type: pathType.invalid };

        let path = {
            board: matches[2],
            thread: matches[4],
            message: matches[6]
        };

        path.type = pathType.invalid;

        if (path.board !== undefined) {
            path.type = pathType.board;
        }
        if (path.thread !== undefined) {
            path.type = pathType.thread;
        }
        if (path.message !== undefined) {
            path.type = pathType.message;
        }

        return JSON.parse(JSON.stringify(path));//quickest way to remove `undefined` properties
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

/**
 * An object (static class?) to perform multiple requests in an organized way
 */
const ajaxPool = new function () {
    var poolSize = 5;
    var requestsActive = 0;
    var queue = [];

    /**
     * Checks if there is free capacity in the pool and if there are any jobs in the queue to process.
     * @returns {undefined}
     */
    function checkQueue() {
        while (requestsActive <= poolSize && queue.length) {
            let req = queue.pop();
            let url = req.url;
            let callback = req.callback;
            requestsActive++;
            ajaxGet(url, function (data) {
                callback(data);
                requestsActive--;
                checkQueue();
            });
        }
    }
    /**
     * Adds an HTTP GET request to the request queue
     * @param {URL} url URL to request
     * @param {function} callback Callback function to call after receiving the reply
     * @returns {undefined}
     */
    this.addRequest = function (url, callback) {
        queue.push({ 'url': url, 'callback': callback });
        checkQueue();
    };

    /**
     * This turns out to be unneeded with the use of Promises.
     */
    this.createQueue = function (onComplete) {
    };
};

/**
 * Highlights a message with the given Id: adds the 'selected' CSS class to it and scrolls it into view
 * @param {String} messageId Id of the message to highlight.
 */
function highlightMessage(messageId) {
    contentDiv.getElementsByClassName(".selected")[0].classList.remove("selected");
    var messageDiv = contentDiv.children[messageId];
    messageDiv.classList.add("selected");
    messageDiv.scrollIntoView();
}

/**
 * TODO: UPDATE PARAMS DESCRIPTION Renders a message with the given data into a DOM element and appends it to the given container
 * @param messageData Message data
 * @param {Number} messageData.messageNum In-thread message index
 * @param {String} messageData.title Message title, optional
 * @param {String} messageData.email Message email field, optional
 * @param {String} messageData.pic Picture file filename.
 * @param {String} messageData.date Message submit date-time
 * @param {String} messageData.text Message text
 * @returns {Element} Rendered message DOM element
 */
function renderMessage(messageData, messagePath) {
    var newMessage = messageTemplate.cloneNode(true);

    newMessage.addEventListener("click", function () { highlightMessage(messagePath.message) }, false);

    newMessage.getElementsByClassName("messageNumber")[0].innerHTML = messagePath.message;

    if (messageData.title)
        newMessage.getElementsByClassName("messageTitle")[0].innerHTML = messageData.title;
    
    if (messageData.email)
        newMessage.getElementsByClassName("messageMail")[0].href = "mailto:" + messageData.email;
    
    if (messageData.pic) {
        var pic = newMessage.getElementsByTagName("img")[0];
        pic.src = messageData.thread + "/thumb/" + messageData.pic;
        pic.dataset.altSrc = messageData.thread + "/src/" + messageData.pic;
        pic.addEventListener("click", function (event) {
            event.stopPropagation();
            event.preventDefault();

            var temp = this.src;
            this.src = this.dataset.altSrc;
            this.dataset.altSrc = temp;
        });
        pic.parentNode.onclick = function () { return false; };
        pic.parentNode.href = messageData.thread + "/src/" + messageData.pic;
    }
    if (messageData.date)
        newMessage.getElementsByClassName("messageDate")[0].innerHTML = messageData.date;
    if (messageData.name !== undefined)
        newMessage.getElementsByClassName("messageName")[0].innerHTML = messageData.name;

    newMessage.getElementsByClassName("origThread")[0].href = `#${messagePath.board}/${messagePath.thread}/${messagePath.message}`;

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
        var href = refs[i].href.split("#")[1];
        if (!href.match("/"))
            refs[i].href = "#" + currentURI + "/" + href;
    }
    return newMessage;
}

function showRef(evt) {
    evt.preventDefault();//in case it's an anchor
    evt.stopPropagation();//in case it's nested

    let target = evt.currentTarget;
    var ref = target.dataset.ref.split("/");
    var messagePath = routing.getFullMessagePath({
        message: ref.pop(),
        thread: ref.pop(),
        board: ref.pop()
    });
    
    let threadId = messagePath.board + "/" + messagePath.thread;
    threadData = await DataRepository.getThread(threadId);
    
    if (target.dataset.refShown !== 'true') {
        let message = threadData.messages[messagePath.message];
        target.appendChild(renderMessage(message, messagePath));
        target.dataset.refShown = 'true';
    } else {
        target.removeChild(target.children[0]);
        target.dataset.refShown = 'false';
    }

}
function sendMessage(evt) {
    var threadId = currentURI.match(/\w+\/\d+/)[0];
    evt.preventDefault();
    var form = $("#post-form");
    var formData = new FormData(form);
    formData.append("threadId", currentURI.match(/\w+\/\d+/)[0]);
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            if (xhr.responseText.length > 5) {
                alert(xhr.responseText);
            }
            else {
                form.reset();
            }
            loadThread(threadId, function () { showThread(currentURI) });
            $("#postSendSubmit").blur();
        }
    };
    xhr.open("POST", "post.php", true);
    xhr.send(formData);
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
    var threads = {};

    var boards = {};

    const localStorageKeyPrefixes = {
        board: "board_",
        thread: "thread_"
    }
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
        let dataRequest = await ajaxRequest("GET", threadId, { "Range": `bytes=${size}-` });
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
     */
    this.getThread = threadId => threads[threadId] ? Promise.resolve(threads[threadId]) : await loadThread(threadId);
}

/** Render thread data into view
 * @param {ThreadData} threadData Thread's data
 * @param {string} id thread's id
 */
function renderThread(threadData, id) {
    contentDiv.innerHTML = "";
    threadData.messages.forEach((messageData, index) => {
        let messagePath = routing.getFullMessagePath({ message: index });
        contentDiv.appendChild(renderMessage(messageData, messagePath));
    });

    var OpMessage = threadData[0];
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
 * @param {String} uri Thread ID (aka URI)
 */
async function showThread(board, thread) {
    let threadId = board + "/" + thread;
    let threadData = await DataRepository.getThread(threadId);
    renderThread(threadData, id);
}

function notImplemented() {
    console.log("Non-implemented logic in " + arguments.callee.caller.toString());
}

//@param {{name: string, value: string}} headers additional headers to set

/** Performs async AJAX request
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

//ajaxRequest("GET", "/b",,);

/**
 * Manually load a board index datafile and show the board.
 * @param {URI} boardId Board ID / URI to load
 */
function loadBoard(boardId, ondone) {
    ajaxGet(boardId + "/threads.json?" + Math.random(), function (obj) {
        var board = obj.data;//array of thread IDs
        board.id = boardId;
        boards[boardId] = board;

        var queue = ajaxPool.createQueue(function () {
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
function addReplyRef(event, messageNum) {
    event.preventDefault();
    event.stopPropagation();
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
