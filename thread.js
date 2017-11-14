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
    const uriType = {
        invalid: "invalid",
        board: "board",
        thread: "thread",
        message: "message"
    }

    this.currentURI = {};

    /**
     * Routing. Shows the data corresponding with the current URL hash or given other passed URI.
     * @param {String} uri [Optional] Address to go to, target object URI.
     */
    this.go = function(uri) {
        if (typeof (uri) === "string") { location.hash = uri; }
        else {
            uri = location.hash.replace("#", "");
        }//hash contains the address where we're going, 'currentURI' contains the address we've already reached in the process
        if (uri === currentURI) return;

        var path = parseURIstring(uri);
        if (path.uriType === uriType.invalid) { //if URI's unparsable — get out.
            alert("Invalid URI");
            return;
        }
        if (path.uriType === uriType.board)
            loadBoard(path.board);
        else
            showThread(uri);
    }

    /**
     * Parses URI string into 3 components — board, thread and message.
     * @param {string} uriString URI string formatted as "/boardName/threadNumber/messageNumber/"
     * @returns {board:string,thread:string,message:string,type:uriType}
     */
    function parseURIstring(uriString) {
        var matches = uriString.match(/^((\w+)\/?(\/(\d+)|))\/?(\/(\d+)|)\/?$/);

        if (matches == null)
            return { uriType: uriType.invalid };
        
        var path = { board: matches[2], thread: matches[4], message: matches[6] };
        path.uriType = uriType.invalid;
        if (path.board !== undefined) path.uriType = uriType.board;
        if (path.thread !== undefined) path.uriType = uriType.thread;
        if (path.message !== undefined) path.uriType = uriType.message;
        return JSON.parse(JSON.stringify(path));
    }
}

/**
 * Performs an AJAX GET request
 * @param {String} url URL to get data from
 * @param {Function({url: URL,data: Object})} callback Callback to be called on success
 */
function ajaxGet(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {//unless we've set cache-control headers manually, we get 200 for 304 ('not modified') too.
            console.log(xhr.readyState + " ← state. Status: " + xhr.status);
            var data = xhr.responseText;

            if (data[0] === "[" && data.substr(-1) !== "]")
                data += "]";

            try {
                data = JSON.parse(data);
            } catch (e) { }
            finally {
                callback({ "url": url, "data": data });
            }
        }
    };
    xhr.open('GET', url, true);
    xhr.send();
};

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
     * Creates a custom queue that has its own request counter and performs an action after finishing them all.
     * To use first create a task, then add your requests to it using addRequest() method, then finish it using finish().
     * The onComplete action will be performed as soon as both conditions are met: (1) all the requests are completed and (2) the task is marked as finished.
     * Use it in cases where you need to perform several requests before proceeding.
     * @param {function} onComplete Callback function to call after completing all requests.
     * @returns {addRequest:function(url, callback),}
     */
    this.createQueue = function (onComplete) {
        var counter = 0;
        var initFinished = false;
        return {
            /**
            * Adds an HTTP GET request to the request queue. Same usage as ajaxPool's ajaxPool.addRequest.
            * @param {URL} url URL to request
            * @param {function} callback Callback function to call after receiving the reply
            * @returns {undefined}
            */
            addRequest: function (url, callback) {
                if (initFinished) throw "Trying to add a request to a finished queue";
                counter++;
                queue.push({
                    "url": url,
                    "callback": function (obj) {
                        callback(obj);
                        counter--;
                        if ((counter < 1) && (initFinished))
                            onComplete();
                    }
                });
                checkQueue();
            },
            /**
             * Mark the queue initialization as finished (ready to perform the onComplete action, no more requests to be added)
             */
            finish: function () {
                initFinished = true;
                if (counter < 1)
                    onComplete();
            }
        };
    };
};

/**
 * Highlights a message with the given Id: adds the 'selected' CSS class to it and scrolls it into view
 * @param {String} messageId Id of the message to highlight. If not provided parses the current one from currentURI
 */
function highlightMessage(messageId) {
    var curMessageId = currentURI.match(/^\w+\/\d+(\/(\d+)|)$/)[2];
    messageId = messageId || curMessageId;
    if ((messageId !== curMessageId) && (curMessageId !== undefined)) {
        contentDiv.children[curMessageId].classList.remove("selected");
    }
    currentURI = currentURI.match(/^\w+\/\d+/)[0] + "/" + messageId;
    go(currentURI);
    var selectedDiv = contentDiv.children[messageId];
    selectedDiv.classList.add("selected");
    selectedDiv.scrollIntoView();
}

/**
 * Renders a message with given data into a DOM element and appends it to the given container
 * @param messageData Message data
 * @param {Number} messageData.messageNum In-thread message index
 * @param {String} messageData.title Message title, optional
 * @param {String} messageData.email Message email field, optional
 * @param {String} messageData.pic Picture file filename.
 * @param {String} messageData.date Message submit date-time
 * @param {String} messageData.origThread Original thread's id, used for 'alien' messages shown as cross-thread link previews.
 * @param {String} messageData.text Message text
 * @param {Function} onloadCallback Callback to execute after message image is loaded.
 * @returns {Element} Rendered message DOM element
 */
function renderMessage(messageData, onloadCallback) {
    onloadCallback = onloadCallback || function () { };
    var newMessage = messageTemplate.cloneNode(true);

    newMessage.addEventListener("click", function () { highlightMessage(messageData.messageNum) }, false);

    newMessage.getElementsByClassName("messageNumber")[0].innerHTML = messageData.messageNum;
    if (messageData.title !== undefined)
        newMessage.getElementsByClassName("messageTitle")[0].innerHTML = messageData.title;
    if ((messageData.email !== undefined) && (messageData.email !== ""))
        newMessage.getElementsByClassName("messageMail")[0].href = "mailto:" + messageData.email;
    if (messageData.pic !== undefined) {
        var pic = newMessage.getElementsByTagName("img")[0];
        pic.onload = onloadCallback;
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
    } else onloadCallback();
    if (messageData.date)
        newMessage.getElementsByClassName("messageDate")[0].innerHTML = messageData.date;
    if (messageData.name !== undefined)
        newMessage.getElementsByClassName("messageName")[0].innerHTML = messageData.name;

    if (messageData.origThread !== undefined) {
        newMessage.getElementsByClassName("origThread")[0].href = "#" + messageData.origThread;
        newMessage.getElementsByClassName("origThread")[0].dataset.threadId = messageData.origThread;
    }

    //Reply text - markup and stuff:
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
function goOrigThread(evt) {
    evt.stopPropagation();
    showThread(evt.currentTarget.dataset.threadId);
}

function showRef(evt) {
    var params = currentURI.match(/^((\w+)\/(\d+))(\/\d+|)$/);
    if (!params) { //if URI's unparsable — get out.
        alert("Invalid URI");
        return;
    }
    var board = params[2];
    var thread = params[3];
    evt.preventDefault();//in case it's an anchor
    evt.stopPropagation();//in case it's nested
    var tgt = evt.currentTarget;
    var ref = tgt.dataset.ref.split("/");
    var messageId = ref.pop();
    var threadId = ref.pop() || thread;
    var boardId = ref.pop() || board;
    threadId = boardId + "/" + threadId;
    if (threads[threadId])
        attachRef(tgt, threadId, messageId);
    else
        loadThread(threadId, function () {
            //threads[threadId]=threadData;
            threads[threadId].data[messageId].messageNum = messageId;
            threads[threadId].data[messageId].origThread = threadId;
            attachRef(tgt, threadId, messageId);
            threads[threadId].data[messageId].origThread = "";
        });


    function attachRef(target, threadId, messageId) {
        if (target.dataset.refShown !== 'true') {
            var message = threads[threadId].data[messageId];
            target.appendChild(renderMessage(message));
            target.dataset.refShown = 'true';
        } else {
            target.removeChild(tgt.children[0]);
            target.dataset.refShown = 'false';
        }
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

function renderThread(threadData, uri) {
    var params = uri.match(/^(\w+\/\d+)(\/(\d+)|)$/);
    var threadId = params[1];
    var selectedMessageId = params[3];
    contentDiv.innerHTML = "";
    var addedImagesCount = threadData.length;

    //executed when each added image gets loaded
    function imgOnload() {
        addedImagesCount--;

        if (addedImagesCount === 0)
            highlightMessage(selectedMessageId);
    }

    for (var i in threadData) {
        var messageData = threadData[i];
        messageData.messageNum = i;
        messageData.thread = threadId;
        contentDiv.appendChild(renderMessage(messageData, imgOnload));
    }
    var OpMessage = threadData[0];
    document.title = defaultTitle + ((OpMessage.title !== "") ? OpMessage.title : OpMessage.text.substring(0, 50));

    if (selectedMessageId !== undefined)
        highlightMessage(selectedMessageId);
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
function showThread(uri) {
    var path = uri.match(/^(\w+\/\d+)/)[1];// board+thread, no message
    if (threads[path]) {
        currentURI = uri;
        renderThread(threads[path].data, uri);
    } else
        loadThread(path, function () { showThread(uri) });
}

/**
 * Load chosen thread's data into the global repository (`threads`). Sounds lika damn bad practice. Shoulda refactor that to avoid hidden global object manipulations
 * @param {URI} threadId Thread ID (URI)
 * @param {Function} onDone Callback function to pass the loaded data to.
 */
function loadThread(threadId, onDone) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if ((xhr.readyState === 4) && (xhr.status === 200)) {
            threads[threadId] = { data: JSON.parse(xhr.responseText + "]") };
            onDone();
        }
    };
    xhr.open("GET", threadId + "/posts.json?" + Math.random(), true);
    xhr.send();
}

function notImplemented() {
    console.log("Non-implemented logic in " + arguments.callee.caller.toString());
}

const DataRepository = new function () {
    var boards = {};
    var threads = {};

    const prefixes = {
        board: "board_",
        thread: "thread_"
    }

    const loadThread = threadId => {
        return new Promise();
    }

    this.init = () => {
        let localStorageData = Object.keys(localStorage).map(key => ({ key: key, value: localStorage.getItem(key) }));

        let boardKeyMatch = new RegExp(`^${prefixes.board}(.*)$`);
        localStorageData.filter(item => item.key.test(boardKeyMatch))
            .forEach(item => boards[item.key.match(boardKeyMatch)[1]] = JSON.parse(item.value));
        
        let threadKeyMatch = new RegExp(`^${prefixes.thread}(.*)$`);
        localStorageData.filter(item => item.key.test(threadKeyMatch))
            .forEach(item => threads[item.key.match(threadKeyMatch)[1] = JSON.parse(item.value)]);
    }
    this.getThread = threadId => threads[threadId]?Promise.resolve(threads[threadId]):;
}

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
