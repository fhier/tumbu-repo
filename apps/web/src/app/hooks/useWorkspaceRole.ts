import { useEffect, useState } from 'react';

/**
 * Determines the active blueprint based on the current workspace context.
 * Returns 'a' for Pembudidaya (Blueprint A) and 'b' for Distributor (Blueprint B).
 */
export function useWorkspaceRole() {
  const [role, setRole] = useState<'a' | 'b'>('a');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('tumbu_active_blueprint') : null;
    if (stored === 'DISTRIBUTOR') {
      setRole('b');
    } else if (stored === 'PEMBUDIDAYA') {
      setRole('a');
    } else {
      setRole('a');
    }
  }, []);

  return role;
}
