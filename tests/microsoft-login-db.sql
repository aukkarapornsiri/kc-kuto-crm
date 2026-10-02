CREATE SCHEMA private;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_app_meta_data jsonb);
\i /tmp/office365.sql
BEGIN;
INSERT INTO auth.users VALUES('00000000-0000-4000-8000-000000000001','{"provider":"email"}');
DO $$ BEGIN
 BEGIN
  INSERT INTO auth.users VALUES('00000000-0000-4000-8000-000000000002','{"provider":"azure"}');
  RAISE EXCEPTION 'Unprovisioned Microsoft user accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
-- Existing accounts may receive an Azure identity without creating another user.
UPDATE auth.users SET raw_app_meta_data='{"provider":"email","providers":["email","azure"]}' WHERE id='00000000-0000-4000-8000-000000000001';
DO $$ BEGIN
 IF (SELECT count(*) FROM auth.users)<>1 THEN RAISE EXCEPTION 'Unexpected user count'; END IF;
 IF has_function_privilege('anon','private.crm_block_unprovisioned_microsoft_user()','execute') THEN RAISE EXCEPTION 'Anonymous execute allowed'; END IF;
END $$;
ROLLBACK;
