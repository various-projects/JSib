<?php
if($_SERVER['REMOTE_ADDR']!='127.0.0.1'){
    http_response_code(404);
    die();
}
else die("Granted!");