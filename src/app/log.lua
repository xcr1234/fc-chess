local M={enabled=true}
function M.event(kind,message) if M.enabled then print('[fc-chess]['..kind..'] '..tostring(message)) end end
function M.error(message) printerr('[fc-chess][error] '..tostring(message)) end
return M
