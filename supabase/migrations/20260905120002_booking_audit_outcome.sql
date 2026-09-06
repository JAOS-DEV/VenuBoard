-- Repair booking audit outcome to the catalogue value `success`.

CREATE OR REPLACE FUNCTION app_private.write_booking_audit(
  p_action text,
  p_business_id uuid,
  p_venue_id uuid,
  p_target_id uuid,
  p_summary text,
  p_previous jsonb,
  p_resulting jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.audit_log (
    actor_user_id,
    actor_platform_role,
    action,
    scope_type,
    business_id,
    venue_id,
    target_table,
    target_id,
    summary,
    previous_state,
    resulting_state,
    outcome,
    environment,
    metadata
  )
  VALUES (
    app_private.current_user_id(),
    CASE
      WHEN app_private.is_platform_admin() THEN 'platform_admin'
      WHEN app_private.is_platform_support() THEN 'platform_support'
      ELSE NULL
    END,
    p_action,
    'venue',
    p_business_id,
    p_venue_id,
    'booking_requests',
    p_target_id,
    p_summary,
    p_previous,
    p_resulting,
    'success',
    app_private.audit_environment(),
    '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION app_private.write_booking_audit(
  text, uuid, uuid, uuid, text, jsonb, jsonb
) FROM PUBLIC, anon, authenticated, service_role;
