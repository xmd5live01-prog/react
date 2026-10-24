insert into public.cms_admins (email)
values ('mangjapli30@gmail.com')
on conflict (email) do nothing;
