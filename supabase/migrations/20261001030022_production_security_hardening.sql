alter table public.example enable row level security;
revoke all on public.example from anon,authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  new.updated_at=pg_catalog.now();
  return new;
end;
$$;
