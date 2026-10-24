-- Work quotas cover generation, ordering, PVS, null verification and quiescence.
-- os.clock is allowed by the client API docs, but precision is not guaranteed.
-- Use it only as an additional cooperative guard; quotas remain mandatory.
local M={}
function M.step(job,dt,advance,finish)
 if job.done then return end
 job.elapsed=job.elapsed+math.max(0,dt or 0)
 if job.cancelled then finish(job,'cancelled');return end
 if job.elapsed>=job.timeLimit then finish(job,'deadline');return end
 local nodes=job.nodes;local work=0
 local clock=job.clock;local started=clock and clock()
 while not job.done and work<job.operationsPerStep and job.nodes-nodes<job.nodesPerStep do
  if (job.operations or 0)+work>=job.workBudget then finish(job,'work');break end
  advance(job);work=work+1
  if clock and work%4==0 and clock()-started>=job.sliceSeconds then break end
 end
 job.operations=(job.operations or 0)+work;job.lastOperations=work
end
return M
