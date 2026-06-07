CREATE OR REPLACE FUNCTION public.tg_rep_checkin_attendance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.attendance (employee_id, date, status, check_in, notes)
  VALUES (NEW.employee_id, NEW.check_in_at::date, 'present', NEW.check_in_at, 'rep check-in')
  ON CONFLICT (employee_id, date) DO UPDATE
    SET status = 'present', check_in = COALESCE(public.attendance.check_in, EXCLUDED.check_in);
  RETURN NEW;
END $function$;