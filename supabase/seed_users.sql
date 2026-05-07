-- =============================================
-- SEED UTILISATEURS — JESA Fiabilité
-- Coller dans Supabase > SQL Editor > Run
-- =============================================

-- 1. Mettre les codes sites compatibles avec localStorage
UPDATE sites SET code = 'rabat' WHERE nom = 'Rabat';
UPDATE sites SET code = 'jorf'  WHERE nom = 'Jorf Lasfar';
UPDATE sites SET code = 'casa'  WHERE nom = 'Casablanca';
UPDATE sites SET code = 'khb'   WHERE nom = 'Kherbiga';

-- 2. Créer les utilisateurs + profils
DO $$
DECLARE
  v_rabat_id uuid;
  v_jorf_id  uuid;
  v_casa_id  uuid;
  v_khb_id   uuid;
  v_uid      uuid;
BEGIN
  SELECT id INTO v_rabat_id FROM sites WHERE code = 'rabat';
  SELECT id INTO v_jorf_id  FROM sites WHERE code = 'jorf';
  SELECT id INTO v_casa_id  FROM sites WHERE code = 'casa';
  SELECT id INTO v_khb_id   FROM sites WHERE code = 'khb';

  -- ── Utilisateur 1 : Mehdi — Rabat (admin) ──────────────────
  SELECT id INTO v_uid FROM auth.users WHERE email = 'mehdi@jesa.ma';
  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role
    ) VALUES (
      v_uid, 'mehdi@jesa.ma',
      crypt('Jesa2025!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}', '{}',
      false, 'authenticated'
    );
  END IF;
  UPDATE profiles
    SET nom = 'Ouadghiri', prenom = 'Mehdi', site_id = v_rabat_id, role = 'admin'
    WHERE id = v_uid;

  -- ── Utilisateur 2 : Chaimae — Jorf Lasfar ─────────────────
  SELECT id INTO v_uid FROM auth.users WHERE email = 'chaimae@jesa.ma';
  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role
    ) VALUES (
      v_uid, 'chaimae@jesa.ma',
      crypt('Jesa2025!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}', '{}',
      false, 'authenticated'
    );
  END IF;
  UPDATE profiles
    SET nom = 'User', prenom = 'Chaimae', site_id = v_jorf_id, role = 'user'
    WHERE id = v_uid;

  -- ── Utilisateur 3 : Casa ───────────────────────────────────
  SELECT id INTO v_uid FROM auth.users WHERE email = 'casa@jesa.ma';
  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role
    ) VALUES (
      v_uid, 'casa@jesa.ma',
      crypt('Jesa2025!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}', '{}',
      false, 'authenticated'
    );
  END IF;
  UPDATE profiles
    SET site_id = v_casa_id, role = 'user'
    WHERE id = v_uid;

  -- ── Utilisateur 4 : Kherbiga ──────────────────────────────
  SELECT id INTO v_uid FROM auth.users WHERE email = 'kherbiga@jesa.ma';
  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role
    ) VALUES (
      v_uid, 'kherbiga@jesa.ma',
      crypt('Jesa2025!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}', '{}',
      false, 'authenticated'
    );
  END IF;
  UPDATE profiles
    SET site_id = v_khb_id, role = 'user'
    WHERE id = v_uid;

END $$;
