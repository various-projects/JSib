<?php

$scriptExecutionStart = microtime(true);

if(!isset($_POST['threadId']))
    die('No thread ID provided');

$threadPath = $_POST['threadId'];
if(!preg_match('/(\w+)\/(\d+)/', $threadPath,$threadPathSplit)){
    die("Invalid thread");
}
$boardId  = $threadPathSplit[1];
$threadId = $threadPathSplit[2];

define('THUMBNAIL_IMAGE_MAX_WIDTH', 150);
define('THUMBNAIL_IMAGE_MAX_HEIGHT', 150);
require './settings.php';

if(!file_exists($threadPath))
    die('Invalid thread: "'.$threadPath.'"');

$messageData = [];
if( isset($_POST['text']) && (strlen($_POST['text'])>0) ){
    $messageData['text'] = str_replace("<", "&lt;", $_POST['text']);
    $messageData['text'] = str_replace("\r\n", "<br>", $messageData['text']);
}
if(isset($messageData['title']))
    $messageData['title'] = str_replace("<", "&lt;", $_POST['title']);

if(isset($messageData['email']))
    $messageData['email']= $_POST['email'];

$messageData['date'] = date("Y-m-d H:i:s");

if(isset($messageData['name']))
    $messageData['name'] = str_replace("<", "&lt;", $_POST['name']);

$isSaged = ($_POST['email'] === "SAGE");

//Handling image file, if any:
if((isset($_FILES['file']))&&($_FILES['file']['error'] === UPLOAD_ERR_OK)){
    $imgError = "";
    $targetDir = "$threadPath/src/";
    $imageFileType = pathinfo(basename($_FILES["file"]["name"]),PATHINFO_EXTENSION);
    $targetFileName = md5_file($_FILES['file']["tmp_name"]).".".$imageFileType;
    $targetFilePath = $targetDir. $targetFileName; 
    // Check if image file is a actual image or fake image
    if(isset($_POST["submit"])) {
        $check = getimagesize($_FILES["file"]["tmp_name"]);
        if($check === false) {
            $imgError = "file is not an image";
        }
    }
    // Check if file already exists
    if (file_exists($targetFilePath)) {
        $imgError = "file already exists";
    }
     // Check file size
    if ($_FILES["file"]["size"] > 500000) {
        $imgError = "file is too large";
     }
    // Allow certain file formats
    if($imageFileType != "jpg" && $imageFileType != "png" && $imageFileType != "jpeg"
    && $imageFileType != "gif" ) {
        $imgError = "unsupported format: ".$imageFileType;
    }
    // Check if $uploadOk is set to 0 by an error
    if ($imgError !== ""){
        echo "File upload error: ".$imgError;
    // if everything is ok, try to upload file
    } else {
        if (move_uploaded_file($_FILES["file"]["tmp_name"], $targetFilePath)) {
            if(generateThumb($targetFilePath, "$threadPath/thumb/$targetFileName"))
                $messageData['pic'] = $targetFileName;
            else
                unlink ($targetFilePath);//delete file if thumbnail generation failed
        } else {
            echo "Sorry, there was an error uploading your file.";
        }
    }
} else {
    if(isset($_FILES['file'])){
        if(($_FILES['file']['error'] !== UPLOAD_ERR_OK)&&($_FILES['file']['error']!== UPLOAD_ERR_NO_FILE)){
            echo 'File upload error, code '.$_FILES['file']['error'];
        }
    }
    if(strlen($_POST['text'])<1)
        die('Empty message and no picture, wtf?');
}


//Writing files ↓↓

//updating thread ↓↓

$datafileName = "$threadPath/posts.json";
$lastPostDataFileName = "$threadPath/lastPost.json";

$fileStart = microtime(true);
$delimiter = ",\r\n";
$serialized_message = json_encode($messageData,JSON_UNESCAPED_UNICODE);
file_put_contents($datafileName, $delimiter.$serialized_message, FILE_APPEND);
file_put_contents($lastPostDataFileName, $serialized_message);

if(!$isSaged) touch("$threadPath");
//updating thread ↑↑

//updating board ↓↓
if(preg_match("/Windows/",php_uname("s")))
    //Windows, works in most versions
    $lsOutput = shell_exec("dir /b /o-d $boardId");// 'b' for 'bare' output, 'o' for order (sort) by 'd'ate '-' for reverse order (newest first)
else
    //Linux, UNIX, MacOS X(?)
    $lsOutput = shell_exec("ls -t $boardId");

preg_match_all("/\d+/",$lsOutput, $threadList);
$threads = '['.implode(",",$threadList[0]).']';
file_put_contents("$boardId/threads.json", $threads);//TODO: check for locking?

$fileWriteTime = (microtime(true) - $fileStart)*1000000;
$totalExecutionTime = (microtime(true) - $scriptExecutionStart)*1000000;

//log file operations time:
file_put_contents("write-time_Log.txt",date("Y-m-d H:i:s").": Total execution time: "
        .$totalExecutionTime." File-write time: "
        .$fileWriteTime
        .(($isSaged)?" SAGE":"")
        .(isset($messageData['pic'])?" w/picture":"")."\r\n", FILE_APPEND);

function my_log($text){
    file_put_contents("log.txt", $text."\r\n", FILE_APPEND);
}
function generateThumb($source_image_path, $thumbnail_image_path)
{
    list($source_image_width, $source_image_height, $source_image_type) = getimagesize($source_image_path);
    switch ($source_image_type) {
        case IMAGETYPE_GIF:
            $source_gd_image = @imagecreatefromgif($source_image_path);
            break;
        case IMAGETYPE_JPEG:
            $source_gd_image = @imagecreatefromjpeg($source_image_path);
            break;
        case IMAGETYPE_PNG:
            $source_gd_image = @imagecreatefrompng($source_image_path);
            break;
    }
    if ($source_gd_image === false) {
        return false;
    }
    $source_aspect_ratio = $source_image_width / $source_image_height;
    $thumbnail_aspect_ratio = THUMBNAIL_IMAGE_MAX_WIDTH / THUMBNAIL_IMAGE_MAX_HEIGHT;
    if ($source_image_width <= THUMBNAIL_IMAGE_MAX_WIDTH && $source_image_height <= THUMBNAIL_IMAGE_MAX_HEIGHT) {
        $thumbnail_image_width = $source_image_width;
        $thumbnail_image_height = $source_image_height;
    } elseif ($thumbnail_aspect_ratio > $source_aspect_ratio) {
        $thumbnail_image_width = (int) (THUMBNAIL_IMAGE_MAX_HEIGHT * $source_aspect_ratio);
        $thumbnail_image_height = THUMBNAIL_IMAGE_MAX_HEIGHT;
    } else {
        $thumbnail_image_width = THUMBNAIL_IMAGE_MAX_WIDTH;
        $thumbnail_image_height = (int) (THUMBNAIL_IMAGE_MAX_WIDTH / $source_aspect_ratio);
    }
    
    //in case thumbnail would have a zero width or height:
    if($thumbnail_image_width<1)
        $thumbnail_image_width = 1;
    if($thumbnail_image_height<1)
        $thumbnail_image_height = 1;
    
    $thumbnail_gd_image = imagecreatetruecolor($thumbnail_image_width, $thumbnail_image_height);
    imagecopyresampled($thumbnail_gd_image, $source_gd_image, 0, 0, 0, 0, $thumbnail_image_width, $thumbnail_image_height, $source_image_width, $source_image_height);
    imagejpeg($thumbnail_gd_image, $thumbnail_image_path, 90);
    imagedestroy($source_gd_image);
    imagedestroy($thumbnail_gd_image);
    return true;
}