'use client';

import WorkspaceSwitch from './workspace-switch';
import { useWorkspaceRole } from './hooks/useWorkspaceRole';
import BlueprintA from '../blueprints/a/BlueprintA';
import BlueprintB from '../blueprints/b/BlueprintB';

/** Unified workspace shell that renders the appropriate blueprint based on role */
export default function AppShell() {
  const role = useWorkspaceRole();

  // Example workspace list – in real app this would be fetched from API/context
  const workspaces = [
    { id: 'PEMBUDIDAYA', name: 'Pembudidaya' },
    { id: 'DISTRIBUTOR', name: 'Distributor' },
  ];

  const handleWorkspaceChange = (id: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('tumbu_active_blueprint', id);
      // Simplest way to apply the new role – reload page
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header with workspace switcher */}
      <header className="bg-gray-800 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold">TUMBU App</h1>
        <WorkspaceSwitch
          workspaces={workspaces}
          value={
            typeof window !== 'undefined'
              ? localStorage.getItem('tumbu_active_blueprint') || 'PEMBUDIDAYA'
              : 'PEMBUDIDAYA'
          }
          onChange={handleWorkspaceChange}
        />
      </header>

      {/* Main content */}
      <main className="flex-1 p-4">
        {role === 'a' ? <BlueprintA /> : <BlueprintB />}
      </main>
    </div>
  );
}
