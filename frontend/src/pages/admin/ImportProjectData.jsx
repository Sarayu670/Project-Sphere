import { useState } from 'react';
import { downloadProjectExcelTemplate } from '../../utils/downloadProjectExcelTemplate';
import * as api from '../../services/api';
import ConfirmationDialog from '../../components/ConfirmationDialog';

function ImportProjectData() {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [filters, setFilters] = useState({
        year: 'all',
        branch: 'all',
        section: 'all',
        projectType: ''
    });
    const [dialog, setDialog] = useState({ isOpen: false, title: '', message: '', type: 'info' });

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        setFiles(selectedFiles);
    };

    const handleImport = async (e) => {
        e.preventDefault();
        if (files.length === 0) {
            showDialog('Error', 'Please select at least one Excel file', 'danger');
            return;
        }

        setLoading(true);
        try {
            const response = await api.importProjectExcelFiles(files, filters);
            setResults(response.data.data);
            showDialog('Success', response.data.message, 'success');
            setFiles([]);
            if (e.target.fileInput) e.target.fileInput.value = '';
        } catch (error) {
            showDialog('Error', error.response?.data?.message || 'Failed to import Excel files', 'danger');
        } finally {
            setLoading(false);
        }
    };

    const showDialog = (title, message, type = 'info') => {
        setDialog({
            isOpen: true,
            title,
            message,
            type,
            onConfirm: () => setDialog({ ...dialog, isOpen: false })
        });
    };

    return (
        <div>
            <div className="card" style={{ padding: '24px', maxWidth: '1200px', width: '100%', margin: '0 auto' }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                    paddingBottom: '18px',
                    marginBottom: '20px',
                    borderBottom: '1px solid #e2e8f0'
                }}>
                    <div>
                        <h2 style={{ margin: 0, color: '#1e3a8a', fontSize: '22px' }}>Import Project Batches</h2>
                        <p style={{ margin: '5px 0 0', color: '#718096', fontSize: '14px' }}>
                            Select the batch details and upload Excel files.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ backgroundColor: '#28a745', color: 'white', borderColor: '#28a745' }}
                        onClick={downloadProjectExcelTemplate}
                    >
                        Download Template
                    </button>
                </div>

                <form onSubmit={handleImport}>
                    <div style={{ marginBottom: '20px', padding: '18px', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                        <h3 style={{ margin: '0 0 14px', color: '#2d3748', fontSize: '16px' }}>
                            Batch details
                        </h3>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                            gap: '14px'
                        }}>
                            <label style={{ color: '#2d3748', fontSize: '14px', fontWeight: 500 }}>
                                Academic Year
                                <select
                                    value={filters.year}
                                    onChange={e => setFilters({ ...filters, year: e.target.value })}
                                    disabled={loading}
                                    style={{ display: 'block', width: '100%', marginTop: '6px', padding: '10px', border: '1px solid #cbd5e0', borderRadius: '6px' }}
                                >
                                    <option value="all">All Years</option>
                                    <option value="2nd">2nd Year</option>
                                    <option value="3rd">3rd Year</option>
                                    <option value="4th">4th Year</option>
                                </select>
                            </label>
                            <label style={{ color: '#2d3748', fontSize: '14px', fontWeight: 500 }}>
                                Branch
                                <select
                                    value={filters.branch}
                                    onChange={e => setFilters({ ...filters, branch: e.target.value })}
                                    disabled={loading}
                                    style={{ display: 'block', width: '100%', marginTop: '6px', padding: '10px', border: '1px solid #cbd5e0', borderRadius: '6px' }}
                                >
                                    <option value="all">All Branches</option>
                                    {['CSE', 'IT', 'ECE', 'CSM', 'EEE', 'CSD', 'ETM'].map(branch => (
                                        <option key={branch} value={branch}>{branch}</option>
                                    ))}
                                </select>
                            </label>
                            <label style={{ color: '#2d3748', fontSize: '14px', fontWeight: 500 }}>
                                Section
                                <select
                                    value={filters.section}
                                    onChange={e => setFilters({ ...filters, section: e.target.value })}
                                    disabled={loading}
                                    style={{ display: 'block', width: '100%', marginTop: '6px', padding: '10px', border: '1px solid #cbd5e0', borderRadius: '6px' }}
                                >
                                    <option value="all">All Sections</option>
                                    {['A', 'B', 'C', 'D', 'E'].map(section => (
                                        <option key={section} value={section}>Section {section}</option>
                                    ))}
                                </select>
                            </label>
                            <label style={{ color: '#2d3748', fontSize: '14px', fontWeight: 500 }}>
                                Project Type
                                <select
                                    value={filters.projectType}
                                    onChange={e => setFilters({ ...filters, projectType: e.target.value })}
                                    disabled={loading}
                                    required
                                    style={{ display: 'block', width: '100%', marginTop: '6px', padding: '10px', border: '1px solid #cbd5e0', borderRadius: '6px' }}
                                >
                                    <option value="">Select project type</option>
                                    <option value="Mini Project 1">Mini Project 1</option>
                                    <option value="Mini Project 2">Mini Project 2</option>
                                    <option value="Major Project">Major Project</option>
                                </select>
                            </label>
                        </div>
                    </div>
                    <div style={{ marginBottom: '18px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#2d3748' }}>
                            Excel files <span style={{ fontWeight: 400, color: '#718096' }}>(up to 10)</span>
                        </label>
                        <input
                            type="file"
                            ref={(ref) => { if (ref) ref.id = 'fileInput'; }}
                            accept=".xlsx,.xls"
                            multiple
                            onChange={handleFileChange}
                            style={{
                                display: 'block',
                                width: '100%',
                                padding: '14px',
                                border: '1px solid #cbd5e0',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                boxSizing: 'border-box'
                            }}
                        />
                        {files.length > 0 && (
                            <div style={{ marginTop: '10px', color: '#4a5568', fontSize: '13px' }}>
                                <span style={{ color: '#276749', fontWeight: 600 }}>{files.length} file(s) selected</span>
                                <ul style={{ margin: '6px 0 0', paddingLeft: '20px', lineHeight: 1.6 }}>
                                    {files.map((file, index) => (
                                        <li key={index}>{file.name}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading || files.length === 0}
                        className="btn btn-primary"
                        style={{ minWidth: '180px', opacity: loading || files.length === 0 ? 0.6 : 1 }}
                    >
                        {loading ? 'Importing...' : `Import ${files.length} File(s)`}
                    </button>
                </form>

                {results && (
                    <div style={{ marginTop: '24px', padding: '16px', background: '#f7fafc', borderRadius: '8px' }}>
                        <h4 style={{ marginBottom: '16px', color: '#2d3748' }}>📊 Import Results</h4>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ padding: '12px', background: '#d4edda', borderRadius: '6px' }}>
                                <p style={{ fontSize: '12px', color: '#155724', marginBottom: '4px' }}>Success</p>
                                <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#155724' }}>{results.success}</p>
                            </div>
                            <div style={{ padding: '12px', background: '#f8d7da', borderRadius: '6px' }}>
                                <p style={{ fontSize: '12px', color: '#721c24', marginBottom: '4px' }}>Failed</p>
                                <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#721c24' }}>{results.failed}</p>
                            </div>
                        </div>

                        {results.errors && results.errors.length > 0 && (
                            <div style={{ marginTop: '12px' }}>
                                <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#e53e3e' }}>
                                    ✗ File Processing Errors:
                                </p>
                                <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '12px', background: 'white', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                    {results.errors.map((err, i) => (
                                        <p key={i} style={{ fontSize: '12px', color: '#e53e3e', marginBottom: '6px', lineHeight: '1.4' }}>
                                            <strong>{err.file || 'Unknown file'}</strong>: {err.error}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}

                        {results.warnings && results.warnings.length > 0 && (
                            <div style={{ marginTop: '12px' }}>
                                <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', color: '#ff9800' }}>
                                    ⚠ Record Warnings:
                                </p>
                                <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '12px', background: 'white', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                    {results.warnings.map((warn, i) => (
                                        <p key={i} style={{ fontSize: '12px', color: '#ff9800', marginBottom: '8px', lineHeight: '1.4' }}>
                                            <strong>{warn.teamName || 'Unknown team'}</strong> - {warn.projectTitle || 'No title'}
                                            <br />
                                            <span style={{ fontSize: '11px' }}>
                                                {warn.errors?.join(', ') || 'Unknown error'}
                                            </span>
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <ConfirmationDialog
                isOpen={dialog.isOpen}
                title={dialog.title}
                message={dialog.message}
                type={dialog.type}
                onConfirm={() => setDialog({ ...dialog, isOpen: false })}
                confirmText="OK"
            />
        </div>
    );
}

export default ImportProjectData;
