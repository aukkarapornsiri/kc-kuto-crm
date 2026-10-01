-- Preserve the true deadline when a pause resumes after an existing SLA breach.
do $$ declare def text;old_expression text:='private.crm_service_due(now(),greatest(0,(new.sla_snapshot->>''resolution_minutes'')::numeric-private.crm_service_minutes(new.created_at,now(),new.sla_snapshot->''calendar'')+new.paused_minutes),new.sla_snapshot->''calendar'')';begin
 def:=pg_get_functiondef('private.crm_service_ticket_guard()'::regprocedure);
 if position(old_expression in def)=0 then raise exception 'Expected SLA resume expression not found';end if;
 execute replace(def,old_expression,'private.crm_service_due(new.created_at,(new.sla_snapshot->>''resolution_minutes'')::numeric+new.paused_minutes,new.sla_snapshot->''calendar'')');
end $$;
