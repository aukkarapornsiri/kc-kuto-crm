BEGIN;
DO $$DECLARE a uuid; m uuid; BEGIN
 SELECT id INTO a FROM public.profiles WHERE role='admin' AND is_active LIMIT 1;
 SELECT id INTO m FROM public.profiles WHERE role<>'admin' AND is_active LIMIT 1;
 IF a IS NULL OR m IS NULL THEN RAISE EXCEPTION 'Active admin and member required'; END IF;
 PERFORM set_config('test.admin',a::text,true);PERFORM set_config('test.member',m::text,true);
 PERFORM set_config('test.id',gen_random_uuid()::text,true);
 PERFORM set_config('test.role','qa_'||substr(replace(gen_random_uuid()::text,'-',''),1,16),true);
 PERFORM set_config('request.jwt.claim.sub',a::text,true);
END $$;
SET LOCAL ROLE authenticated;
INSERT INTO public.crm_teams(id,name_th,name_en,member_ids) VALUES(current_setting('test.id')::uuid,'QA '||current_setting('test.id'),'QA '||current_setting('test.id'),ARRAY[current_setting('test.member')::uuid]);
DO $$DECLARE n integer; oldtime timestamptz; BEGIN
 SELECT updated_at INTO oldtime FROM public.crm_teams WHERE id=current_setting('test.id')::uuid;
 UPDATE public.crm_teams SET is_active=false WHERE id=current_setting('test.id')::uuid AND updated_at=oldtime;
 GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RAISE EXCEPTION 'Team update failed'; END IF;
 UPDATE public.crm_teams SET name_en='Stale' WHERE id=current_setting('test.id')::uuid AND updated_at=oldtime;
 GET DIAGNOSTICS n=ROW_COUNT;IF n<>0 THEN RAISE EXCEPTION 'Stale write accepted'; END IF;
 BEGIN UPDATE public.crm_teams SET member_ids=ARRAY[gen_random_uuid()] WHERE id=current_setting('test.id')::uuid;RAISE EXCEPTION 'Invalid member accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Invalid member accepted' THEN RAISE; END IF; END;
 UPDATE public.company_settings SET company_details='{"address_th":"ทดสอบ","contact_name":"QA"}',updated_at=clock_timestamp() WHERE id=1;
 IF NOT EXISTS(SELECT 1 FROM public.company_settings WHERE id=1 AND company_details->>'contact_name'='QA') THEN RAISE EXCEPTION 'Company readback failed'; END IF;
 BEGIN UPDATE public.company_settings SET company_details='[]' WHERE id=1; RAISE EXCEPTION 'Invalid JSON accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN UPDATE public.profiles SET is_active=false WHERE id=current_setting('test.admin')::uuid;RAISE EXCEPTION 'Self disable allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Self disable allowed' THEN RAISE; END IF; END;
 IF NOT EXISTS(SELECT 1 FROM public.audit_logs WHERE changes->>'table'='crm_teams' AND user_id=current_setting('test.admin')::uuid) THEN RAISE EXCEPTION 'Team audit missing'; END IF;
END $$;
INSERT INTO public.custom_roles(role_key,label_th,label_en) VALUES(current_setting('test.role'),'บทบาททดสอบ','QA role');
SELECT public.crm_save_permissions(current_setting('test.role'),'[{"module":"customers","can_view":true,"can_create":false}]');
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.role_permissions WHERE role_key=current_setting('test.role') AND module='customers' AND can_view AND NOT can_create) THEN RAISE EXCEPTION 'Permission readback failed'; END IF;
 BEGIN PERFORM public.crm_save_permissions(current_setting('test.role'),'[{"module":"customers","can_create":true},{"module":"invalid"}]');RAISE EXCEPTION 'Invalid module accepted';EXCEPTION WHEN raise_exception THEN IF SQLERRM='Invalid module accepted' THEN RAISE; END IF;END;
 IF EXISTS(SELECT 1 FROM public.role_permissions WHERE role_key=current_setting('test.role') AND module='customers' AND can_create) THEN RAISE EXCEPTION 'Permission save not atomic'; END IF;
 BEGIN PERFORM public.crm_save_permissions('admin','[]');RAISE EXCEPTION 'Admin matrix writable';EXCEPTION WHEN raise_exception THEN IF SQLERRM='Admin matrix writable' THEN RAISE; END IF;END;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('test.member'),true);
DO $$DECLARE n integer; BEGIN
 UPDATE public.crm_teams SET name_en='Unauthorized' WHERE id=current_setting('test.id')::uuid;GET DIAGNOSTICS n=ROW_COUNT;IF n<>0 THEN RAISE EXCEPTION 'Member update allowed'; END IF;
 BEGIN INSERT INTO public.crm_teams(name_th,name_en) VALUES('Denied','Denied');RAISE EXCEPTION 'Member create allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.crm_save_permissions(current_setting('test.role'),'[]');RAISE EXCEPTION 'Member permissions write allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SET LOCAL ROLE anon;
DO $$BEGIN
 BEGIN PERFORM 1 FROM public.crm_teams;RAISE EXCEPTION 'Anonymous teams read allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM public.crm_save_permissions('admin','[]');RAISE EXCEPTION 'Anonymous RPC allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: company/team CRUD, stale write, validation, atomic permissions, audit, self-admin guard, member and anonymous denial; rolled back' AS result;
