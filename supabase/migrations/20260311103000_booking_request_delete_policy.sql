drop policy if exists "Owner loescht Buchungsanfragen" on public.booking_requests;
create policy "Owner loescht Buchungsanfragen"
  on public.booking_requests
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.horses
      where horses.id = booking_requests.horse_id
        and horses.owner_id = auth.uid()
    )
  );
