// supabase.js — Sistema Bússola
const supabase = window.supabase.createClient(
  'https://whbikqoslxlgdxawqoal.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndoYmlrcW9zbHhsZ2R4YXdxb2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA5ODQ2NzEsImV4cCI6MjA2NjU2MDY3MX0.nI2hECPnxF-IxVNvwfURJhtHTxjBlLnXgSJId1l0di0',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  }
);