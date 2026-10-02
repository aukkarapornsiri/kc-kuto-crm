BEGIN;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SET LOCAL ROLE authenticated;
UPDATE public.profiles SET first_name=' Mary Jane ',last_name=' van der Berg ' WHERE id='11111111-1111-4111-8111-111111111111';
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND first_name='Mary Jane' AND last_name='van der Berg' AND display_name='Mary Jane van der Berg' AND role='admin') THEN RAISE EXCEPTION 'Split name save failed';END IF;
 BEGIN UPDATE public.profiles SET first_name='' WHERE id=auth.uid();RAISE EXCEPTION 'Blank first name accepted';EXCEPTION WHEN check_violation THEN NULL;END;
END $$;
UPDATE public.profiles SET last_name='' WHERE id=auth.uid();
DO $$BEGIN IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND display_name='Mary Jane' AND last_name='') THEN RAISE EXCEPTION 'Single name failed';END IF;END $$;
UPDATE public.profiles SET display_name='Legacy Client Name' WHERE id=auth.uid();
DO $$BEGIN IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND display_name='Legacy Client Name' AND first_name IS NULL AND last_name IS NULL) THEN RAISE EXCEPTION 'Legacy compatibility failed';END IF;END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
SET LOCAL ROLE authenticated;
UPDATE public.profiles SET first_name='สมชาย',last_name='ใจดี',role='admin' WHERE id=auth.uid();
DO $$BEGIN IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND display_name='สมชาย ใจดี' AND role='sales_user') THEN RAISE EXCEPTION 'Profile edit permissions failed';END IF;END $$;
ROLLBACK;
