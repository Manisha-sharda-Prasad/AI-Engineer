import React, { useState, useMemo } from 'react';

// Reusable Circular Character Avatar Icon
const CharAvatar = ({ text, size = 22, bg = 'var(--md-primary-container)', color = 'var(--md-primary)' }) => {
  const char = (text || '?').trim().charAt(0).toUpperCase();
  return (
    <div
      className="circular-avatar"
      style={{
        width: `${size}px`, height: `${size}px`, borderRadius: '50%',
        background: bg, color: color, fontSize: size > 30 ? '1.1rem' : '0.72rem', fontWeight: '800',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, textTransform: 'uppercase', boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
      }}
    >
      {char}
    </div>
  );
};

export default function DocsCategoryViewer({
  docsFiles = [],
  selectedPaths = {},
  onTogglePath,
  onToggleGroup,
  selectedYearFilter = 'ALL'
}) {
  const [activeProjectDrawer, setActiveProjectDrawer] = useState(null);
  const [drawerSearch, setDrawerSearch] = useState('');
  const [expandedDrawerDirs, setExpandedDrawerDirs] = useState({});

  // Parse docs structure: docs / <yearRange> / <projectName> / <filePath...>
  const parsedGroups = useMemo(() => {
    const years = {};

    docsFiles.forEach(file => {
      const parts = file.relative_path.split('/');
      const yearRange = parts.length > 1 ? parts[1] : 'General Docs';
      const projectName = parts.length > 2 ? parts[2] : 'Root Files';

      if (!years[yearRange]) years[yearRange] = {};
      if (!years[yearRange][projectName]) years[yearRange][projectName] = [];

      years[yearRange][projectName].push(file);
    });

    return years;
  }, [docsFiles]);

  const visibleGroups = useMemo(() => {
    if (selectedYearFilter === 'ALL') return parsedGroups;
    if (parsedGroups[selectedYearFilter]) {
      return { [selectedYearFilter]: parsedGroups[selectedYearFilter] };
    }
    return {};
  }, [parsedGroups, selectedYearFilter]);

  // Filter project files by search
  const drawerFilteredFiles = useMemo(() => {
    if (!activeProjectDrawer || !activeProjectDrawer.files) return [];
    if (!drawerSearch.trim()) return activeProjectDrawer.files;
    const term = drawerSearch.toLowerCase();
    return activeProjectDrawer.files.filter(f => f.relative_path.toLowerCase().includes(term));
  }, [activeProjectDrawer, drawerSearch]);

  // Project prefix to trim (e.g., "docs/2022-2025/SE_02_system-design/")
  const projectPrefix = useMemo(() => {
    if (!activeProjectDrawer) return '';
    return `docs/${activeProjectDrawer.yearRange}/${activeProjectDrawer.projectName}/`;
  }, [activeProjectDrawer]);

  // Build nested directory tree inside project side drawer
  const drawerTree = useMemo(() => {
    const root = { name: '', isDir: true, path: '', children: {}, files: [] };

    drawerFilteredFiles.forEach(file => {
      let trimmedPath = file.relative_path;
      if (trimmedPath.startsWith(projectPrefix)) {
        trimmedPath = trimmedPath.slice(projectPrefix.length);
      }

      const parts = trimmedPath.split('/');
      let current = root;

      for (let i = 0; i < parts.length - 1; i++) {
        const dirName = parts[i];
        const dirPath = current.path ? `${current.path}/${dirName}` : dirName;
        if (!current.children[dirName]) {
          current.children[dirName] = {
            name: dirName,
            isDir: true,
            path: dirPath,
            children: {},
            files: []
          };
        }
        current = current.children[dirName];
      }

      const fileName = parts[parts.length - 1];
      current.files.push({ ...file, trimmedFileName: fileName, projectRelativePath: trimmedPath });
    });

    return root;
  }, [drawerFilteredFiles, projectPrefix]);

  const toggleDrawerDir = (dirPath) => {
    setExpandedDrawerDirs(prev => ({ ...prev, [dirPath]: !prev[dirPath] }));
  };

  const getDrawerChildFilePaths = (node) => {
    let paths = node.files.map(f => f.relative_path);
    Object.values(node.children).forEach(childDir => {
      paths = paths.concat(getDrawerChildFilePaths(childDir));
    });
    return paths;
  };

  const renderDrawerDirectory = (dirNode, depth = 0) => {
    const isExpanded = expandedDrawerDirs[dirNode.path] !== false; // default expanded
    const childPaths = getDrawerChildFilePaths(dirNode);
    const isChecked = childPaths.length > 0 && childPaths.every(p => selectedPaths[p]);
    const isIndeterminate = !isChecked && childPaths.some(p => selectedPaths[p]);

    return (
      <div key={dirNode.path || 'root'}>
        {dirNode.name && (
          <div
            className="tree-row"
            style={{
              paddingLeft: `${depth * 24 + 14}px`,
              fontWeight: '700', padding: '8px 12px',
              borderBottom: '1px solid var(--md-border)',
              background: 'var(--md-surface-variant)',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
            }}
          >
            <span onClick={() => toggleDrawerDir(dirNode.path)} style={{ cursor: 'pointer' }}>
              <CharAvatar text={dirNode.name} size={20} bg="var(--md-primary-container)" color="var(--md-primary)" />
            </span>

            <input
              type="checkbox"
              checked={isChecked}
              ref={el => { if (el) el.indeterminate = isIndeterminate; }}
              onChange={() => onToggleGroup(childPaths, !isChecked)}
              style={{ cursor: 'pointer', width: '15px', height: '15px' }}
            />

            <span onClick={() => toggleDrawerDir(dirNode.path)} style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.84rem' }}>
              {dirNode.name} <span style={{ fontSize: '0.72rem', color: 'var(--md-text-disabled)' }}>({childPaths.length})</span>
            </span>

            <span></span>
            <span></span>
          </div>
        )}

        {isExpanded && (
          <div>
            {Object.values(dirNode.children).map(childDir => renderDrawerDirectory(childDir, depth + 1))}

            {dirNode.files.map(file => (
              <div
                key={file.relative_path}
                className="tree-row"
                style={{
                  paddingLeft: `${(depth + (dirNode.name ? 1 : 0)) * 24 + 14}px`,
                  padding: '6px 12px', borderBottom: '1px solid var(--md-border)',
                  background: 'var(--md-bg)'
                }}
              >
                <CharAvatar text={file.trimmedFileName} size={18} bg="var(--md-surface)" color="var(--md-text-secondary)" />

                <input
                  type="checkbox"
                  checked={!!selectedPaths[file.relative_path]}
                  onChange={() => onTogglePath(file.relative_path)}
                  style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                />

                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.relative_path}>
                  {file.trimmedFileName}
                </span>

                <span className={`badge badge-${file.status}`} style={{ justifySelf: 'start', fontSize: '0.68rem', padding: '1px 5px' }}>
                  {file.status.toUpperCase()}
                </span>

                <span style={{ fontSize: '0.74rem', color: 'var(--md-text-disabled)', textAlign: 'right' }}>
                  {file.size_bytes} B
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {Object.keys(visibleGroups).length === 0 ? (
        <div className="material-card" style={{ padding: '16px', textAlign: 'center', color: 'var(--md-text-secondary)', fontSize: '0.85rem' }}>
          No documentation files found for the selected year range.
        </div>
      ) : (
        Object.entries(visibleGroups).map(([yearRange, projects]) => (
          <div key={yearRange} className="material-card" style={{ padding: '14px 16px' }}>
            {/* Year Range Group Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', borderBottom: '1px solid var(--md-border)', paddingBottom: '6px' }}>
              <CharAvatar text={yearRange} size={24} bg="var(--md-surface-variant)" color="var(--md-text-primary)" />
              <h3 style={{ fontSize: '0.92rem', fontWeight: '800', letterSpacing: '-0.2px' }}>Year Range: {yearRange}</h3>
              <span className="badge badge-new" style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>
                {Object.values(projects).reduce((sum, p) => sum + p.length, 0)} files
              </span>
            </div>

            {/* Modern Clickable Project Tile Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '12px' }}>
              {Object.entries(projects).map(([projectName, files]) => {
                const allSelected = files.every(f => selectedPaths[f.relative_path]);
                const someSelected = files.some(f => selectedPaths[f.relative_path]);
                const selectedCount = files.filter(f => selectedPaths[f.relative_path]).length;

                return (
                  <div
                    key={projectName}
                    className="project-card-tile"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setActiveProjectDrawer({ yearRange, projectName, files });
                      setDrawerSearch('');
                    }}
                  >
                    {/* Top Right Hover Checkbox */}
                    <input
                      type="checkbox"
                      className={`project-card-checkbox ${!allSelected && someSelected ? 'is-indeterminate' : ''}`}
                      checked={allSelected}
                      ref={el => { if (el) el.indeterminate = !allSelected && someSelected; }}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => onToggleGroup(files.map(f => f.relative_path), !allSelected)}
                      title="Select / Deselect all files in project"
                    />

                    {/* Left 20% Area: Large Circular Avatar Logo */}
                    <div style={{ width: '20%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      <CharAvatar text={projectName} size={48} />
                    </div>

                    {/* Right 80% Area: Content Details */}
                    <div style={{ width: '80%', display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden' }}>
                      <h4 style={{ fontSize: '0.92rem', fontWeight: '800', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {projectName}
                      </h4>

                      <span style={{ fontSize: '0.75rem', color: 'var(--md-text-secondary)' }}>
                        {files.length} documents ({selectedCount} selected)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Dedicated Project Side Drawer Panel */}
      {activeProjectDrawer && (
        <div className="drawer-modal-overlay-right" onClick={() => setActiveProjectDrawer(null)}>
          <div className="drawer-modal-content-right" onClick={(e) => e.stopPropagation()} style={{ width: '960px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--md-border)', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <CharAvatar text={activeProjectDrawer.projectName} size={36} />
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '800' }}>
                    {activeProjectDrawer.projectName}
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--md-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    Project Prefix: <strong style={{ color: 'var(--md-primary)' }}>{projectPrefix}</strong>
                  </span>
                </div>
              </div>
              <button
                onClick={() => setActiveProjectDrawer(null)}
                style={{
                  background: 'transparent', border: 'none', color: 'var(--md-text-secondary)',
                  fontSize: '1.5rem', cursor: 'pointer', padding: '4px'
                }}
              >
                ×
              </button>
            </div>

            {/* Action & Filter Controls Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search documents in project..."
                value={drawerSearch}
                onChange={(e) => setDrawerSearch(e.target.value)}
                style={{
                  flex: 1, minWidth: '220px', padding: '6px 12px',
                  border: '1px solid var(--md-border)', background: 'var(--md-bg)',
                  color: 'var(--md-text-primary)', fontSize: '0.82rem'
                }}
              />

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onToggleGroup(activeProjectDrawer.files.map(f => f.relative_path), true)}
                  style={{ padding: '4px 10px', fontSize: '0.76rem' }}
                >
                  Select All ({activeProjectDrawer.files.length})
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => onToggleGroup(activeProjectDrawer.files.map(f => f.relative_path), false)}
                  style={{ padding: '4px 10px', fontSize: '0.76rem' }}
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Trimmed Project File Tree Explorer View */}
            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--md-border)', background: 'var(--md-bg)', position: 'relative' }}>
              {drawerFilteredFiles.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--md-text-secondary)', fontSize: '0.84rem' }}>
                  No files match your search.
                </div>
              ) : (
                renderDrawerDirectory(drawerTree)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
