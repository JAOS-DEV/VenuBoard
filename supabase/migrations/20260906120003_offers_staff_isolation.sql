-- Staff and booking managers have no offer grants. Staff still have
-- create_content (conditional) and submit_content_for_approval (allow) for
-- feed/events; those must not confer offer admin reads or writes.

CREATE FUNCTION app_private.offer_actor_is_venue_operator(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    app_private.is_user_active()
    AND (
      app_private.is_business_owner(app_private.venue_business_id(p_venue_id))
      OR EXISTS (
        SELECT 1
        FROM public.venue_memberships m
        WHERE m.venue_id = p_venue_id
          AND m.user_id = app_private.current_user_id()
          AND m.status = 'active'
          AND m.role IN (
            'business_owner',
            'venue_manager',
            'content_editor'
          )
      )
    );
$$;

CREATE OR REPLACE FUNCTION app_private.may_read_offer_admin(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    app_private.offer_actor_is_venue_operator(p_venue_id)
    OR app_private.platform_may_read_tenant(
      (SELECT v.business_id FROM public.venues v WHERE v.id = p_venue_id),
      p_venue_id
    );
$$;

CREATE OR REPLACE FUNCTION app_private.may_create_offer(p_venue_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT app_private.offer_actor_is_venue_operator(p_venue_id) THEN
    RETURN false;
  END IF;
  IF NOT app_private.subscription_allows_tenant_writes(p_venue_id) THEN
    RETURN false;
  END IF;
  IF NOT app_private.offers_module_entitled(p_venue_id) THEN
    RETURN false;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.venue_module_settings s
    WHERE s.venue_id = p_venue_id
      AND s.module_key = 'offers'
      AND NOT s.is_enabled
  ) THEN
    RETURN false;
  END IF;
  IF app_private.has_tenant_action_on_venue('create_content', p_venue_id) THEN
    RETURN true;
  END IF;
  RETURN app_private.platform_may_write_tenant(
    (SELECT v.business_id FROM public.venues v WHERE v.id = p_venue_id),
    p_venue_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION app_private.may_submit_offer(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_private.offer_actor_is_venue_operator(p_venue_id)
    AND app_private.subscription_allows_tenant_writes(p_venue_id)
    AND app_private.offers_module_entitled(p_venue_id)
    AND (
      app_private.has_tenant_action_on_venue(
        'submit_content_for_approval',
        p_venue_id
      )
      OR app_private.may_create_offer(p_venue_id)
    );
$$;

REVOKE ALL ON FUNCTION app_private.offer_actor_is_venue_operator(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.may_read_offer_admin(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.may_create_offer(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION app_private.may_submit_offer(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION app_private.may_read_offer_admin(uuid)
  TO authenticated;
