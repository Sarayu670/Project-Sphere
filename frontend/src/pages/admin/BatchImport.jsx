import { useState } from 'react';
import * as XLSX from 'xlsx';
import * as api from '../../services/api';
import { downloadBatchExcelTemplate } from '../../utils/batchExcelTemplate';

const YEARS = ['2nd', '3rd', '4th'];
const BRANCHES = ['CSE', 'IT', 'ECE', 'CSM', 'EEE', 'CSD', 'ETM'];
const SECTIONS = ['A', 'B', 'C', 'D', 'E'];

function BatchImport({ onImportComplete, onCancel }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importStatus, setImportStatus] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls') && !selectedFile.name.endsWith('.csv')) {
      setError('Please upload an Excel file (.xlsx, .xls) or CSV file');
      setFile(null);
      setPreview([]);
      return;
    }

    setError('');
    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        setPreview(jsonData.slice(0, 5));
      } catch (err) {
        setError('Error reading file: ' + err.message);
        setFile(null);
        setPreview([]);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const parseClass = (classStr) => {
    if (!classStr) return null;
    const parts = classStr.trim().split(/\s+/);
    // Expected format: "3rd CSE B"
    if (parts.length < 3) return null;

    const year = parts[0];
    const branch = parts[1];
    const section = parts[2];

    if (!YEARS.includes(year) || !BRANCHES.includes(branch) || !SECTIONS.includes(section)) {
      return null;
    }

    return { year, branch, section };
  };

  const parseMembers = (membersStr) => {
    if (!membersStr) return [];
    // Format: "Name1 (Roll1), Name2 (Roll2)"
    const memberParts = membersStr.split(',').map(m => m.trim());
    const members = [];

    for (const part of memberParts) {
      const match = part.match(/(.+?)\s*\((.+?)\)/);
      if (match) {
        members.push({
          name: match[1].trim(),
          rollNo: match[2].trim()
        });
      }
    }
    return members;
  };

  const handleImport = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setLoading(true);
    setError('');
    setImportStatus('');

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = event.target.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          if (jsonData.length === 0) {
            setError('No data found in Excel file');
            setLoading(false);
            return;
          }

          const batchesToImport = [];
          const errors = [];

          jsonData.forEach((row, index) => {
            const teamName = row['Team Name'] || row['team name'] || '';
            const membersStr = row['Team Members Names and RollNos'] || row['members'] || '';
            const classStr = row['Class'] || row['class'] || '';

            const classInfo = parseClass(classStr);
            const members = parseMembers(membersStr);

            if (!teamName || !classInfo || members.length === 0) {
              errors.push(`Row ${index + 1}: Invalid data`);
              return;
            }

            batchesToImport.push({
              teamName,
              members,
              ...classInfo
            });
          });

          if (errors.length > 0 && batchesToImport.length === 0) {
            setError(`Failed to parse data: ${errors.join(', ')}`);
            setLoading(false);
            return;
          }

          const response = await api.importBatches({ batches: batchesToImport });
          const { success, failed, errors: importErrors } = response.data.data;

          if (failed > 0) {
            const errorMsgs = importErrors.map(e => `${e.team}: ${e.error}`).join('; ');
            setImportStatus(`Imported ${success} batches. ${failed} failed. Errors: ${errorMsgs}`);
          } else {
            setImportStatus(`✅ Successfully imported ${success} batches!`);
          }

          if (success > 0) {
            setTimeout(() => {
              onImportComplete();
            }, 3000);
          } else {
            setLoading(false);
          }
        } catch (err) {
          setError('Error processing file: ' + err.message);
          setLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      setError('Error: ' + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: '20px', backgroundColor: '#f8f9fa' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3>👥 Import Student Batches from Excel</h3>
        <span style={{ fontSize: '12px', color: '#666' }}>Supported: .xlsx, .xls, .csv</span>
      </div>

      {error && (
        <div style={{ padding: '12px', marginBottom: '15px', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px', color: '#c33' }}>
          {error}
        </div>
      )}

      {importStatus && (
        <div style={{ padding: '12px', marginBottom: '15px', backgroundColor: '#efe', border: '1px solid #cfc', borderRadius: '4px', color: '#3a3' }}>
          {importStatus}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <button type="button" className="btn btn-secondary" onClick={downloadBatchExcelTemplate} style={{ backgroundColor: '#28a745' }}>
          📥 Download Template
        </button>
      </div>

      <div style={{ border: '2px dashed #667eea', padding: '20px', textAlign: 'center', borderRadius: '8px', marginBottom: '20px', cursor: 'pointer', backgroundColor: file ? '#f0f4ff' : '#fff' }}>
        <input type="file" onChange={handleFileChange} accept=".xlsx,.xls,.csv" style={{ display: 'none' }} id="batch-file-input" disabled={loading} />
        <label htmlFor="batch-file-input" style={{ cursor: 'pointer', display: 'block' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>📁</div>
          <p style={{ margin: '0 0 8px 0', fontWeight: '500' }}>
            {file ? `Selected: ${file.name}` : 'Click to select or drag Excel file'}
          </p>
          <p style={{ margin: 0, color: '#888', fontSize: '12px' }}>
            Columns: Team Name, Team Members Names and RollNos, Class
          </p>
        </label>
      </div>

      {preview.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h4>Preview:</h4>
          <div style={{ overflowX: 'auto', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px', padding: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f0f0f0' }}>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Team Name</th>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Members</th>
                  <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Class</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px' }}>{row['Team Name'] || row['team name'] || '-'}</td>
                    <td style={{ padding: '8px' }}>{String(row['Team Members Names and RollNos'] || row['members'] || '-').substring(0, 50)}...</td>
                    <td style={{ padding: '8px' }}>{row['Class'] || row['class'] || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={handleImport} disabled={!file || loading}>
          {loading ? '⏳ Importing...' : '📤 Import Batches'}
        </button>
      </div>
    </div>
  );
}

export default BatchImport;
