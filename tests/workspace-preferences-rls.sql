BEGIN;
DO $$DECLARE a uuid;m uuid;BEGIN
 SELECT id INTO a FROM public.profiles WHERE role='admin' AND is_active LIMIT 1;
 SELECT id INTO m FROM public.profiles WHERE role<>'admin' AND is_active LIMIT 1;
 IF a IS NULL OR m IS NULL THEN RAISE EXCEPTION 'Two active users required';END IF;
 PERFORM set_config('test.admin',a::text,true);PERFORM set_config('test.member',m::text,true);
 PERFORM set_config('request.jwt.claim.sub',m::text,true);
END $$;
-- All test writes, including existing preference updates, are rolled back.
SET LOCAL ROLE authenticated;
INSERT INTO public.crm_workspace_preferences(user_id,enabled,"primary") VALUES(current_setting('test.member')::uuid,true,'#123456') ON CONFLICT(user_id) DO UPDATE SET enabled=true,"primary"='#123456';
DO $$DECLARE oldversion integer;n integer;BEGIN
 SELECT version INTO oldversion FROM public.crm_workspace_preferences WHERE user_id=current_setting('test.member')::uuid;
 IF oldversion IS NULL THEN RAISE EXCEPTION 'Member read denied';END IF;
 UPDATE public.crm_workspace_preferences SET surface='#111111',radius='24',shadow='raised' WHERE user_id=current_setting('test.member')::uuid AND version=oldversion;
 GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RAISE EXCEPTION 'Own update failed';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.crm_workspace_preferences WHERE surface='#111111' AND radius='24' AND shadow='raised' AND version=oldversion+1) THEN RAISE EXCEPTION 'Readback/version failed';END IF;
 UPDATE public.crm_workspace_preferences SET radius='0' WHERE user_id=current_setting('test.member')::uuid AND version=oldversion;
 GET DIAGNOSTICS n=ROW_COUNT;IF n<>0 THEN RAISE EXCEPTION 'Stale update accepted';END IF;
 BEGIN UPDATE public.crm_workspace_preferences SET "primary"='red; background:url(x)';RAISE EXCEPTION 'Invalid color accepted';EXCEPTION WHEN check_violation THEN NULL;END;
 BEGIN UPDATE public.crm_workspace_preferences SET shadow='evil';RAISE EXCEPTION 'Invalid shadow accepted';EXCEPTION WHEN check_violation THEN NULL;END;
 BEGIN UPDATE public.crm_workspace_preferences SET radius='999';RAISE EXCEPTION 'Invalid radius accepted';EXCEPTION WHEN check_violation THEN NULL;END;
 BEGIN UPDATE public.crm_workspace_preferences SET user_id=current_setting('test.admin')::uuid;RAISE EXCEPTION 'Owner change accepted';EXCEPTION WHEN raise_exception THEN IF SQLERRM='Owner change accepted' THEN RAISE;END IF;WHEN insufficient_privilege THEN NULL;END;
 BEGIN INSERT INTO public.crm_workspace_preferences(user_id) VALUES(current_setting('test.admin')::uuid);RAISE EXCEPTION 'Other owner insert allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN DELETE FROM public.crm_workspace_preferences;RAISE EXCEPTION 'Delete allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
DO $$DECLARE n integer;BEGIN
 IF EXISTS(SELECT 1 FROM public.crm_workspace_preferences WHERE user_id=current_setting('test.member')::uuid) THEN RAISE EXCEPTION 'Admin can read another personal theme';END IF;
 UPDATE public.crm_workspace_preferences SET "primary"='#FFFFFF' WHERE user_id=current_setting('test.member')::uuid;GET DIAGNOSTICS n=ROW_COUNT;IF n<>0 THEN RAISE EXCEPTION 'Other owner update allowed';END IF;
END $$;
RESET ROLE;
UPDATE public.profiles SET is_active=false WHERE id=current_setting('test.member')::uuid;
SELECT set_config('request.jwt.claim.sub',current_setting('test.member'),true);
SET LOCAL ROLE authenticated;
DO $$DECLARE n integer;BEGIN
 IF EXISTS(SELECT 1 FROM public.crm_workspace_preferences) THEN RAISE EXCEPTION 'Inactive read allowed';END IF;
 UPDATE public.crm_workspace_preferences SET enabled=false;GET DIAGNOSTICS n=ROW_COUNT;IF n<>0 THEN RAISE EXCEPTION 'Inactive update allowed';END IF;
 BEGIN INSERT INTO public.crm_workspace_preferences(user_id) VALUES(current_setting('test.member')::uuid);RAISE EXCEPTION 'Inactive insert allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SET LOCAL ROLE anon;
DO $$BEGIN
 BEGIN PERFORM 1 FROM public.crm_workspace_preferences;RAISE EXCEPTION 'Anonymous read allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN INSERT INTO public.crm_workspace_preferences(user_id) VALUES(current_setting('test.member')::uuid);RAISE EXCEPTION 'Anonymous insert allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: personal theme persistence, validation, stale-write protection, owner isolation including admin, inactive and anonymous denial; rolled back' AS result;
