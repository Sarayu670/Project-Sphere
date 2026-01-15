# Step-by-Step: Import Guides and Problems from Excel

## Step 1: Access Admin Dashboard
1. Login as Admin
2. Navigate to Admin Dashboard
3. Click "📥 Import Excel" tab

## Step 2: Import Guides

### Option A: Download & Fill Template
```
1. Click "📥 Download Template" button
   ↓
2. Opens Guides_Template.xlsx
   Columns:
   - Guide Name (e.g., "Dr. Nanda Devi D.R")
   - Email (e.g., "nanda@gnits.ac.in")
   ↓
3. Add all your guides to the template
   ↓
4. Save the file
```

### Option B: Use Your Own Excel Format
Ensure your Excel file has these columns:
- "Guide Name" - Full name of the guide
- "Email" - Email address

### Upload & Process
```
1. Select the "Import Guides" tab
   ↓
2. Click file input or drag & drop
   ↓
3. Select your guides Excel file
   ↓
4. Click "Import Guides" button
   ↓
5. Wait for processing (shows "Importing..." message)
   ↓
6. See results:
      ✓ Success: X guides imported
      ✗ Failed: Y guides (see errors below)
```

## Step 3: Import Problems

### Option A: Download & Fill Template
```
1. Click "📥 Download Template" button
   ↓
2. Opens Problems_Template.xlsx
   Columns:
   - Project Title (e.g., "EnviroWatch Project")
   - Internal Guide (e.g., "Dr. Nanda Devi D.R")
   - Research Thrust Area/Domain (e.g., "Deep Learning")
   - Description (optional)
   ↓
3. Add all your problems to the template
   ↓
4. Make sure:
   - Guide names match exactly with imported guides
   - Domain names match with your COEs
   ↓
5. Save the file
```

### Option B: Use Your Own Excel Format
Ensure your Excel file has:
- "Project Title" - Name of the problem/project
- "Internal Guide" - Full name of the assigned guide
- "Research Thrust Area/Domain" - COE name (must exist in system)
- "Description" (optional)

### Upload & Process
```
1. Click "📋 Import Problems" tab
   ↓
2. Click file input or drag & drop
   ↓
3. Select your problems Excel file
   ↓
4. Click "Import Problems" button
   ↓
5. Wait for processing
   ↓
6. See results:
      ✓ Success: X problems imported
      ✗ Failed: Y problems (see errors below)
```

## Common Issues & Solutions

### ❌ Guide Not Found (When Importing Problems)
**Problem:** Error says "Guide 'Dr. X' not found"
**Solution:**
1. Make sure the guide was imported first (Step 2)
2. Check spelling matches exactly in Excel
3. Use "Find & Replace" to ensure consistency

### ❌ Domain/COE Not Found
**Problem:** Error says "Domain/COE 'Y' not found"
**Solution:**
1. Go to "⚙️ Manage COEs" tab
2. Create the missing COE if not exists
3. Use exact COE name in your Excel file

### ❌ Email Already Exists
**Problem:** Error says "Guide already exists"
**Solution:**
1. The email is already in database
2. Either skip this entry or delete existing one first
3. Check database for duplicates

### ❌ Missing Required Columns
**Problem:** Error during upload
**Solution:**
1. Download the template again
2. Ensure column headers match exactly (case-sensitive):
   - Guides: "Guide Name", "Email"
   - Problems: "Project Title", "Internal Guide", "Research Thrust Area/Domain"

## Data Flow

```
                    Admin Dashboard
                           ↓
            ┌───────────────────────────┐
            │  📥 Import Excel Tab      │
            └───────────────────────────┘
                           ↓
           ┌────────────────────────────┐
           │  👨‍🏫 Import Guides           │
           └────────────────────────────┘
                           ↓
        ┌──────────────────────────────┐
        │ 📥 Download/Upload Template  │
        └──────────────────────────────┘
                           ↓
        ┌──────────────────────────────┐
        │  POST /api/admin/import-guides
        │  (Excel file)                │
        └──────────────────────────────┘
                           ↓
        ┌──────────────────────────────┐
        │  Backend:                     │
        │  1. Parse Excel              │
        │  2. Validate data            │
        │  3. Create Guide records     │
        │  4. Return results           │
        └──────────────────────────────┘
                           ↓
        ┌──────────────────────────────┐
        │  Show results to user:       │
        │  ✓ 5 guides imported         │
        │  ✗ 1 failed (errors shown)   │
        └──────────────────────────────┘


                    THEN FOR PROBLEMS
                           ↓
           ┌────────────────────────────┐
           │  📋 Import Problems        │
           └────────────────────────────┘
                           ↓
        ┌──────────────────────────────┐
        │ 📥 Download/Upload Template  │
        │ (Guides must be imported)    │
        └──────────────────────────────┘
                           ↓
        ┌──────────────────────────────┐
        │  POST /api/admin/import-problems
        │  (Excel file)                │
        └──────────────────────────────┘
                           ↓
        ┌──────────────────────────────┐
        │  Backend:                     │
        │  1. Parse Excel              │
        │  2. Find matching guides     │
        │  3. Find matching COEs       │
        │  4. Create Problem records   │
        │  5. Return results           │
        └──────────────────────────────┘
                           ↓
        ┌──────────────────────────────┐
        │  Show results to user:       │
        │  ✓ 10 problems imported      │
        │  ✗ 2 failed (errors shown)   │
        └──────────────────────────────┘
```

## Example Excel Files

### Guides.xlsx

| Guide Name | Email |
|---|---|
| Dr. Nanda Devi D.R | nanda.devi@gnits.ac.in |
| Dr. Ramesh Kumar | ramesh@gnits.ac.in |
| Mrs. Anjali Singh | anjali@gnits.ac.in |
| Prof. Vikram Patel | vikram@gnits.ac.in |
| Dr. Suresh Sharma | suresh@gnits.ac.in |

### Problems.xlsx

| Project Title | Internal Guide | Research Thrust Area/Domain | Description |
|---|---|---|---|
| EnviroWatch: Environmental Action | Dr. Nanda Devi D.R | Deep Learning | Mobile app for environmental monitoring |
| Smart City Water Management | Dr. Ramesh Kumar | IoT | IoT-based water conservation system |
| AI Predictive Analytics | Mrs. Anjali Singh | Data Analytics | ML for business intelligence |
| AR-VR Education Platform | Prof. Vikram Patel | AR-VR | Immersive learning experience |
| Cloud Security Framework | Dr. Suresh Sharma | Cloud Computing | Secure cloud infrastructure |

## After Import

### What Happens to Imported Data:

**Guides:**
- ✓ Created in database
- ✓ Assigned email address
- ✓ Given temporary password: "DefaultPass@123"
- ✓ Can login and change password
- ✓ Ready to be assigned batches

**Problems:**
- ✓ Created in database
- ✓ Linked to guide
- ✓ Linked to COE/domain
- ✓ Set to 3rd year (mini projects) by default
- ✓ Available for students to select

### Next Steps:
1. Guides can login and change passwords
2. Import batches (teams)
3. Assign guides to batches
4. Assign problems to batches
5. Students can view and select problems
6. Start project tracking

## Tips for Success

✅ **DO:**
- Use exact column names from template
- Keep guide names consistent
- Use exact COE names as they appear in system
- Save files in .xlsx format
- Review errors and fix issues
- Test with small files first

❌ **DON'T:**
- Change column headers
- Leave required fields empty
- Use special characters in names
- Assume name variations will match
- Import duplicates
- Import before guides (for problems import)

## Support

If you encounter issues:
1. Check the error messages shown in results
2. Review this guide for solutions
3. Ensure data format matches exactly
4. Download and use provided templates
