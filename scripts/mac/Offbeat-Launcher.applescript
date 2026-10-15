-- Finder launcher: keeps the Mac microphone and analysis local.
on run
  set projectFolder to (POSIX path of (path to home folder)) & "offbeat"
  try
    do shell script "/usr/bin/test -f " & quoted form of (projectFolder & "/package.json")
  on error
    set chosenFolder to choose folder with prompt "Choose your OFFBEAT project folder:"
    set projectFolder to POSIX path of chosenFolder
  end try
  set bundlePath to POSIX path of (path to me)
  set startScript to bundlePath & "Contents/Resources/start_offbeat.sh"
  try
    display notification "Preparing your local music workspace." with title "OFFBEAT"
    with timeout of 1200 seconds
      set statusText to do shell script "/bin/zsh " & quoted form of startScript & " " & quoted form of projectFolder
    end timeout
    if statusText contains "OFFBEAT_READY" then
      open location "http://127.0.0.1:5173"
      display notification "Bass Mirror is ready." with title "OFFBEAT"
    else
      display alert "Offbeat needs attention" message statusText as warning
    end if
  on error errorText number errorCode
    display alert "Offbeat couldn't start" message errorText & return & return & "Your recordings have not been deleted." as warning
  end try
end run
