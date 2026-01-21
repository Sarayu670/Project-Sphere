import React, { useState, useEffect } from 'react';
import * as api from '../services/api';
import './COEandRCManagement.css';

function COEandRCManagement() {
const [activeSubTab, setActiveSubTab] = useState('coe');
const [coes, setCOEs] = useState([]);
const [rcs, setRCs] = useState([]);
const [projects, setProjects] = useState([]);
const [loading, setLoading] = useState(true);
const [showModal, setShowModal] = useState(false);
const [formData, setFormData] = useState({ name: '' });
const [saving, setSaving] = useState(false);
const [editingId, setEditingId] = useState(null);
const [notification, setNotification] = useState(null);
const [selectedCOEId, setSelectedCOEId] = useState(null);
const [selectedRCId, setSelectedRCId] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [coesRes, rcsRes, batchesRes] = await Promise.all([
        api.getAllCOEs(),
        api.getAllRCs(),
        api.getAllBatches()  // This returns batches with full COE/RC info
      ]);
      
      const coesData = coesRes.data.data || [];
      const rcsData = rcsRes.data.data || [];
      const batchesData = batchesRes.data.data || [];
      
      console.log('?? Fetched Data:');
      console.log('COEs:', coesData);
      console.log('RCs:', rcsData);
      console.log('Batches with COE/RC:', batchesData);
      
      setCOEs(coesData);
      setRCs(rcsData);
      // Store batches as projects since they contain all project info
      setProjects(batchesData);
    } catch (error) {
      showNotification('Failed to fetch data', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({ name: '' });
    setEditingId(null);
  };

  // COE Functions
  const handleCreateCOE = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showNotification('COE name is required', 'error');
      return;
    }

    setSaving(true);
    try {
      await api.createCOE({ name: formData.name });
      showNotification('COE created successfully', 'success');
      resetForm();
      setShowModal(false);
      fetchData();
    } catch (error) {
      showNotification(error.response?.data?.message || 'Failed to create COE', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCOE = async (id) => {
    if (window.confirm('Are you sure you want to delete this COE?')) {
      try {
        await api.deleteCOE(id);
        showNotification('COE deleted successfully', 'success');
        fetchData();
      } catch (error) {
        showNotification('Failed to delete COE', 'error');
      }
    }
  };

  // RC Functions
  const handleCreateRC = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showNotification('Research Center name is required', 'error');
      return;
    }

    setSaving(true);
    try {
      await api.createRC({
        name: formData.name
      });
      showNotification('Research Center created successfully', 'success');
      resetForm();
      setShowModal(false);
      fetchData();
    } catch (error) {
      showNotification(error.response?.data?.message || 'Failed to create RC', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRC = async (id) => {
    if (window.confirm('Are you sure you want to delete this Research Center?')) {
      try {
        await api.deleteRC(id);
        showNotification('Research Center deleted successfully', 'success');
        fetchData();
      } catch (error) {
        showNotification('Failed to delete Research Center', 'error');
      }
    }
  };

  const handleEditRC = (rc) => {
    setEditingId(rc._id);
    setFormData({
      name: rc.name
    });
    setShowModal(true);
  };

  const handleUpdateRC = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showNotification('Research Center name is required', 'error');
      return;
    }

    setSaving(true);
    try {
      await api.updateRC(editingId, {
        name: formData.name
      });
      showNotification('Research Center updated successfully', 'success');
      resetForm();
      setShowModal(false);
      fetchData();
    } catch (error) {
      showNotification(error.response?.data?.message || 'Failed to update RC', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Get projects (batches) for COE - match by coeId or populated coeId from problem
  const getProjectsForCOE = (coeObj) => {
    if (!coeObj || !coeObj._id) return [];
    
    const coeId = coeObj._id.toString();
    
    return projects.filter(p => {
      // Only show in COE tab if it does NOT have an RC assignment
      const hasRcId = p.rcId && (p.rcId._id || typeof p.rcId === 'string');
      if (hasRcId) {
        return false; // Don't show in COE if it has RC
      }
      
      // Match by batch.coeId
      if (p.coeId && p.coeId._id && p.coeId._id.toString() === coeId) {
        return true;
      }
      if (typeof p.coeId === 'string' && p.coeId === coeId) {
        return true;
      }
      
      // Match by problem's coeId (if problem is populated)
      if (p.problemId?.coeId) {
        if (typeof p.problemId.coeId === 'string' && p.problemId.coeId === coeId) {
          return true;
        }
        if (p.problemId.coeId._id && p.problemId.coeId._id.toString() === coeId) {
          return true;
        }
      }
      
      return false;
    });
  };

  // Get projects (batches) for RC - match by rcId
  const getProjectsForRC = (rcObj) => {
    if (!rcObj || !rcObj._id) return [];
    
    const rcId = rcObj._id.toString();
    
    return projects.filter(p => {
      // Match by batch.rcId
      if (p.rcId && p.rcId._id && p.rcId._id.toString() === rcId) {
        return true;
      }
      if (typeof p.rcId === 'string' && p.rcId === rcId) {
        return true;
      }
      
      return false;
    });
  };

  // Get unassigned projects - only show if NO coeId AND NO rcId assigned, or if RC name is "--"
  const getUnassignedProjects = () => {
    return projects.filter(p => {
      // Check if RC name is "--" (explicitly marked as unassigned)
      if (p.rc && p.rc.name === '--') {
        return true;
      }

      // Check if has coeId (either directly or from problem)
      const hasCoeId = (p.coeId && (typeof p.coeId === 'string' || p.coeId._id)) ||
                       (p.problemId?.coeId && (typeof p.problemId.coeId === 'string' || p.problemId.coeId._id));
      
      // Check if has rcId
      const hasRcId = p.rcId && (typeof p.rcId === 'string' || p.rcId._id);
      
      // Only include if NEITHER coeId nor rcId is assigned
      return !hasCoeId && !hasRcId;
    });
  };

  const openCOEModal = () => {
    resetForm();
    setActiveSubTab('coe');
    setShowModal(true);
  };

  const openRCModal = () => {
    resetForm();
    setActiveSubTab('rc');
    setShowModal(true);
  };

  if (loading) return <div className="loading">Loading...</div>;

  // Render COE/RC details table modal
  const renderDetailsModal = () => {
    let selectedItems = [];
    let title = '';
    
    if (activeSubTab === 'coe' && selectedCOEId) {
      const coe = coes.find(c => c._id === selectedCOEId);
      if (coe) {
        selectedItems = getProjectsForCOE(coe);
        title = `${coe.name} - Projects (${selectedItems.length})`;
      }
    } else if (activeSubTab === 'rc' && selectedRCId) {
      const rc = rcs.find(r => r._id === selectedRCId);
      if (rc) {
        selectedItems = getProjectsForRC(rc);
        title = `${rc.name} - Projects (${selectedItems.length})`;
      }
    }

    if (!selectedItems.length) return null;

    const getCoeRcValue = (project) => {
      // Get the current tab's selected item (COE or RC)
      if (activeSubTab === 'coe') {
        // For COE tab, show the COE name
        if (project.coeId) {
          if (typeof project.coeId === 'object' && project.coeId.name) {
            return project.coeId.name;
          }
        }
        // Fallback to problem's COE
        if (project.problemId?.coeId) {
          if (typeof project.problemId.coeId === 'object' && project.problemId.coeId.name) {
            return project.problemId.coeId.name;
          }
        }
      } else if (activeSubTab === 'rc') {
        // For RC tab, show the RC name
        if (project.rcId) {
          if (typeof project.rcId === 'object' && project.rcId.name) {
            return project.rcId.name;
          }
        }
      }
      
      // Fallback for embedded data
      if (project.coe?.name && typeof project.coe.name === 'string') return project.coe.name;
      if (project.rc?.name && typeof project.rc.name === 'string') return project.rc.name;
      return 'N/A';
    };

    return (
      <div className="details-modal-overlay" onClick={() => { setSelectedCOEId(null); setSelectedRCId(null); }}>
        <div className="details-modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="details-modal-header">
            <h3>{title}</h3>
            <button className="modal-close" onClick={() => { setSelectedCOEId(null); setSelectedRCId(null); }}>×</button>
          </div>

          <div className="details-table-container">
            <table className="details-table">
              <thead>
                <tr>
                  <th>Team Name</th>
                  <th>Project Title</th>
                  <th>Guide</th>
                  <th>Research Area</th>
                  <th>COE/RC</th>
                  <th>Year</th>
                  <th>Branch</th>
                  <th>Section</th>
                </tr>
              </thead>
              <tbody>
                {selectedItems.map((project) => (
                  <tr key={project._id}>
                    <td>{project.teamName || project.batchId || 'N/A'}</td>
                    <td>{project.problemId?.title || project.optedProblemId?.title || 'N/A'}</td>
                    <td>{project.guideId?.name || 'N/A'}</td>
                    <td>{project.problemId?.researchArea || project.optedProblemId?.researchArea || 'N/A'}</td>
                    <td className="coe-rc-cell">{getCoeRcValue(project)}</td>
                    <td>{project.year || 'N/A'}</td>
                    <td>{project.branch || 'N/A'}</td>
                    <td>{project.section || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="coe-rc-management">
      {notification && (
        <div className={`notification notification-${notification.type}`}>
          {notification.message}
        </div>
      )}

      <div className="sub-tabs">
        <button
          className={`sub-tab ${activeSubTab === 'coe' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('coe')}
        >
          [COE] Centers of Excellence
        </button>
        <button
          className={`sub-tab ${activeSubTab === 'rc' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('rc')}
        >
          [RC] Research Centers
        </button>
        <button
          className={`sub-tab ${activeSubTab === 'other' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('other')}
        >
          [OTHERS] Projects ({getUnassignedProjects().length})
        </button>
      </div>

      {activeSubTab === 'coe' && (
        <div className="tab-content">
          <div className="section-header">
            <h3>Centers of Excellence</h3>
            <button className="btn btn-primary" onClick={openCOEModal}>
              + Add COE
            </button>
          </div>

          {coes.length === 0 ? (
            <div className="empty-state">
              <p>No COEs created yet.</p>
            </div>
          ) : (
            <div className="coe-rc-grid">
              {coes.map((coe) => {
                const projectCount = getProjectsForCOE(coe).length;
                return (
                  <div 
                    key={coe._id} 
                    className="coe-rc-card"
                    onClick={() => setSelectedCOEId(coe._id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="card-body">
                      <h4>{coe.name}</h4>
                      <div className="project-count">{projectCount} Projects</div>
                    </div>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCOE(coe._id);
                      }}
                    >
                      DELETE
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'rc' && (
        <div className="tab-content">
          <div className="section-header">
            <h3>Research Centers</h3>
            <button className="btn btn-primary" onClick={openRCModal}>
              + Add RC
            </button>
          </div>

          {rcs.length === 0 ? (
            <div className="empty-state">
              <p>No RCs created yet.</p>
            </div>
          ) : (
            <div className="coe-rc-grid">
              {rcs.map((rc) => {
                const projectCount = getProjectsForRC(rc).length;
                return (
                  <div 
                    key={rc._id} 
                    className="coe-rc-card"
                    onClick={() => setSelectedRCId(rc._id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="card-body">
                      <h4>{rc.name}</h4>
                      <div className="project-count">{projectCount} Projects</div>
                    </div>
                    <div className="card-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditRC(rc);
                        }}
                      >
                        EDIT
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRC(rc._id);
                        }}
                      >
                        DELETE
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'other' && (
        <div className="tab-content">
          <div className="section-header">
            <h3>Other Projects ({getUnassignedProjects().length})</h3>
          </div>

          {getUnassignedProjects().length === 0 ? (
            <div className="empty-state">
              <p>All projects are assigned to COEs or Research Centers!</p>
            </div>
          ) : (
            <div className="details-table-container">
              <table className="details-table">
                <thead>
                  <tr>
                    <th>Team Name</th>
                    <th>Project Title</th>
                    <th>Guide</th>
                    <th>Research Area</th>
                    <th>COE/RC</th>
                    <th>Year</th>
                    <th>Branch</th>
                    <th>Section</th>
                  </tr>
                </thead>
                <tbody>
                  {getUnassignedProjects().map((project) => {
                    // Get COE/RC display value
                    let coeRcDisplay = 'N/A';
                    
                    // Try coeId first
                    if (project.coeId) {
                      if (typeof project.coeId === 'object' && project.coeId.name) {
                        coeRcDisplay = project.coeId.name;
                      }
                    }
                    // Then try rcId
                    else if (project.rcId) {
                      if (typeof project.rcId === 'object' && project.rcId.name) {
                        coeRcDisplay = project.rcId.name;
                      }
                    }
                    // Try embedded coe/rc as fallback
                    else if (project.coe?.name) {
                      coeRcDisplay = project.coe.name;
                    } else if (project.rc?.name) {
                      coeRcDisplay = project.rc.name;
                    }
                    
                    return (
                      <tr key={project._id}>
                        <td>{project.teamName || project.batchId || 'N/A'}</td>
                        <td>{project.problemId?.title || project.optedProblemId?.title || 'N/A'}</td>
                        <td>{project.guideId?.name || 'N/A'}</td>
                        <td>{project.problemId?.researchArea || project.optedProblemId?.researchArea || 'N/A'}</td>
                        <td className="coe-rc-cell">{coeRcDisplay}</td>
                        <td>{project.year || 'N/A'}</td>
                        <td>{project.branch || 'N/A'}</td>
                        <td>{project.section || 'N/A'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Details Modal */}
      {(selectedCOEId || selectedRCId) && renderDetailsModal()}

      {/* Modal for Create/Edit */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {activeSubTab === 'coe'
                  ? 'Add New COE'
                  : editingId
                  ? 'Edit RC'
                  : 'Add New RC'}
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>

            <form onSubmit={activeSubTab === 'coe' ? (editingId ? null : handleCreateCOE) : (editingId ? handleUpdateRC : handleCreateRC)}>
              <div className="form-group">
                <label>{activeSubTab === 'coe' ? 'COE Name' : 'RC Name'} *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  placeholder={activeSubTab === 'coe' ? 'e.g., Deep Learning in Eye Disease Prognosis' : 'e.g., Cloud Computing'}
                  required
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-success" disabled={saving}>
                  {saving ? 'Saving...' : activeSubTab === 'coe' ? 'Create COE' : (editingId ? 'Update RC' : 'Create RC')}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default COEandRCManagement;
