async function createClient(form) {
    // Create auth user via Supabase Admin (invite flow)
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(form.email, {
      data: { full_name: form.full_name, role: 'client' }
    });

    if (error) {
      // Fallback: create profile only if user exists
      alert(`Note: ${error.message}. If the client already has an account, their profile will be linked on first login.`);
      return;
    }

    if (data?.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: form.full_name,
        email: form.email,
        role: 'client',
        phone: form.phone || null,
        date_of_birth: form.date_of_birth || null,
        gdpr_consent: true,
        gdpr_consent_date: new Date().toISOString(),
      });

      await fetchClients();
      onStatsChange?.();
    }
  }