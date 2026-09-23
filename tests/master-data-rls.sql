BEGIN;
DO $$DECLARE admin_id uuid; member_id uuid; BEGIN
 SELECT id INTO admin_id FROM public.profiles WHERE role='admin' AND is_active LIMIT 1;
 SELECT id INTO member_id FROM public.profiles WHERE role<>'admin' AND is_active LIMIT 1;
 IF admin_id IS NULL OR member_id IS NULL THEN RAISE EXCEPTION 'Test requires an active admin and non-admin profile'; END IF;
 PERFORM set_config('test.admin',admin_id::text,true);
 PERFORM set_config('test.member',member_id::text,true);
 PERFORM set_config('test.record',gen_random_uuid()::text,true);
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
END $$;
SET LOCAL ROLE authenticated;
INSERT INTO public.master_data_items(id,category,code,name_th,name_en) VALUES(current_setting('test.record')::uuid,'unit','QA_'||upper(substr(replace(current_setting('test.record'),'-',''),1,20)),'ทดสอบ','Test');
DO $$DECLARE n integer; BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.master_data_items WHERE id=current_setting('test.record')::uuid AND version=1) THEN RAISE EXCEPTION 'Admin read after create failed'; END IF;
 UPDATE public.master_data_items SET name_en='Updated',status='inactive' WHERE id=current_setting('test.record')::uuid AND version=1;
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Admin update failed'; END IF;
 UPDATE public.master_data_items SET name_en='Stale' WHERE id=current_setting('test.record')::uuid AND version=1;
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Stale update was not rejected'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.master_data_items WHERE id=current_setting('test.record')::uuid AND version=2 AND name_en='Updated' AND status='inactive') THEN RAISE EXCEPTION 'Update readback mismatch'; END IF;
 IF (SELECT count(*) FROM public.audit_logs WHERE record_id=current_setting('test.record')::uuid)<>2 THEN RAISE EXCEPTION 'Atomic audit missing'; END IF;
 BEGIN INSERT INTO public.master_data_items(category,code,name_th,name_en) SELECT category,code,name_th,name_en FROM public.master_data_items WHERE id=current_setting('test.record')::uuid; RAISE EXCEPTION 'Duplicate accepted'; EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN UPDATE public.master_data_items SET sort_order=-1 WHERE id=current_setting('test.record')::uuid; RAISE EXCEPTION 'Invalid order accepted'; EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN DELETE FROM public.master_data_items WHERE id=current_setting('test.record')::uuid; RAISE EXCEPTION 'Hard deletion allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('test.member'),true);
DO $$DECLARE n integer; BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.master_data_items WHERE id=current_setting('test.record')::uuid) THEN RAISE EXCEPTION 'Active member cannot read'; END IF;
 UPDATE public.master_data_items SET name_en='Unauthorized' WHERE id=current_setting('test.record')::uuid;
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Member write was allowed'; END IF;
 BEGIN INSERT INTO public.master_data_items(category,code,name_th,name_en) VALUES('tag','QA_DENIED','ทดสอบ','Denied'); RAISE EXCEPTION 'Member create allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
DO $$BEGIN IF EXISTS(SELECT 1 FROM public.master_data_items WHERE id=current_setting('test.record')::uuid) THEN RAISE EXCEPTION 'Non-CRM user can read'; END IF; END $$;
SET LOCAL ROLE anon;
DO $$BEGIN BEGIN PERFORM 1 FROM public.master_data_items; RAISE EXCEPTION 'Anonymous read allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: admin create/update/readback, stale write, duplicate, validation, atomic audit, member/non-CRM/anonymous permissions, no hard deletion; all writes rolled back' AS result;
