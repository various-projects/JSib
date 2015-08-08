var defaultTitle;
var currentURI;
var messageTemplate;
var threads = [];
var boards = [];
function ge(id){
    return document.getElementById(id);
}
function expandPic(evt){
    var pic = evt.currentTarget;
    var temp = pic.src;
    pic.src = pic.dataset.altSrc;
    pic.dataset.altSrc = temp;
    evt.stopPropagation();
    evt.preventDefault();
}
function highlightMessage(messageId){
    var curMessageId = currentURI.match(/^\w+\/\d+(\/(\d+)|)$/)[2];
    messageId = messageId || curMessageId;
    if((messageId !== curMessageId)&&(curMessageId!== undefined)){
        ge("content").children[curMessageId].classList.remove("selected");  
    }
    currentURI = currentURI.match(/^\w+\/\d+/)[0]+"/"+messageId;
    go(currentURI);
    var selectedDiv = ge("content").children[messageId];
    selectedDiv.classList.add("selected");
    selectedDiv.scrollIntoView();
}
function renderMessage(messageData, targetContainer,onloadCallback){
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
    targetContainer.appendChild(newMessage);
    return newMessage;
}
function goOrigThread(evt){
    evt.stopPropagation();
    showThread(evt.currentTarget.dataset.threadId);
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
            renderMessage(message,target);
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
    var form = ge("post-form");
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
           ge("postSendSubmit").blur();
       }
    };
    xhr.open("POST","post.php",true);
    xhr.send(formData);
}

function renderThread(threadData,uri){
    var params = uri.match(/^(\w+\/\d+)(\/(\d+)|)$/);
    var threadId = params[1];
    var selectedMessageId = params[3];
    ge("content").innerHTML="";
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
        renderMessage(messageData,ge("content"),imgOnload);
    }
    var OpMessage = threadData[0];
    document.title = defaultTitle + ((OpMessage.title!=="")?OpMessage.title:OpMessage.text.substring(0,50));
    if(selectedMessageId !== undefined) highlightMessage(selectedMessageId);
}

//show thread of the given id
function showThread(uri){
    var path = uri.match(/^(\w+\/\d+)/)[1];// board+thread, no message
    if(threads[path]){
        currentURI = uri;
        renderThread(threads[path],uri);
    } else
        getThread(path,showThread,uri);
}
function getThread(threadId,callback,callbackParam){
    if(callback === undefined)
        callback = showThread;
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(){
        if(xhr.readyState === 4 && xhr.status === 200){
            threads[threadId] = JSON.parse("["+xhr.responseText+"]");
            callback(callbackParam);
        }
    };
    xhr.open("GET", threadId+"/posts.json?"+Math.random(),true);
    xhr.send();
}
function notImplemented(){
    console.log("Not-implemented logic in"+arguments.callee.caller.toString());
}
function showBoard(boardId){
    if(boardId === currentURI)
        return 0;
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(){
        if(xhr.readyState === 4 && xhr.status === 200){
            boards[boardId] = JSON.parse(xhr.responseText);
            callback(callbackParam);
        }
    };
    xhr.open("GET", boardId+"/threads.json?"+Math.random(),true);
    xhr.send();    
}
function go(uri){
    if(typeof(uri) === "string"){
        location.hash = uri;
    } else {
        uri = location.hash.replace("#","");
    }//hash contains the address where we're going, 'currentURI' contains the address we've already reached in the process
    if(uri === currentURI) return;
    
    var params = uri.match(/^((\w+\/)(\d+))(\/\d+|)$/);
    if(!params){ //if URI's unparsable — get out.
        alert("Invalid URI");
        return;
    }
    var board = params[2];
    var thread = params[3];
    //var message = params[4];
    if(thread===""){            // if no thread ID given
        showBoard(board);       // show the board page
    } else
        showThread(uri);        //else show the trhead
}
function addReplyRef(event,messageNum){
    event.preventDefault();
    event.stopPropagation();
    var textarea = document.querySelector("#post-form textarea");
    textarea.value+=">>"+messageNum+"\n";
    textarea.focus();
}
function setCSS(url){
    document.getElementsByTagName("link")[1].href = url;
    localStorage.ownCSS = url;
}
function init(){
    defaultTitle = document.title+" ";
    messageTemplate = ge("messageTemplate");
    ge('post-form').addEventListener("submit",sendMessage,false);
    if(window.localStorage)
        if(localStorage.ownCSS!==undefined)
            setCSS(localStorage.ownCSS);

    go();
    
    if(!("onhashchange" in window))
        ge("info").innerHTML += "Your browser doesn't support the <code><b><i>haschange</b></i></code> event. You <b>will</b> suffer."
    else
        window.addEventListener("hashchange", go, false);

}
document.addEventListener("DOMContentLoaded",init,false);