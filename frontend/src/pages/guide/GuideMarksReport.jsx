import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import * as api from '../../services/api';
import {
  buildMarksReport,
  getTeamRowSpan,
  MARK_COMPONENT_MAX,
  GUIDE_MARKS_REPORT_MAX
} from '../../utils/marksReport';
import '../coordinator/CoordinatorDashboard.css';

const PAGE_SIZE = 10;

// Marks report for a guide's own teams. Shows only the guide's marks for
// PRC-1 and PRC-2 — PRC committee marks are intentionally never shown
// (the backend strips them from this endpoint as well).
function GuideMarksReport() {
  const [report, setReport] = useState({ columns: [], rows: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  const fetchReport = useCallback(async () => {
    try {
      const res = await api.getGuideMarksReport();
      const { batches = [], events = [], submissions = [] } = res.data?.data || {};
      setReport(buildMarksReport(batches, events, submissions));
      setError('');
    } catch (err) {
      console.error('Failed to load guide marks report:', err);
      setError(err.response?.data?.message || 'Unable to load the marks report.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const totalPages = Math.max(1, Math.ceil(report.rows.length / PAGE_SIZE));
  const paginatedRows = useMemo(
    () => report.rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [report.rows, page]
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const downloadReport = () => {
    if (!report.columns.length || !report.rows.length) return;

    const headers = ['Team', 'Project Title', 'Student', 'Roll Number'];
    report.columns.forEach(column => headers.push(`${column.label} (Guide /${column.guideMax})`));
    headers.push(`Total (/${GUIDE_MARKS_REPORT_MAX})`);

    const aoaData = [headers];
    const merges = [];
    let currentRowIdx = 1;

    const teamGroups = {};
    report.rows.forEach(row => {
      const key = row.teamKey || row.teamName;
      if (!teamGroups[key]) teamGroups[key] = [];
      teamGroups[key].push(row);
    });

    Object.values(teamGroups).forEach(groupRows => {
      const startRow = currentRowIdx;
      groupRows.forEach(row => {
        const record = [row.teamName, row.projectTitle || 'Not Assigned', row.memberName, row.rollNumber];
        report.columns.forEach(column => record.push(row[column.guideKey] ?? 0));
        record.push(row.guideTotal ?? 0);
        aoaData.push(record);
        currentRowIdx++;
      });
      if (groupRows.length > 1) {
        const endRow = startRow + groupRows.length - 1;
        merges.push({ s: { r: startRow, c: 0 }, e: { r: endRow, c: 0 } });
        merges.push({ s: { r: startRow, c: 1 }, e: { r: endRow, c: 1 } });
      }
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(aoaData);
    worksheet['!merges'] = merges;
    worksheet['!cols'] = [
      { wch: 18 }, { wch: 35 }, { wch: 22 }, { wch: 16 },
      ...report.columns.map(() => ({ wch: 18 })),
      { wch: 12 }
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Guide Marks');
    XLSX.writeFile(workbook, 'Project_Sphere_Guide_Marks_Report.xlsx');
  };

  if (loading) {
    return (
      <div className="tab-content">
        <div className="card loading"><h3>Loading marks report...</h3></div>
      </div>
    );
  }

  return (
    <div className="tab-content">
      <div className="section-header coordinator-teams-header">
        <div>
          <h2>Marks Report</h2>
          <p>Guide marks awarded to each student of your teams for PRC-1 and PRC-2.</p>
        </div>
        <button className="btn btn-primary" onClick={downloadReport} disabled={!report.rows.length}>
          Download Excel
        </button>
      </div>

      {error && <div className="coordinator-error">{error}</div>}

      <div className="coordinator-marks-card">
        {report.columns.length === 0 ? (
          <div className="coordinator-empty-state">
            <h3>No PRC milestones yet</h3>
            <p>Once PRC-1 / PRC-2 timeline events exist for your teams, the marks you award will appear here.</p>
          </div>
        ) : (
          <div className="table-container marks-table-container">
            <table className="data-table coordinator-marks-table">
              <colgroup>
                <col className="marks-team-column" />
                <col className="marks-student-column" />
                <col className="marks-roll-column" />
                {report.columns.map(column => <col key={`${column.key}-width`} className="marks-score-column" />)}
                <col className="marks-total-column" />
              </colgroup>
              <thead>
                <tr>
                  <th rowSpan="2">Team</th>
                  <th rowSpan="2">Student</th>
                  <th rowSpan="2">Roll No</th>
                  {report.columns.map(column => (
                    <th className={`marks-group-header marks-group-${column.key}`} key={column.key}>
                      {column.label}
                    </th>
                  ))}
                  <th className="marks-grand-total-header" rowSpan="2">
                    Total<br /><span className="marks-subtext">/{GUIDE_MARKS_REPORT_MAX}</span>
                  </th>
                </tr>
                <tr>
                  {report.columns.map(column => (
                    <th className="marks-group-start" key={`${column.key}-sub`}>
                      Guide<br /><span className="marks-subtext">/{MARK_COMPONENT_MAX}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedRows.length === 0 ? (
                  <tr><td colSpan={4 + report.columns.length}>No team data found.</td></tr>
                ) : (
                  paginatedRows.map((row, index) => {
                    const isTeamStart = index === 0 || paginatedRows[index - 1].teamKey !== row.teamKey;
                    return (
                      <tr className={isTeamStart ? 'marks-team-start' : ''} key={`${row.teamKey}-${row.studentId}-${index}`}>
                        {isTeamStart && (
                          <td className="marks-team-cell" rowSpan={getTeamRowSpan(paginatedRows, index)}>
                            <span>{row.teamName}</span>
                          </td>
                        )}
                        <td>{row.memberName}</td>
                        <td>{row.rollNumber}</td>
                        {report.columns.map(column => (
                          <td className="marks-cell marks-group-start" key={`${row.teamKey}-${row.studentId}-${column.key}`}>
                            <span className={`marks-value marks-value-${column.key} ${row[column.guideKey] > 0 ? 'marks-positive' : 'marks-neutral'}`}>
                              {row[column.guideKey] ?? 0}
                            </span>
                          </td>
                        ))}
                        <td className="marks-total-cell"><strong>{row.guideTotal ?? 0}</strong></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {report.rows.length > PAGE_SIZE && (
              <div className="marks-pagination">
                <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage(prev => Math.max(1, prev - 1))}>
                  Previous
                </button>
                <span>{page} / {totalPages}</span>
                <button className="btn btn-secondary" disabled={page >= totalPages} onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}>
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default GuideMarksReport;
