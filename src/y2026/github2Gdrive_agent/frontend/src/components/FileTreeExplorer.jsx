import React, { useState, useMemo } from 'react';
import DocsCategoryViewer from './DocsCategoryViewer.jsx';

// Reusable Circular Character Avatar Icon
const CharAvatar = ({ text, size = 20, bg = 'var(--md-primary-container)', color = 'var(--md-primary)' }) => {
  const char = (text || '?').trim().charAt(0).toUpperCase();
  return (
    <div
      className="circular-avatar"
      style={{
        width: `${size}px`, height: `${size}px`, borderRadius: '50%',
        background: bg, color: color, fontSize: '0.7rem', fontWeight: '700',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, textTransform: 'uppercase'
      }}
    >
      {char}
    </div>
  );
};

export default function FileTreeExplorer({ diffs = [], onSyncSelected }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedYearFilter, setSelectedYearFilter] = useState('ALL');
  const [docsViewMode, setDocsViewMode] = useState('tree'); // 'tree' | 'tiles'
  const [expandedDirs, setExpandedDirs] = useState({});
  const [selectedPaths, setSelectedPaths] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Dynamic top-level category tabs
  const categoryTabs = useMemo(() => {
    const categories = new Set(['All', 'General (Root)']);
    diffs.forEach(d => {
      const parts = d.relative_path.split('/');
      if (parts.length > 1) {
        const topDir = parts[0];
        if (topDir.toLowerCase() === 'docs') categories.add('Docs');
        else if (topDir.toLowerCase() === 'src' || topDir.toLowerCase() === 'backend' || topDir.toLowerCase() === 'frontend') categories.add('Src');
        else categories.add(topDir.charAt(0).toUpperCase() + topDir.slice(1));
      }
    });
    return Array.from(categories);
  }, [diffs]);

  // 2. Extract available Year Ranges for Docs tab
  const yearRanges = useMemo(() => {
    const years = new Set();
    diffs.forEach(d => {
      if (d.relative_path.toLowerCase().startsWith('docs/')) {
        const parts = d.relative_path.split('/');
        if (parts.length > 1) years.add(parts[1]);
      }
    });
    return Array.from(years);
  }, [diffs]);

  // 3. Filter diffs by Category Tab, Year Range Filter, and Search Term
  const filteredDiffs = useMemo(() => {
    let list = diffs;

    if (activeCategory === 'General (Root)') {
      list = list.filter(d => !d.relative_path.includes('/'));
    } else if (activeCategory === 'Docs') {
      list = list.filter(d => d.relative_path.toLowerCase().startsWith('docs/'));
      if (selectedYearFilter !== 'ALL') {
        const yearPrefix = `docs/${selectedYearFilter.toLowerCase()}/`;
        list = list.filter(d => d.relative_path.toLowerCase().startsWith(yearPrefix));
      }
    } else if (activeCategory === 'Src') {
      list = list.filter(d => {
        const lower = d.relative_path.toLowerCase();
        return lower.startsWith('src/') || lower.startsWith('backend/') || lower.startsWith('frontend/');
      });
    } else if (activeCategory !== 'All') {
      const folderPrefix = activeCategory.toLowerCase() + '/';
      list = list.filter(d => d.relative_path.toLowerCase().startsWith(folderPrefix));
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(d => d.relative_path.toLowerCase().includes(term));
    }

    return list;
  }, [diffs, activeCategory, selectedYearFilter, searchTerm]);

  // 4. Build directory tree for current filteredDiffs
  const tree = useMemo(() => {
    const root = { name: '', isDir: true, path: '', children: {}, files: [] };

    filteredDiffs.forEach(file => {
      const parts = file.relative_path.split('/');
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
      current.files.push({ ...file, fileName });
    });

    return root;
  }, [filteredDiffs]);

  const toggleDir = (dirPath) => {
    setExpandedDirs(prev => ({ ...prev, [dirPath]: !prev[dirPath] }));
  };

  const toggleFileSelect = (relPath) => {
    setSelectedPaths(prev => ({ ...prev, [relPath]: !prev[relPath] }));
  };

  const handleToggleGroup = (pathList, selectState) => {
    setSelectedPaths(prev => {
      const next = { ...prev };
      pathList.forEach(p => { next[p] = selectState; });
      return next;
    });
  };

  const handleSelectAll = () => {
    const all = {};
    filteredDiffs.forEach(d => {
      if (d.status !== 'ignored') all[d.relative_path] = true;
    });
    setSelectedPaths(all);
  };

  const handleClearAll = () => {
    setSelectedPaths({});
  };

  const selectedCount = useMemo(() => {
    return Object.values(selectedPaths).filter(Boolean).length;
  }, [selectedPaths]);

  const handleTriggerSync = (dryRun) => {
    const selectedList = Object.keys(selectedPaths).filter(p => selectedPaths[p]);
    onSyncSelected(selectedList, dryRun);
  };

  const getAllChildFilePaths = (node) => {
    let paths = node.files.map(f => f.relative_path);
    Object.values(node.children).forEach(childDir => {
      paths = paths.concat(getAllChildFilePaths(childDir));
    });
    return paths;
  };

  const renderDirectory = (dirNode, depth = 0) => {
    const isExpanded = expandedDirs[dirNode.path] !== false; // default expanded
    const childPaths = getAllChildFilePaths(dirNode);
    const activeChildPaths = childPaths.filter(p => {
      const f = diffs.find(d => d.relative_path === p);
      return f && f.status !== 'ignored';
    });
    const isChecked = activeChildPaths.length > 0 && activeChildPaths.every(p => selectedPaths[p]);
    const isIndeterminate = !isChecked && activeChildPaths.some(p => selectedPaths[p]);

    return (
      <div key={dirNode.path || 'root'}>
        {dirNode.name && (
          <div
            className="tree-row"
            style={{
              paddingLeft: `${depth * 24 + 10}px`,
              fontWeight: '700', padding: '6px 10px',
              background: 'var(--md-surface-variant)',
              borderBottom: '1px solid var(--md-border)',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
            }}
          >
            <span onClick={() => toggleDir(dirNode.path)} style={{ cursor: 'pointer' }}>
              <CharAvatar text={dirNode.name} size={20} bg="var(--md-primary-container)" color="var(--md-primary)" />
            </span>

            <input
              type="checkbox"
              checked={isChecked}
              ref={el => { if (el) el.indeterminate = isIndeterminate; }}
              onChange={() => handleToggleGroup(activeChildPaths, !isChecked)}
              style={{ cursor: 'pointer', width: '15px', height: '15px' }}
            />

            <span onClick={() => toggleDir(dirNode.path)} style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '0.84rem' }}>
              {dirNode.name} <span style={{ fontSize: '0.72rem', color: 'var(--md-text-disabled)' }}>({activeChildPaths.length})</span>
            </span>

            <span></span>
            <span></span>
          </div>
        )}

        {isExpanded && (
          <div>
            {Object.values(dirNode.children).map(childDir => renderDirectory(childDir, depth + 1))}

            {dirNode.files.map(file => {
              const isIgnored = file.status === 'ignored';
              return (
                <div
                  key={file.relative_path}
                  className="tree-row"
                  style={{
                    paddingLeft: `${(depth + (dirNode.name ? 1 : 0)) * 24 + 10}px`,
                    opacity: isIgnored ? 0.5 : 1,
                    padding: '5px 10px',
                    borderBottom: '1px solid var(--md-border)',
                    background: 'var(--md-bg)'
                  }}
                >
                  <CharAvatar text={file.fileName} size={18} bg="var(--md-surface-variant)" color="var(--md-text-secondary)" />

                  <input
                    type="checkbox"
                    disabled={isIgnored}
                    checked={!!selectedPaths[file.relative_path]}
                    onChange={() => toggleFileSelect(file.relative_path)}
                    style={{ cursor: isIgnored ? 'not-allowed' : 'pointer', width: '15px', height: '15px' }}
                  />

                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={file.relative_path}>
                    {file.fileName}
                  </span>

                  <span className={`badge badge-${file.status}`} style={{ justifySelf: 'start', fontSize: '0.68rem', padding: '1px 5px' }}>
                    {file.status.toUpperCase()}
                  </span>

                  <span style={{ fontSize: '0.74rem', color: 'var(--md-text-disabled)', textAlign: 'right' }}>
                    {file.size_bytes} B
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="material-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Category Tabs Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid var(--md-border)', paddingBottom: '8px', overflowX: 'auto' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--md-text-disabled)', fontWeight: '700', textTransform: 'uppercase', marginRight: '4px' }}>
          Category:
        </span>
        {categoryTabs.map(cat => (
          <button
            key={cat}
            className={`category-tab ${activeCategory === cat ? 'active' : ''}`}
            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
            onClick={() => {
              setActiveCategory(cat);
              setSelectedYearFilter('ALL');
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Header controls & action bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, minWidth: '280px' }}>
          <input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1, padding: '6px 12px',
              border: '1px solid var(--md-border)', background: 'var(--md-bg)',
              color: 'var(--md-text-primary)', fontFamily: 'var(--font-sans)', fontSize: '0.82rem'
            }}
          />

          {activeCategory === 'Docs' && (
            <>
              <select
                value={selectedYearFilter}
                onChange={(e) => setSelectedYearFilter(e.target.value)}
                style={{
                  padding: '6px 10px', border: '1px solid var(--md-border)',
                  background: 'var(--md-bg)', color: 'var(--md-text-primary)',
                  fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer'
                }}
              >
                <option value="ALL">All Year Ranges</option>
                {yearRanges.map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>

              <div style={{ display: 'flex', border: '1px solid var(--md-border)', background: 'var(--md-surface-variant)', padding: '2px' }}>
                <button
                  className={`btn btn-sm ${docsViewMode === 'tree' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                  onClick={() => setDocsViewMode('tree')}
                  title="Nested Tree View"
                >
                  Tree View
                </button>
                <button
                  className={`btn btn-sm ${docsViewMode === 'tiles' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                  onClick={() => setDocsViewMode('tiles')}
                  title="Project Tile Grid"
                >
                  Project Tiles
                </button>
              </div>
            </>
          )}

          <button className="btn btn-secondary btn-sm" onClick={handleSelectAll} style={{ padding: '5px 9px', fontSize: '0.75rem' }}>
            Select All
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleClearAll} style={{ padding: '5px 9px', fontSize: '0.75rem' }}>
            Clear
          </button>
        </div>

        {/* Action Group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--md-surface-variant)', padding: '3px', border: '1px solid var(--md-border)' }}>
          <button
            className="btn btn-warning btn-sm"
            disabled={selectedCount === 0}
            onClick={() => handleTriggerSync(true)}
            style={{ opacity: selectedCount === 0 ? 0.5 : 1, padding: '4px 10px', fontSize: '0.76rem' }}
          >
            Dry Run ({selectedCount})
          </button>
          <button
            className="btn btn-success btn-sm"
            disabled={selectedCount === 0}
            onClick={() => handleTriggerSync(false)}
            style={{ opacity: selectedCount === 0 ? 0.5 : 1, padding: '4px 10px', fontSize: '0.76rem' }}
          >
            Sync Selected ({selectedCount})
          </button>
        </div>
      </div>

      {/* Explorer Content View */}
      {activeCategory === 'Docs' && docsViewMode === 'tiles' ? (
        <DocsCategoryViewer
          docsFiles={filteredDiffs}
          selectedPaths={selectedPaths}
          onTogglePath={toggleFileSelect}
          onToggleGroup={handleToggleGroup}
          selectedYearFilter={selectedYearFilter}
        />
      ) : (
        <div style={{
          maxHeight: '520px', overflowY: 'auto', padding: '0',
          border: '1px solid var(--md-border)', background: 'var(--md-bg)',
          position: 'relative'
        }}>
          {filteredDiffs.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--md-text-secondary)', fontSize: '0.84rem' }}>
              No files found in this category.
            </div>
          ) : (
            renderDirectory(tree)
          )}
        </div>
      )}
    </div>
  );
}
