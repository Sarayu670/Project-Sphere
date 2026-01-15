# Excel Data Import Feature

## Overview
Added functionality to import guides and problem statements from Excel files via the admin dashboard. This allows admins to bulk import data from Excel spreadsheets instead of manually creating records.

## Changes Made

### Backend

#### 1. Admin Controller Updates (`adminController.js`)
- **Added:** `importGuides()` - Import guides from Excel file
  - Extracts columns: "Guide Name", "Email"
  - Creates guide records with default password
  - Returns success/failure count with error details
  
- **Added:** `importProblems()` - Import problem statements from Excel file
  - Extracts columns: "Project Title", "Internal Guide", "Research Thrust Area/Domain"
  - Matches guides and COEs by name
  - Creates problem records linked to guides and COEs
  - Returns success/failure count with error details

#### 2. Admin Routes Updates (`adminRoutes.js`)
- **Added:** `POST /api/admin/import-guides` - Upload and import guides
- **Added:** `POST /api/admin/import-problems` - Upload and import problems
- Both routes use multer for file upload (memory storage)
- Both routes require admin authentication

#### 3. Packages Installed
- `xlsx` - For reading Excel files

### Frontend

#### 1. API Service Updates (`api.js`)
- **Added:** `importGuides(file)` - Send guides Excel file
- **Added:** `importProblems(file)` - Send problems Excel file
- Both methods use FormData for multipart/form-data upload

#### 2. New ImportData Component (`frontend/src/pages/admin/ImportData.jsx`)
**Features:**
- Tabbed interface for Guides and Problems import
- File upload input for each type
- Download template buttons
- Progress feedback (loading state)
- Results display showing:
  - Number of successful imports
  - Number of failed imports
  - Detailed error messages for each failure

#### 3. Excel Templates (`utils/excelImportTemplates.js`)
**Two template generators:**

**Guides Template:**
```
| Guide Name | Email |
|---|---|
| Dr. Nanda Devi D.R | nanda.devi@gnits.ac.in |
| Dr. Ramesh Kumar | ramesh@gnits.ac.in |
```

**Problems Template:**
```
| Project Title | Internal Guide | Research Thrust Area/Domain | Description |
|---|---|---|---|
| EnviroWatch: Empowering Communities... | Dr. Nanda Devi D.R | Deep Learning | Mobile app for environmental monitoring |
| Smart City Water Management | Dr. Ramesh Kumar | IoT | IoT-based water conservation |
```

#### 4. Admin Dashboard Updates (`AdminDashboard.jsx`)
- Added new tab "📥 Import Excel"
- Integrated ImportData component
- Routes to import tab when clicked

## How to Use

### 1. As Admin, Navigate to Import Excel Tab
Click the "📥 Import Excel" tab in the Admin Dashboard

### 2. Download Template
Click "📥 Download Template" button to get pre-formatted Excel file

### 3. Fill in Your Data
Add your guides/problems to the Excel file using the provided template

### 4. Upload and Import
- Select the filled Excel file
- Click "Import Guides" or "Import Problems"
- Wait for processing
- Review results (success/failure count and errors)

## Error Handling

### Guides Import Errors
- Missing name or email columns
- Email already exists in database
- Duplicate entries in Excel

### Problems Import Errors
- Missing "Project Title"
- Guide not found (no matching guide in database)
- COE/Domain not found (no matching COE in database)
- Problem already exists for that guide

## Data Storage

### Guides
When imported, guides are created with:
- Name (from "Guide Name" column)
- Email (from "Email" column)
- Password: "DefaultPass@123" (should be changed on first login)
- Role: "guide"
- maxBatches: 3
- assignedBatches: 0

### Problems
When imported, problems are created with:
- Title (from "Project Title" column)
- Description (from description if available)
- COE (matched from "Research Thrust Area/Domain")
- Guide (matched from "Internal Guide")
- targetYear: "3rd" (default for mini projects)
- maxBatches: 10
- selectedBatchCount: 0

## Matching Logic

### For Problems Import:
1. **Guide Matching:** Case-insensitive match of guide name
   - Excel: "Dr. Nanda Devi D.R" → Database: "Dr. Nanda Devi D.R"
   
2. **COE Matching:** Case-insensitive match of domain/COE name
   - Excel: "Deep Learning" → Database COE: "Deep Learning"

## Files Modified/Created

**Backend:**
- `backend/controllers/adminController.js` - Added import functions
- `backend/routes/adminRoutes.js` - Added import routes
- `backend/package.json` - Added xlsx dependency

**Frontend:**
- `frontend/src/services/api.js` - Added import methods
- `frontend/src/pages/admin/AdminDashboard.jsx` - Added import tab
- `frontend/src/pages/admin/ImportData.jsx` - NEW: Import UI component
- `frontend/src/utils/excelImportTemplates.js` - NEW: Template generators

## API Endpoints

### Import Guides
```
POST /api/admin/import-guides
Content-Type: multipart/form-data

Form Data:
- file: [Excel file with guides]

Response:
{
  "success": true,
  "data": {
    "success": 3,
    "failed": 1,
    "errors": [
      { "name": "John Doe", "email": "john@example.com", "error": "Guide already exists" }
    ]
  },
  "message": "Guides import: 3 succeeded, 1 failed"
}
```

### Import Problems
```
POST /api/admin/import-problems
Content-Type: multipart/form-data

Form Data:
- file: [Excel file with problems]

Response:
{
  "success": true,
  "data": {
    "success": 5,
    "failed": 2,
    "errors": [
      { "title": "Problem X", "error": "Guide 'Dr. Y' not found" }
    ]
  },
  "message": "Problems import: 5 succeeded, 2 failed"
}
```

## Requirements for Excel Files

### Guides File
- **Required Columns:** "Guide Name", "Email"
- **File Format:** .xlsx, .xls, .csv
- **Example Row:**
  ```
  Guide Name: Dr. Nanda Devi D.R
  Email: nanda.devi@gnits.ac.in
  ```

### Problems File
- **Required Columns:** "Project Title", "Internal Guide", "Research Thrust Area/Domain"
- **Optional Columns:** "Description"
- **File Format:** .xlsx, .xls, .csv
- **Example Row:**
  ```
  Project Title: EnviroWatch Project
  Internal Guide: Dr. Nanda Devi D.R
  Research Thrust Area/Domain: Deep Learning
  Description: Mobile app for environmental monitoring
  ```

## Validation

All imports include validation:
- ✓ Required fields check
- ✓ Email format validation (for guides)
- ✓ Duplicate detection
- ✓ Reference validation (guide/COE exists)
- ✓ Detailed error reporting per row

## Future Enhancements

- Add bulk update capability
- Support for updating existing records
- Column mapping flexibility
- Batch/team import from Excel
- Export existing data to Excel
- Scheduled import jobs
- Import logs/audit trail
