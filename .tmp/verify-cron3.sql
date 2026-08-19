select jobid, jobname, schedule, command, active
from cron.job
where jobname = 'cue-reconcile-paid-but-locked';
