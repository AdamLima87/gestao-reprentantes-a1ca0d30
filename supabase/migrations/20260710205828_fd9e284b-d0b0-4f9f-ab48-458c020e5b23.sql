CREATE OR REPLACE FUNCTION public.verificar_rate_limit_login(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text := lower(trim(p_email));
  v_falhas int;
  v_janela interval := interval '15 minutes';
  v_max int := 5;
  v_ultima timestamptz;
BEGIN
  IF v_email IS NULL OR length(v_email) = 0 THEN
    RETURN jsonb_build_object('bloqueado', false, 'falhas', 0);
  END IF;

  SELECT count(*), max(criado_em)
    INTO v_falhas, v_ultima
    FROM public.login_attempts
   WHERE email = v_email
     AND sucesso = false
     AND criado_em > now() - v_janela;

  IF v_falhas >= v_max THEN
    RETURN jsonb_build_object(
      'bloqueado', true,
      'falhas', v_falhas,
      'liberar_em', v_ultima + v_janela
    );
  END IF;

  RETURN jsonb_build_object('bloqueado', false, 'falhas', v_falhas, 'restantes', v_max - v_falhas);
END;
$$;

REVOKE ALL ON FUNCTION public.verificar_rate_limit_login(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verificar_rate_limit_login(text) TO anon, authenticated;