local B=require('game.board');local E=require('game.ai.exchange')
local b=B.standard()
for _,m in ipairs({{65,68},{2,21},{57,48},{34,43},{83,66},{8,25},{66,49}}) do b[m[2]]=b[m[1]];b[m[1]]='' end
local key=B.key(b,'black',false)
assert(E.gain(b,{26,89},false)==-50,'cannon for protected horse must lose 50 material')
assert(E.risk(b,'black','red',false)==100,'exposed pawn must be visible to the opponent')
assert(B.key(b,'black',false)==key,'SEE mutated the input')
print('PASS protected horse exchange -50, exposed pawn 100, input restored')
local c={} for i=1,90 do c[i]='' end
c[5]='k';c[85]='K';c[20]='c';c[29]='p';c[56]='R'
assert(E.gain(c,{20,56},false)==900,'free rook capture was penalized')
print('PASS genuinely free rook remains a gain of 900')

local fork={} for i=1,90 do fork[i]='' end
fork[6]='k';fork[85]='K';fork[30]='p';fork[32]='p';fork[49]='N'
assert(E.risk(fork,'black','black',false)==100,'two loose targets must remain visible on own turn')
print('PASS fork remains an exposure even when victim can move')
