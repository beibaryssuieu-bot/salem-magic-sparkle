
CREATE POLICY reports_obj_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'reports' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY reports_obj_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'reports' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY reports_obj_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'reports' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));

CREATE POLICY eduqor_obj_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'eduqor');
CREATE POLICY eduqor_obj_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'eduqor' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY eduqor_obj_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'eduqor' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));
