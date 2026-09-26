-- Run inside a transaction; every record and permission edit is rolled back.
DO $$DECLARE a uuid;ids uuid[];BEGIN
 SELECT id INTO a FROM public.profiles WHERE role='admin' AND is_active LIMIT 1;
 SELECT array_agg(id) INTO ids FROM (SELECT id FROM public.profiles WHERE role<>'admin' AND is_active ORDER BY id LIMIT 2) s;
 IF a IS NULL OR cardinality(ids)<2 THEN RAISE EXCEPTION 'Need admin and two members';END IF;
 PERFORM set_config('test.admin',a::text,true);PERFORM set_config('test.first',ids[1]::text,true);PERFORM set_config('test.second',ids[2]::text,true);PERFORM set_config('request.jwt.claim.sub',a::text,true);
END $$;
SET LOCAL ROLE authenticated;
UPDATE public.role_permissions SET can_view=true,can_approve=true WHERE role_key='sales_user' AND module='quotations';
DO $$DECLARE q uuid;c uuid;n public.contracts;n2 public.contracts;l uuid;customer uuid;req jsonb;BEGIN
 INSERT INTO public.crm_approval_policies(name,minimum_amount,approver_ids) VALUES('QA rollback',999999999999,ARRAY[current_setting('test.first')::uuid,current_setting('test.second')::uuid]);
 INSERT INTO public.quotations(customer_name,total,status,owner_id) VALUES('QA rollback',999999999999,'draft',current_setting('test.admin')::uuid) RETURNING id INTO q;PERFORM set_config('test.quote',q::text,true);
 req:=public.crm_quotation_transition(q,'submit','QA');
 IF req->>'current_step'<>'1' THEN RAISE EXCEPTION 'Submission failed';END IF;
 IF public.crm_quotation_transition(q,'submit','QA')->>'id'<>req->>'id' THEN RAISE EXCEPTION 'Duplicate submission';END IF;
 BEGIN UPDATE public.quotations SET total=1 WHERE id=q;RAISE EXCEPTION 'Pending quote changed';EXCEPTION WHEN raise_exception THEN IF SQLERRM='Pending quote changed' THEN RAISE;END IF;END;
 BEGIN PERFORM public.crm_quotation_transition(q,'approve','Self');RAISE EXCEPTION 'Self approval allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 INSERT INTO public.contracts(name,start_date,end_date,value,status) VALUES('QA rollback',current_date-30,current_date,100,'active') RETURNING id INTO c;
 n:=public.crm_renew_contract(c,current_date+365,120);n2:=public.crm_renew_contract(c,current_date+365,120);
 IF n.id<>n2.id OR n.renewed_from_id<>c OR n.start_date<>current_date+1 THEN RAISE EXCEPTION 'Renewal idempotency/date failure';END IF;
 IF (SELECT status FROM public.contracts WHERE id=c)<>'renewed' THEN RAISE EXCEPTION 'Original contract state failed';END IF;
 INSERT INTO public.leads(company_name,contact_name,email) VALUES('QA rollback','QA contact','qa@example.invalid') RETURNING id INTO l;
 customer:=public.crm_convert_lead(l);
 IF customer<>public.crm_convert_lead(l) OR (SELECT count(*) FROM public.contacts WHERE customer_id=customer)<>1 THEN RAISE EXCEPTION 'Duplicate conversion';END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('test.second'),true);
DO $$BEGIN BEGIN PERFORM public.crm_quotation_transition(current_setting('test.quote')::uuid,'approve','Wrong step');RAISE EXCEPTION 'Out of order approval';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('test.first'),true);
DO $$DECLARE r jsonb;BEGIN
 r:=public.crm_quotation_transition(current_setting('test.quote')::uuid,'approve','Step 1');IF r->>'current_step'<>'2' OR r->>'status'<>'pending' THEN RAISE EXCEPTION 'First step failed';END IF;
 BEGIN PERFORM public.crm_quotation_transition(current_setting('test.quote')::uuid,'approve','Repeated');RAISE EXCEPTION 'Repeated step';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('test.second'),true);
DO $$DECLARE r jsonb;BEGIN
 r:=public.crm_quotation_transition(current_setting('test.quote')::uuid,'approve','Step 2');IF r->>'status'<>'approved' THEN RAISE EXCEPTION 'Final approval failed';END IF;
 IF (SELECT approval_status FROM public.quotations WHERE id=current_setting('test.quote')::uuid)<>'approved' THEN RAISE EXCEPTION 'Quote not approved';END IF;
 IF (SELECT count(*) FROM public.crm_approval_events WHERE request_id=(r->>'id')::uuid)<>3 THEN RAISE EXCEPTION 'Missing approval history';END IF;
 BEGIN INSERT INTO public.crm_approval_policies(name,approver_ids) VALUES('Denied',ARRAY[current_setting('test.admin')::uuid]);RAISE EXCEPTION 'Member policy write';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
DO $$DECLARE test_record_id uuid;c uuid;r record;BEGIN
 INSERT INTO public.customers(name,type,tier,status) VALUES('QA forms','Company','Standard','Active') RETURNING customers.id INTO c;
 INSERT INTO public.contacts(name,customer_id,company,role,influence_level,status) VALUES('QA contact',c,'QA forms','User','medium','active');
 INSERT INTO public.master_data_items(category,code,name_th,name_en) VALUES('sales_stage','QA_INTERNAL_STAGE','ทดสอบ','QA internal stage');
 INSERT INTO public.opportunities(name,customer_id,stage,amount,probability,weighted_amount) VALUES('QA deal',c,'QA internal stage',100,25,25) RETURNING opportunities.id INTO test_record_id;
 UPDATE public.opportunities SET amount=200,weighted_amount=50 WHERE opportunities.id=test_record_id;
 IF (SELECT amount FROM public.opportunities WHERE opportunities.id=test_record_id)<>200 THEN RAISE EXCEPTION 'Opportunity readback failed';END IF;
 INSERT INTO public.assets(name,customer_id,category,status) VALUES('QA asset',c,'Server','active');
 INSERT INTO public.tickets(subject,customer_id,type,status,priority) VALUES('QA ticket',c,'Hardware','open','medium');
 INSERT INTO public.activities(subject,customer_id,type,status,priority) VALUES('QA activity',c,'Internal Task','planned','medium');
 INSERT INTO public.documents(name,customer_id,type,status) VALUES('QA document',c,'Contract','draft') RETURNING documents.id INTO test_record_id;
 UPDATE public.documents SET name='QA document revised' WHERE documents.id=test_record_id;
 IF (SELECT count(*) FROM public.crm_record_versions WHERE module='documents' AND record_id=test_record_id)<>2 THEN RAISE EXCEPTION 'Document versions missing';END IF;
 INSERT INTO public.crm_branches(name,customer_id,code) VALUES('QA branch',c,'QA');
 INSERT INTO public.crm_price_items(name,code,price,cost) VALUES('QA item','QA_'||gen_random_uuid(),100,50);
 INSERT INTO public.crm_templates(name,header,footer) VALUES('QA template','Header','Footer');
 INSERT INTO public.crm_knowledge_articles(name,description,status) VALUES('QA article','QA solution','published');
 IF NOT EXISTS(SELECT 1 FROM public.notifications WHERE user_id=current_setting('test.admin')::uuid AND related_id=current_setting('test.quote')::uuid) THEN RAISE EXCEPTION 'Final approval notification missing';END IF;
END $$;
SET LOCAL ROLE anon;
DO $$BEGIN BEGIN PERFORM public.crm_renew_contract(gen_random_uuid(),current_date+1,1);RAISE EXCEPTION 'Anon RPC allowed';EXCEPTION WHEN insufficient_privilege THEN NULL;END;BEGIN PERFORM 1 FROM public.crm_approval_requests;RAISE EXCEPTION 'Anon request read';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $$;
RESET ROLE;
SELECT 'PASS: ordered approvals, no self-approval, financial lock, atomic/idempotent renewal/conversion, notification/history and access control' AS result;
