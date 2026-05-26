create or replace function public.persist_reconciliation(
  p_shift_id   uuid,
  p_tank_lines jsonb,
  p_pump_lines jsonb
) returns void
language plpgsql
security definer
as $$
declare
  v_rec_id uuid;
begin
  insert into public.reconciliations (shift_id, updated_at)
  values (p_shift_id, now())
  on conflict (shift_id) do update set updated_at = now()
  returning id into v_rec_id;

  delete from public.reconciliation_tank_lines where reconciliation_id = v_rec_id;
  insert into public.reconciliation_tank_lines (
    reconciliation_id, tank_id, opening_dip, deliveries_received,
    meter_delta, expected_closing_dip, actual_closing_dip, variance_litres
  )
  select
    v_rec_id,
    (line->>'tank_id')::uuid,
    (line->>'opening_dip')::numeric,
    (line->>'deliveries_received')::numeric,
    (line->>'meter_delta')::numeric,
    (line->>'expected_closing_dip')::numeric,
    (line->>'actual_closing_dip')::numeric,
    (line->>'variance_litres')::numeric
  from jsonb_array_elements(p_tank_lines) as line;

  delete from public.reconciliation_pump_lines where reconciliation_id = v_rec_id;
  insert into public.reconciliation_pump_lines (
    reconciliation_id, pump_id, fuel_grade_id, meter_delta_litres,
    pos_litres_sold, variance_litres, sell_price_per_litre,
    expected_revenue_zar, pos_revenue_zar, variance_zar
  )
  select
    v_rec_id,
    (line->>'pump_id')::uuid,
    line->>'fuel_grade_id',
    (line->>'meter_delta_litres')::numeric,
    (line->>'pos_litres_sold')::numeric,
    (line->>'variance_litres')::numeric,
    (line->>'sell_price_per_litre')::numeric,
    (line->>'expected_revenue_zar')::numeric,
    (line->>'pos_revenue_zar')::numeric,
    (line->>'variance_zar')::numeric
  from jsonb_array_elements(p_pump_lines) as line;
end;
$$;

grant execute on function public.persist_reconciliation(uuid, jsonb, jsonb)
  to service_role;
