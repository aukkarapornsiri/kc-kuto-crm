BEGIN;
DO $$DECLARE a uuid; BEGIN SELECT id INTO a FROM public.profiles WHERE role='admin' AND is_active LIMIT 1;IF a IS NULL THEN RAISE EXCEPTION 'Admin required'; END IF;PERFORM set_config('request.jwt.claim.sub',a::text,true);END $$;
SET LOCAL ROLE authenticated;
DO $$DECLARE category_name text; record_id uuid; BEGIN
 FOREACH category_name IN ARRAY ARRAY['sales_stage','asset_type','asset_brand','asset_model','asset_status','warranty_status','license_status','asset_location'] LOOP
  INSERT INTO public.master_data_items(category,code,name_th,name_en) VALUES(category_name,'QA_'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,20)),'ทดสอบ','QA') RETURNING id INTO record_id;
  UPDATE public.master_data_items SET name_en='Verified',status='inactive' WHERE id=record_id AND version=1;
  IF NOT EXISTS(SELECT 1 FROM public.master_data_items WHERE id=record_id AND name_en='Verified' AND version=2 AND status='inactive') THEN RAISE EXCEPTION 'Reference CRUD failed: %',category_name; END IF;
 END LOOP;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: sales stage and seven asset reference categories create/update/readback, rollback complete' AS result;
