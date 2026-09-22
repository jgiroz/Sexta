-- ============================================================
-- Migración 06
-- El correo de contacto se llena solo cuando alguien se registra
-- con una dirección real. Así no hay que editar cada usuario a mano.
-- Las cuentas internas (.local) quedan en blanco a propósito.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Al crear la cuenta, copiar el correo si es una dirección real
-- ------------------------------------------------------------
create or replace function fn_handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nombre_completo, rol, tipo, email_contacto)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre_completo', new.email),
    'usuario',
    'voluntario',
    case
      when new.email is null then null
      -- Dominios reservados que no reciben correo de verdad.
      when new.email ~* '\.(local|invalid|test|example)$' then null
      else new.email
    end
  );
  return new;
end;
$$ language plpgsql security definer;

-- ------------------------------------------------------------
-- 2) Rellenar los usuarios que ya existen
--    Solo toca los que están vacíos: si ya cargaste un correo
--    distinto a mano, no se sobrescribe.
-- ------------------------------------------------------------
update profiles p
set email_contacto = u.email
from auth.users u
where p.id = u.id
  and p.email_contacto is null
  and u.email is not null
  and u.email !~* '\.(local|invalid|test|example)$';
