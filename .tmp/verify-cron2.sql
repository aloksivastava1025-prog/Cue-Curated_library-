select jobname, schedule, active
from cron.job
where jobname = 'cue-reconcile-paid-but-locked';
