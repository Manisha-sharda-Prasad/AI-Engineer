import React, { useState, useEffect } from 'react';
import MaterialDrawer from './components/MaterialDrawer.jsx';
import DashboardPage from './components/DashboardPage.jsx';
import ReposPage from './components/ReposPage.jsx';
import SettingsPage from './components/SettingsPage.jsx';
import AddRepoModal from './components/AddRepoModal.jsx';
import ConfirmModal from './components/ConfirmModal.jsx';

export default function App() {
  const [state, setState] = useState(null);
  const [activePage, setActivePage] = useState('dashboard'); // 'dashboard' | 'repos' | 'settings'
  const [selectedRepoId, setSelectedRepoId] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  const [isAddRepoOpen, setIsAddRepoOpen] = useState(false);
  const [activeDiffData, setActiveDiffData] = useState(null);
  const [activeJob, setActiveJob] = useState(null);
  const [loadingDiff, setLoadingDiff] = useState(false);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    confirmVariant: 'btn-primary',
    onConfirm: () => {}
  });

  // Apply Theme to document root
  useEffect(() => {
    localStorage.setItem('theme', theme);
    let appliedTheme = theme;
    if (theme === 'system') {
      appliedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', appliedTheme);
  }, [theme]);

  // Fetch agent state
  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        setState(data);
        if (data.repos && data.repos.length > 0 && !selectedRepoId) {
          setSelectedRepoId(data.repos[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch state:', err);
    }
  };

  useEffect(() => {
    fetchState();
  }, []);

  // Fetch diff data for selected repository
  const fetchDiffForSelectedRepo = async (repoId) => {
    if (!repoId) return;
    setLoadingDiff(true);
    try {
      const res = await fetch(`/api/repos/${repoId}/diff`);
      if (res.ok) {
        const data = await res.json();
        setActiveDiffData(data);
      }
    } catch (err) {
      console.error('Error fetching diff:', err);
    } finally {
      setLoadingDiff(false);
    }
  };

  useEffect(() => {
    if (selectedRepoId) {
      fetchDiffForSelectedRepo(selectedRepoId);
    }
  }, [selectedRepoId]);

  // Poll active job status while job is running or queued
  useEffect(() => {
    if (!activeJob || (activeJob.status !== 'running' && activeJob.status !== 'queued')) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${activeJob.job_id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'completed' || data.status === 'failed') {
            clearInterval(interval);
            setActiveJob(data);
            fetchState();
            if (selectedRepoId) fetchDiffForSelectedRepo(selectedRepoId);
          } else {
            setActiveJob(data);
          }
        }
      } catch (err) {
        console.error('Error polling job status:', err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [activeJob?.job_id, activeJob?.status, selectedRepoId]);


  // Navigation handlers
  const handleNavigateToRepo = (repoId) => {
    setSelectedRepoId(repoId);
    setActivePage('repos');
  };

  const handleAddRepo = async (repoData) => {
    try {
      const res = await fetch('/api/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(repoData)
      });
      if (res.ok) {
        const data = await res.json();
        await fetchState();
        setSelectedRepoId(data.repo.id);
        setActivePage('repos');
      }
    } catch (err) {
      alert('Error adding repository: ' + err.message);
    }
  };

  // Perform Delete Execution
  const executeDeleteRepo = async (repoId) => {
    try {
      const res = await fetch(`/api/repos/${repoId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchState();
        const remaining = (state?.repos || []).filter(r => r.id !== repoId);
        setSelectedRepoId(remaining[0]?.id || null);
      }
    } catch (err) {
      alert('Error deleting repository: ' + err.message);
    }
  };

  // Delete Confirmation Trigger
  const handleDeleteRepo = (repoId) => {
    const targetRepo = (state?.repos || []).find(r => r.id === repoId);
    const repoName = targetRepo ? targetRepo.name : 'this repository';

    setConfirmModal({
      isOpen: true,
      title: 'Delete Repository',
      message: `Are you sure you want to delete repository "${repoName}"? This will remove its sync configuration from the agent.`,
      confirmText: 'Delete Repository',
      confirmVariant: 'btn-danger',
      onConfirm: () => executeDeleteRepo(repoId)
    });
  };

  // Perform Sync Execution
  const executeSync = async (repoId, dryRun, selectedFiles) => {
    const targetRepo = (state?.repos || []).find(r => r.id === repoId);
    if (!targetRepo) return;

    try {
      const payload = {
        repo_id: targetRepo.id,
        dry_run: dryRun,
        selected_files: selectedFiles
      };
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setActiveJob(data.job);
        setSelectedRepoId(repoId);
        setActivePage('repos');
      }
    } catch (err) {
      alert('Error launching sync: ' + err.message);
    }
  };

  // Sync Confirmation Trigger
  const handleTriggerSync = (repoId, dryRun = false, selectedFiles = null) => {
    const targetRepo = (state?.repos || []).find(r => r.id === repoId);
    const repoName = targetRepo ? targetRepo.name : 'Selected Repository';
    const countText = selectedFiles && selectedFiles.length > 0 ? `${selectedFiles.length} selected file(s)` : 'all pending files';
    const actionType = dryRun ? 'Dry Run' : 'Full Sync';

    setConfirmModal({
      isOpen: true,
      title: `Confirm ${actionType}`,
      message: `Are you sure you want to launch a ${actionType} for "${repoName}" (${countText})? ${dryRun ? 'This will simulate the sync without modifying files in Google Drive.' : 'This will upload modified files directly to Google Drive.'}`,
      confirmText: `Start ${actionType}`,
      confirmVariant: dryRun ? 'btn-warning' : 'btn-primary',
      onConfirm: () => executeSync(repoId, dryRun, selectedFiles)
    });
  };

  const handleSaveSettings = async (updatedConfig) => {
    try {
      const updatedState = { ...state, ...updatedConfig };
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedState)
      });
      if (res.ok) fetchState();
    } catch (err) {
      alert('Error saving settings: ' + err.message);
    }
  };

  const handleUploadCredentials = async (file) => {
    try {
      const text = await file.text();
      const jsonContent = JSON.parse(text);

      const res = await fetch('/api/gdrive/upload-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jsonContent)
      });
      if (res.ok) {
        alert('Service Account JSON uploaded successfully!');
        fetchState();
      } else {
        const err = await res.json();
        alert('Upload failed: ' + err.detail);
      }
    } catch (err) {
      alert('Upload failed: Invalid JSON file - ' + err.message);
    }
  };


  return (
    <div className="app-layout">
      {/* Master Collapsible Side Drawer */}
      <MaterialDrawer
        activePage={activePage}
        onNavigate={(page) => setActivePage(page)}
        onOpenAddRepo={() => setIsAddRepoOpen(true)}
        theme={theme}
        onThemeChange={(t) => setTheme(t)}
        repoCount={state?.repos?.length || 0}
      />

      {/* Main Content View */}
      <main className="main-content">
        {activePage === 'dashboard' && (
          <DashboardPage
            state={state}
            onNavigateToRepo={handleNavigateToRepo}
            onTriggerSync={handleTriggerSync}
            onOpenAddRepo={() => setIsAddRepoOpen(true)}
          />
        )}

        {activePage === 'repos' && (
          <ReposPage
            state={state}
            selectedRepoId={selectedRepoId}
            onSelectRepo={(id) => setSelectedRepoId(id)}
            onTriggerSync={handleTriggerSync}
            onDeleteRepo={handleDeleteRepo}
            onSaveSettings={handleSaveSettings}
            onUploadCredentials={handleUploadCredentials}
            activeDiffData={activeDiffData}
            loadingDiff={loadingDiff}
            activeJob={activeJob}
          />
        )}


        {activePage === 'settings' && (
          <SettingsPage
            state={state}
            onSaveConfig={handleSaveSettings}
            onUploadCredentials={handleUploadCredentials}
          />
        )}
      </main>

      <AddRepoModal
        isOpen={isAddRepoOpen}
        onClose={() => setIsAddRepoOpen(false)}
        onAdd={handleAddRepo}
      />

      {/* Modern Confirmation Modal for Sync and Delete Actions */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        confirmVariant={confirmModal.confirmVariant}
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
