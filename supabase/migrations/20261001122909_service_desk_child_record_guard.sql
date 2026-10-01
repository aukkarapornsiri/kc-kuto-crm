do $$ begin execute replace(pg_get_functiondef('private.crm_service_child_guard()'::regprocedure),'new.repair_id','(to_jsonb(new)->>''repair_id'')::uuid');end $$;
