import axios from 'axios';

const API_URL = '/api';

// Auth
export const login = (data) => axios.post(`${API_URL}/auth/login`, data);
export const registerStudent = (data) => axios.post(`${API_URL}/auth/register/student`, data);
export const registerGuide = (data) => axios.post(`${API_URL}/auth/register/guide`, data);
export const registerAdmin = (data) => axios.post(`${API_URL}/auth/register/admin`, data);
export const getMe = () => axios.get(`${API_URL}/auth/me`);

// COE
export const getAllCOEs = () => axios.get(`${API_URL}/coe`);
export const getCOE = (id) => axios.get(`${API_URL}/coe/${id}`);
export const createCOE = (data) => axios.post(`${API_URL}/coe`, data);
export const updateCOE = (id, data) => axios.put(`${API_URL}/coe/${id}`, data);
export const deleteCOE = (id) => axios.delete(`${API_URL}/coe/${id}`);

// Guides
export const getAllGuides = () => axios.get(`${API_URL}/guides`);
export const getGuide = (id) => axios.get(`${API_URL}/guides/${id}`);
export const createGuide = (data) => axios.post(`${API_URL}/guides`, data);
export const getMyBatches = () => axios.get(`${API_URL}/guides/my-batches`);

// Problems
export const getAllProblems = () => axios.get(`${API_URL}/problems`);
export const getMyProblems = () => axios.get(`${API_URL}/problems/my-problems`);
export const getProblemsByCOE = (coeId) => axios.get(`${API_URL}/problems/coe/${coeId}`);
export const getProblem = (id) => axios.get(`${API_URL}/problems/${id}`);
export const createProblem = (data) => axios.post(`${API_URL}/problems`, data);
export const updateProblem = (id, data) => axios.put(`${API_URL}/problems/${id}`, data);
export const deleteProblem = (id) => axios.delete(`${API_URL}/problems/${id}`);

// Batches
export const getAllBatches = () => axios.get(`${API_URL}/batches`);
export const getMyBatch = () => axios.get(`${API_URL}/batches/my-batch`);
export const getBatch = (id) => axios.get(`${API_URL}/batches/${id}`);
export const createBatch = (data) => axios.post(`${API_URL}/batches`, data);
export const selectProblem = (problemId) => axios.post(`${API_URL}/batches/select-problem`, { problemId });
export const updateBatchStatus = (id, status) => axios.put(`${API_URL}/batches/${id}/status`, { status });
export const getOptedTeams = () => axios.get(`${API_URL}/batches/opted-teams`);
export const allotProblem = (batchId, problemId) => axios.post(`${API_URL}/batches/${batchId}/allot`, { problemId });
export const rejectProblem = (batchId, problemId) => axios.post(`${API_URL}/batches/${batchId}/reject`, { problemId });

// Team Members
export const getTeamMembers = (batchId) => axios.get(`${API_URL}/team-members/${batchId}`);
export const addTeamMember = (data) => axios.post(`${API_URL}/team-members`, data);
export const updateTeamMember = (id, data) => axios.put(`${API_URL}/team-members/${id}`, data);
export const deleteTeamMember = (id) => axios.delete(`${API_URL}/team-members/${id}`);

// Progress
export const getProgressUpdates = (batchId) => axios.get(`${API_URL}/progress/${batchId}`);
export const createProgressUpdate = (data) => axios.post(`${API_URL}/progress`, data);
export const addComment = (progressId, comment) => axios.post(`${API_URL}/progress/${progressId}/comment`, { comment });
export const getGuideProgressUpdates = () => axios.get(`${API_URL}/progress/guide/all`);

// Admin
export const getAdminDashboard = () => axios.get(`${API_URL}/admin/dashboard`);
export const getAdminOverview = () => axios.get(`${API_URL}/admin/overview`);
export const getBatchGuideMapping = () => axios.get(`${API_URL}/admin/batch-guide-mapping`);
export const createAdmin = (data) => axios.post(`${API_URL}/admin/create`, data);
export const importBatches = (data) => axios.post(`${API_URL}/admin/import-batches`, data);

// Timeline
export const getAllTimelineEvents = (year) => axios.get(`${API_URL}/timeline`, { params: { year } });
export const getTimelineForBatch = (batchId) => axios.get(`${API_URL}/timeline/batch/${batchId}`);
export const createTimelineEvent = (data) => axios.post(`${API_URL}/timeline`, data);
export const updateTimelineEvent = (id, data) => axios.put(`${API_URL}/timeline/${id}`, data);
export const deleteTimelineEvent = (id) => axios.delete(`${API_URL}/timeline/${id}`);

// Submissions
export const createSubmission = (data) => axios.post(`${API_URL}/submissions`, data);
export const getSubmission = (id) => axios.get(`${API_URL}/submissions/${id}`);
export const getBatchSubmissions = (batchId) => axios.get(`${API_URL}/submissions/batch/${batchId}`);
export const getGuideSubmissions = () => axios.get(`${API_URL}/submissions/guide`);
export const getAllSubmissions = () => axios.get(`${API_URL}/submissions`);
export const addSubmissionComment = (id, comment) => axios.post(`${API_URL}/submissions/${id}/comment`, { comment });
export const assignSubmissionMarks = (id, marks, status) => axios.post(`${API_URL}/submissions/${id}/marks`, { marks, status });
export const addAdminRemark = (id, remark) => axios.post(`${API_URL}/submissions/${id}/admin-remark`, { remark });

