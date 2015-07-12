<?php $output = (!($_GET['a']>0))?"Invalid thread ID":"Valid thread ID";
$output.="\r\na=".(intval($_GET['a'] +0));
$fileStart = microtime(true);
$output.="\r\n Dir listing: ".(shell_exec('ls -t'));
$output.="\r\n Processes: ".(shell_exec('ps'));
$fileWriteTime = (microtime(true) - $fileStart)*1000000;
$output.="\n Execution time:".$fileWriteTime;
echo str_replace("\n","<br>",$output)."<br>";
if(isset($_GET['board']))
    echo json_encode(explode("\n",shell_exec("ls -t ".$_GET["board"])));
echo "$fileWriteTime lolwut?";