var defaultTitle;
var currentURI;
var messageTemplate;
var threads = [];
var boards = [];
var partitionSize = 20;//number of messages in partial data file
var contentDiv;

function init(){
    contentDiv = $("#content");
    defaultTitle = document.title+" ";
    messageTemplate = $("#messageTemplate");
    $('#post-form').addEventListener("submit",sendMessage,false);
    if(window.localStorage)
        if(localStorage.ownCSS!==undefined)
            setCSS(localStorage.ownCSS);

    go();
    
    if(!("onhashchange" in window))
        $("#info").innerHTML += "Your browser doesn't support the <code><b><i>hashchange</b></i></code> event. You gonna <b>suffer</b>."
    else
        window.addEventListener("hashchange", go, false);

}

/**
 * Enum for URI types.
 * @readonly
 * @enum {number}
 */
var uriType = {
    invalid: -1,
    board: 0,
    thread: 1,
    message: 2    
}
/**
 * Parses URI string into 3 components — board, thread and message.
 * @param {string} uri URI string formatted as "/boardName/threadNumber/messageNumber/"
 * @returns {board:string,thread:string,message:string,type:uriType}
 */
function parseURI(uri){
    var matches = uri.match(/^((\w+)\/?(\/(\d+)|))\/?(\/(\d+)|)\/?$/);
    if(matches == null)
        return { uriType: uriType.invalid };
    var path = {board: matches[2],thread:matches[4],message:matches[6]};
    path.uriType = uriType.invalid;
    if(path.board !== undefined) path.uriType = uriType.board;
    if(path.thread !== undefined) path.uriType = uriType.thread;
    if(path.message !== undefined) path.uriType = uriType.message;
    return JSON.parse(JSON.stringify(path));
}

/**
 * Routing. Shows the data corresponding with the current URL hash or given other passed URI.
 * @param {String} uri [Optional] Address to go to, target object URI.
 */
function go(uri){
    if(typeof(uri) === "string"){ location.hash = uri; }
    else {
        uri = location.hash.replace("#","");
    }//hash contains the address where we're going, 'currentURI' contains the address we've already reached in the process
    if(uri === currentURI) return;
    
    var path = parseURI(uri);
    if(path.uriType === uriType.invalid){ //if URI's unparsable — get out.
        alert("Invalid URI");
        return;
    }
    if(path.uriType === uriType.board)
        loadBoard(path.board);
    else
        showThread(path);
}

/**
 * Performs an AJAX GET request
 * @param {String} url URL to get data from
 * @param {Object} callbackParam Parameter to pass to the callback function along with the request data
 * @param {Function([url: URL,data: Object,param:callbackParam])} callback Callback to be called on success
 */
function ajaxGet(url, callback, callbackParam){
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function(){
           if(xhr.readyState === 4 && xhr.status === 200){//unless we've set cache-control headers manually, we get 200 for 304 ('not modified') too.
               console.log(xhr.readyState + " ← state. Status: "+xhr.status);
               var data = xhr.responseText;
               
                if(data[0] == "[" && data.substr(-1)!=="]")
                   data+="]";
               
               try{
                   data = JSON.parse(data);
               }catch(e){}
               finally{
                   callback({"url":url,"data":data,"param":callbackParam});
               }               
           }
        };
        xhr.open('GET',url,true);
        xhr.send();
};

/**
 * Single-line jQuery, lawl.
 * @param {string} selector CSS selector
 * @returns {Element} First DOM element matching the selector
 */
function $(selector){
    return document.querySelector(selector);
}

var ajaxPool = new function(){
    var poolSize = 5;
    var requestsActive = 0;
    var queue = [];
    
    /**
     * Wraps callback function with the pool-management code
     * @param {Function} callback Callback to wrap
     * @returns {Function} Wrapped callback to pass to Ajax object
     */
    function callbackWrap(callback){
        return function(data){
            callback(data);
            requestsActive--;
            checkQueue();
        };
    }
    /**
     * Checks if there is free capacity in the pool and if there are any jobs in the queue to send.
     * @returns {undefined}
     */
    function checkQueue(){
        while((requestsActive <= poolSize)&&(queue.length > 0)){
            var req = queue.pop();
            var url =  req.url;
            var callback = req.callback;
            var callbackParam = req.callbackParam;
            requestsActive++;
            ajaxGet(url, callbackWrap(callback), callbackParam);
        }
    }
    /**
     * Adds an HTTP GET request to the request queue
     * @param {URL} url URL to request
     * @param {function} callback Callback function to call after receiving the reply
     * @param {object} callbackParam Additional parameterr to pass to the callback function
     * @returns {undefined}
     */
    this.addRequest = function(url, callback, callbackParam){
        queue.push({'url':url,'callbackParam':callbackParam, 'callback':callback});
        checkQueue();
    };

    /**
     * Creates a custom queue that has its own request counter and performs an action after finishing them all.
     * To use first create a task, then add your requests to it using addRequest() method, then finish it using finish().
     * The onComplete action will be performed as soon as both conditions are met: (1) all the requests are completed and (2) the task is marked as finished.
     * Use it in cases where you need to perform several requests before proceeding.
     * @param {function} onComplete Callback function to call after completing all requests.
     * @returns {addRequest:function(url, callback, callbackParam),}
     */
    this.createQueue = function(onComplete){
        var counter = 0;
        var initFinished = false;
        return {
            /**
            * Adds an HTTP GET request to the request queue. Same usage as ajaxPool's ajaxPool.addRequest.
            * @param {URL} url URL to request
            * @param {function} callback Callback function to call after receiving the reply
            * @param {object} callbackParam Additional parameterr to pass to the callback function
            * @returns {undefined}
            */
            addRequest: function(url, callback, callbackParam){
                if(initFinished) throw "Trying to add a request to a finished queue";
                counter++;
                queue.push({
                    "url": url,
                    "callbackParam": callbackParam,
                    "callback": function(obj){
                        callback(obj);
                        counter--;
                        if((counter < 1) && (initFinished))
                            onComplete();
                    }
                });
                checkQueue();
            },
            /**
             * Mark the queue initialization as finished (ready to perform the onComplete action, no more requests to be added)
             */
            finish: function() {
                initFinished = true;
                if(counter < 1)
                    onComplete();
            }
        };
    };
};

function expandPic(evt){
    var temp = this.src;
    this.src = this.dataset.altSrc;
    this.dataset.altSrc = temp;
    evt.stopPropagation();
    evt.preventDefault();
}
/**
 * Highlights a message with the given Id: adds the 'selected' CSS class to it and scrolls it into view
 * @param {String} messageId Id of the message to highlight. If not provided parses the current one from currentURI
 */
function highlightMessage(messageId){
    var curMessageId = currentURI.match(/^\w+\/\d+(\/(\d+)|)$/)[2];
    messageId = messageId || curMessageId;
    if((messageId !== curMessageId)&&(curMessageId!== undefined)){
        contentDiv.children[curMessageId].classList.remove("selected");  
    }
    currentURI = currentURI.match(/^\w+\/\d+/)[0]+"/"+messageId;
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
function renderMessage(messageData, onloadCallback){
    onloadCallback = onloadCallback || function(){};
    var newMessage = messageTemplate.cloneNode(true);
    newMessage.removeAttribute("id");
    
    newMessage.dataset.number = messageData.messageNum;
    newMessage.addEventListener("click",function(){highlightMessage(this.dataset.number)},false);
    
    newMessage.getElementsByClassName("messageNumber")[0].innerHTML=messageData.messageNum;
    if(messageData.title!==undefined)
        newMessage.getElementsByClassName("messageTitle")[0].innerHTML=messageData.title;
    if((messageData.email !== undefined)&&(messageData.email !== ""))
        newMessage.getElementsByClassName("messageMail")[0].href="mailto:"+messageData.email;
    if(messageData.pic !== undefined){
        var pic = newMessage.getElementsByTagName("img")[0];
        pic.onload = onloadCallback;
        pic.src=messageData.thread+"/thumb/"+messageData.pic;
        pic.dataset.altSrc = messageData.thread+"/src/"+messageData.pic;
        pic.addEventListener("click",expandPic,false);
        pic.parentNode.onclick = function(){return false;};
        pic.parentNode.href = messageData.thread+"/src/"+messageData.pic;
    } else onloadCallback();
    if(messageData.date)
        newMessage.getElementsByClassName("messageDate")[0].innerHTML = messageData.date;
    if(messageData.name !== undefined)
        newMessage.getElementsByClassName("messageName")[0].innerHTML = messageData.name;
    
    if(messageData.origThread!==undefined){
        newMessage.getElementsByClassName("origThread")[0].href="#"+messageData.origThread;
        newMessage.getElementsByClassName("origThread")[0].dataset.threadId = messageData.origThread;
    }
    
    //Reply text - markup and stuff:
    if(messageData.text !== undefined){
        var text = messageData.text;
        //URL links:
        text = text.replace(/(https?:\/\/[^\s]+)/g,'<a href="$1" target="_blank">$1</a>');

        //Message references:
        //like >>/b/123/123, >>123/123, >>123
        text = text.replace(/>>((\w+\/|)(\d+\/|)\d+)/g,"<a data-ref='$1' href='#$1' class='msg_ref'>$&</a>");

        //Markup:
        //**bold**
        text = text.replace(/\*\*(.*?)\*\*/g,"<b>$1</b>");
        //*italic*
        text = text.replace(/\*(.*?)\*/g,"<i>$1</i>");
        //__underline__
        text = text.replace(/__(.*?)__/g,"<u>$1</u>");
        //%%spoiler%%
        text = text.replace(/%%(.*?)%%/g,"<span class='spoiler'>$1</span>");
        //[s]strike-through[/s]
        text = text.replace(/\[s\](.*?)\[\/s\]/g,"<s>$1</s>");
        
        //>quote
        text = text.replace(/(^|<br>)(>[^>].*?)($|<br>)/g,"$1<span class='quote'>$2</span>$3");

        newMessage.getElementsByClassName("messageText")[0].innerHTML=text;
    }
    var refs = newMessage.getElementsByClassName("msg_ref");
    for(var i=0; i<refs.length;i++){
        refs[i].addEventListener("click",showRef,false);
        var href=refs[i].href.split("#")[1];
        if(!href.match("/"))
            refs[i].href="#"+currentURI+"/"+href;
    }
    return newMessage;
}
function goOrigThread(evt){
    evt.stopPropagation();
    showThread(evt.currentTarget.dataset.threadId);
}

/**
 * Batch loading messages from server
 * @param {threads:Array(threadId), messages:Array(messageId)} ranges Can have 2 properties: 'threads' - array with IDs of threads and 'messages' - a similar array of specific messages to load from server
 * @param {Function} callback Callback function to be executed when the all the job is done.
 */
function loadMessages(ranges, callback){
    var partsToLoad = [];
    var threads = ranges.threads||[];
    function getMeta(){
        var thread = threads.pop();
        if(thread){
            /*var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function(){
               if(xhr.readyState === 4 && xhr.status === 200){//unless we've set cache-control headers manually, we get 200 for 304 ('not modified') too.
                    threadMeta = JSON.parse(xhr.responseText);
                    threadSize = threadMeta.counter*1;
                    var partsTotal=Math.ceil((threadSize / partitionSize));
                    var partName;
                    var wasAdded = false
                    for(var i=0;i<partsTotal;i++){
                        partName = thread+"/posts_"+i+".json";
                        if(!threads[thread].data[i*partitionSize]) partsToLoad.push(partName);
                        wasAdded = (threads[thread].data[i*partitionSize]==undefined);
                    }
                    //if the last partial file was updated, but not created — add it too
                    if((threads[thread].meta.counter < threadSize) && !wasAdded)
                        partsToLoad.push({"url":partName,"thread":thread});
                    getMeta();
               }
            };
            xhr.open("GET",thread+"/info.json",true);
            xhr.send();*/
            (function(thread){//untying the 'thread' var
                ajaxPool.addRequest(thread+"/info.json", thread, function(dataContainer){
                    var threadMeta = dataContainer.data;
                    //never used:
                    //var url = dataContainer.url;
                    var threadSize = threadMeta.counter*1;
                    var partsTotal = Math.ceil(threadSize / partitionSize);
                    var partName = "";
                    var wasAdded = false;
                    for(var i=0;i<partsTotal;i++){
                        partName = thread+"/posts_"+i+".json";
                        if(!threads[thread].data[i*partitionSize]) partsToLoad.push(partName);
                        wasAdded = (threads[thread].data[i*partitionSize] === undefined);
                    }
                    if(threads[thread] === undefined) threads[thread] = {meta:{counter:0},data:[]};
                    //if the last partial file was updated, though not created — add it too
                    if((threads[thread].meta.counter < threadSize) && !wasAdded)
                        partsToLoad.push({"url":partName,"thread":thread});
                    threads[thread].meta.counter = threadSize;
                    getMeta();
                });
            })(thread)
        }
        else getData();
    }
    function getData(){
        var file = partsToLoad.pop();
        if(file){
            ajaxPool.addRequest(file,function(data){
                
            });
        }
        else callback();
    }
    if(ranges.messages !== undefined){
        var messages = ranges.messages;
        for(message in messages){
            
        }
    }
}
function showRef(evt){
    var params = currentURI.match(/^((\w+)\/(\d+))(\/\d+|)$/);
    if(!params){ //if URI's unparsable — get out.
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
    var threadId = ref.pop()||thread;
    var boardId = ref.pop()||board;
    threadId = boardId +"/" + threadId;
    if(threads[threadId])
        attachRef(tgt,threadId,messageId);
    else
        getThread(threadId,function(){
            //threads[threadId]=threadData;
            threads[threadId][messageId].messageNum = messageId;
            threads[threadId][messageId].origThread = threadId;
            attachRef(tgt,threadId,messageId);
            threads[threadId][messageId].origThread = "";
        });
        
    
    function attachRef(target, threadId, messageId){
        if(target.dataset.refShown !== 'true'){
            var message = threads[threadId][messageId];
            target.appendChild(renderMessage(message));
            target.dataset.refShown = 'true';
        } else {
            target.removeChild(tgt.children[0]);
            target.dataset.refShown = 'false';
        }        
    }
}
function sendMessage(evt){
    var threadId = currentURI.match(/\w+\/\d+/)[0];
    evt.preventDefault();
    var form = $("#post-form");
    var formData = new FormData(form);
    formData.append("threadId",currentURI.match(/\w+\/\d+/)[0]);
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(){
        if(xhr.readyState === 4 && xhr.status === 200){
           if(xhr.responseText.length>5){
               alert(xhr.responseText);
           }
           else{
               form.reset();
           }
           getThread(threadId,showThread,currentURI);
           $("#postSendSubmit").blur();
       }
    };
    xhr.open("POST","post.php",true);
    xhr.send(formData);
}

function renderThread(threadData,uri){
    var params = uri.match(/^(\w+\/\d+)(\/(\d+)|)$/);
    var threadId = params[1];
    var selectedMessageId = params[3];
    contentDiv.innerHTML="";
    var addedImagesCount=threadData.length;
    
    //executed when each added image gets loaded
    function imgOnload(){
        addedImagesCount--;
        if(addedImagesCount === 0) highlightMessage(selectedMessageId);
    }
    
    for(var i in threadData){
        var messageData = threadData[i];
        messageData.messageNum = i;
        messageData.thread = threadId;
        contentDiv.appendChild(renderMessage(messageData,imgOnload));
    }
    var OpMessage = threadData[0];
    document.title = defaultTitle + ((OpMessage.title!=="")?OpMessage.title:OpMessage.text.substring(0,50));
    if(selectedMessageId !== undefined) highlightMessage(selectedMessageId);
}

function renderBoard(boardData){
    contentDiv.innerHTML="";
    for(var threadN = 0; threadN < boardData.length; threadN++){
        if(threadN > 0)
            contentDiv.appendChild(document.createElement("hr"));
        
        var thread = threads[boardData.id + "/" + boardData[threadN]];
        var ln = thread.length;
        var start = ((ln-3)<1)?1:(ln-3);
        var opPost = renderMessage(thread[0])
        opPost.className = "OP-post";
        contentDiv.appendChild(opPost);
        
        for(var i = start; i < ln; i++){
            contentDiv.appendChild(renderMessage(thread[i]));
        }
    }
}

/**
 * Shows a thread with the given ID
 * @param {String} uri Thread ID (aka URI)
 */
function showThread(uri){
    var path = uri.match(/^(\w+\/\d+)/)[1];// board+thread, no message
    if(threads[path]){
        currentURI = uri;
        renderThread(threads[path].data,uri);
    } else
        getThread(path,showThread,uri);
}

/**
 * DEPRECATED Manually load a non-split (single-datafile) thread.
 * @param {URI} threadId Thread ID (URI)
 * @param {Function} callback Callback function to pass the loaded data to.
 * @param {Object} callbackParam Additional data to pass to the callback function.
 */
function getThread(threadId,callback,callbackParam){
    if(callback === undefined)
        callback = showThread;
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(){
        if((xhr.readyState === 4) && (xhr.status === 200)){
            threads[threadId] = {data:JSON.parse("["+xhr.responseText+"]")};
            callback(callbackParam);
        }
    };
    xhr.open("GET", threadId+"/posts.json?"+Math.random(),true);
    xhr.send();
}

function notImplemented(){
    console.log("Not implemented logic in "+arguments.callee.caller.toString());
}


/**
 * Manually load a board index datafile and show the board.
 * @param {URI} boardId Board ID / URI to load
 */
function loadBoard(boardId){    
    ajaxGet(boardId+"/threads.json?"+Math.random(),function(obj){
        var board = obj.data;//array of thread IDs
        board.id = boardId;
        boards[boardId] = board;
        
        var queue = ajaxPool.createQueue(function(){
            renderBoard(board);
        });
        for(var i = 0; i < board.length; i++){
            queue.addRequest(boardId + "/" + board[i] + "/posts.json", function(ret){
                threads[ret.param] = ret.data;
            }, boardId + "/" + board[i]);
        }
        queue.finish();
    });    
}

/**
 * Inserts a reference to the message into the reply form.
 * @param {type} event Event being handled.
 * @param {type} messageNum Message number to be inserted.
 */
function addReplyRef(event,messageNum){
    event.preventDefault();
    event.stopPropagation();
    var textarea = document.querySelector("#post-form textarea");
    textarea.value+=">>"+messageNum+"\n";
    textarea.focus();
}

/**
 * Skin changing function. Sets the document's CSS link to point to the given URL and saves this setting to the Local Storage.
 * @param {URL} url URL of the custom CSS file.
 */
function setCSS(url){
    document.getElementsByTagName("link")[1].href = url;
    localStorage.ownCSS = url;
}

document.addEventListener("DOMContentLoaded",init,false);